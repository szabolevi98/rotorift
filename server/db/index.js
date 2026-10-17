import mysql from "mysql2/promise";
import { randomUUID } from "node:crypto";
import { normalizeSimulation, simulationKey } from "../../shared/simulation/options.js";
import { sanitizeGhost } from '../../shared/race/ghost.js';
export class Database {
  constructor() {
    this.pool = null;
    this.available = false;
  }
  async init() {
    const name = process.env.DB_NAME || "rotorift";
    if (!/^[a-zA-Z0-9_]+$/.test(name)) throw Error("Invalid database name");
    try {
      const opts = {
        host: process.env.DB_HOST || "127.0.0.1",
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "",
        connectTimeout: 2500,
      };
      const setup = await mysql.createConnection(opts);
      try {
        await setup.query(
          "CREATE DATABASE IF NOT EXISTS `" +
            name +
            "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
        );
      } finally {
        await setup.end();
      }
      this.pool = mysql.createPool({
        ...opts,
        database: name,
        connectionLimit: 4,
      });
      await this.pool.query(
        "CREATE TABLE IF NOT EXISTS players (id CHAR(36) PRIMARY KEY, nick VARCHAR(32) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
      );
      const [publicColumn]=await this.pool.query("SHOW COLUMNS FROM players LIKE 'public_id'");
      if(!publicColumn.length)await this.pool.query('ALTER TABLE players ADD COLUMN public_id CHAR(36) NULL');
      await this.pool.query('UPDATE players SET public_id=UUID() WHERE public_id IS NULL');
      await this.pool.query(
        "CREATE TABLE IF NOT EXISTS laps (id CHAR(36) PRIMARY KEY, player_id CHAR(36) NOT NULL, map_id VARCHAR(32) NOT NULL, route_version INT NOT NULL, drone_id VARCHAR(32) NOT NULL, config_hash CHAR(16) NOT NULL, flight_mode VARCHAR(12) NOT NULL, duration_ms DOUBLE NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX category (map_id,route_version,drone_id,config_hash,flight_mode), FOREIGN KEY (player_id) REFERENCES players(id))",
      );
      await this.pool.query(
        "CREATE TABLE IF NOT EXISTS results (id CHAR(36) PRIMARY KEY, map_id VARCHAR(32) NOT NULL, payload LONGTEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
      );
      const [simulationColumn] = await this.pool.query("SHOW COLUMNS FROM laps LIKE 'simulation_key'");
      if (!simulationColumn.length)
        await this.pool.query("ALTER TABLE laps ADD COLUMN simulation_key CHAR(5) NOT NULL DEFAULT '00010'");
      const [routeColumn] = await this.pool.query("SHOW COLUMNS FROM laps LIKE 'route_id'");
      if (!routeColumn.length)
        await this.pool.query("ALTER TABLE laps ADD COLUMN route_id VARCHAR(64) NOT NULL DEFAULT ''");
      const [routeIndex] = await this.pool.query("SHOW INDEX FROM laps WHERE Key_name='category_route'");
      if (!routeIndex.length)
        await this.pool.query("CREATE INDEX category_route ON laps(map_id,route_id,route_version,drone_id,config_hash,flight_mode,simulation_key)");
      const [ghostColumn]=await this.pool.query("SHOW COLUMNS FROM laps LIKE 'ghost_data'");
      if(!ghostColumn.length)await this.pool.query('ALTER TABLE laps ADD COLUMN ghost_data MEDIUMTEXT NULL');
      this.available = true;
    } catch {
      this.available = false;
      console.warn(
        "Database unavailable; flying works, online records cannot be saved.",
      );
    }
  }
  async profile(token, nick) {
    let id;
    if (
      this.available &&
      typeof token === "string" &&
      /^[a-f0-9-]{36}$/.test(token)
    ) {
      const [rows] = await this.pool.execute(
        "SELECT id FROM players WHERE id=?",
        [token],
      );
      id = rows[0]?.id;
    }
    id ??=
      typeof token === "string" && /^[a-f0-9-]{36}$/.test(token)
        ? token
        : randomUUID();
    if (this.available)
      await this.pool.execute(
        "INSERT INTO players(id,nick,public_id) VALUES(?,?,?) ON DUPLICATE KEY UPDATE nick=VALUES(nick)",
        [id, nick,randomUUID()],
      );
    return id;
  }
  async saveLap(player, map, drone, mode, ms, simulation, ghost=null) {
    if (!this.available) return false;
    try {
      let replay=sanitizeGhost(ghost);
      if(replay&&Math.abs(replay.frames.at(-1)[0]-ms)>2)replay=null;
      if(replay){
        const [best]=await this.pool.execute('SELECT MIN(duration_ms) AS ms FROM laps WHERE player_id=? AND map_id=? AND route_id=? AND route_version=? AND drone_id=? AND config_hash=? AND flight_mode=? AND simulation_key=?',
          [player,map.id,map.routeId??'',map.routeVersion,drone.id,drone.configHash,mode,simulationKey(simulation)]);
        if(best[0].ms!==null&&ms>best[0].ms)replay=null;
      }
      await this.pool.execute(
        "INSERT INTO laps(id,player_id,map_id,route_id,route_version,drone_id,config_hash,flight_mode,duration_ms,simulation_key,ghost_data) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        [
          randomUUID(),
          player,
          map.id,
          map.routeId ?? "",
          map.routeVersion,
          drone.id,
          drone.configHash,
          mode,
          ms,
          simulationKey(simulation),
          replay?JSON.stringify(replay):null,
        ],
      );
      return true;
    } catch {
      return false;
    }
  }
  async saveResult(room) {
    if (!this.available) return false;
    try {
      await this.pool.execute(
        "INSERT IGNORE INTO results(id,map_id,payload) VALUES(?,?,?)",
        [
          room.raceId,
          room.map.id,
          JSON.stringify(
            (room.results ?? [...room.players.values()]).map((p) => ({
              id: p.id,
              place: p.place ?? null,
              status: p.status ?? (p.finished ? "finished" : "dnf"),
              name: p.name,
              mode: p.mode ?? room.mode,
              simulation: normalizeSimulation(room.simulation),
              completed: p.completed ?? p.lap?.completed ?? 0,
              bestMs: p.bestMs ?? p.lap?.bestMs ?? null,
              finished: p.finished,
              finishMs: p.finishMs,
            })),
          ),
        ],
      );
      return true;
    } catch {
      return false;
    }
  }
  async leaderboard(map, drone, mode, simulation) {
    if (!this.available) return { available: false, entries: [] };
    try {
      const [rows] = await this.pool.execute(
        `SELECT p.public_id AS ghostId, ranked.id AS recordId, p.nick AS name, ranked.flight_mode AS mode, ranked.duration_ms AS ms, ranked.created_at AS date, ranked.hasGhost
         FROM (SELECT id,player_id,flight_mode,duration_ms,created_at,(ghost_data IS NOT NULL) AS hasGhost,ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY duration_ms ASC,(ghost_data IS NULL) ASC,created_at ASC,id ASC) AS rankInPlayer
               FROM laps WHERE map_id=? AND route_id=? AND route_version=? AND drone_id=? AND config_hash=? AND (?='all' OR flight_mode=?) AND simulation_key=?) ranked
         JOIN players p ON p.id=ranked.player_id WHERE ranked.rankInPlayer=1 ORDER BY ms ASC,date ASC,ghostId ASC LIMIT 30`,
        [map.id, map.routeId ?? "", map.routeVersion, drone.id, drone.configHash, mode, mode, simulationKey(simulation)],
      );
      return { available: true, entries: rows };
    } catch {
      return { available: false, entries: [] };
    }
  }
  async ghost(map,drone,mode,simulation,id){
    if(!this.available)return null;
    const board=await this.leaderboard(map,drone,mode,simulation);
    const entry=board.entries.slice(0,10).find(e=>e.ghostId===id&&e.hasGhost);
    if(!entry)return null;
    const [rows]=await this.pool.execute('SELECT ghost_data FROM laps WHERE id=?',[entry.recordId]);
    try{const replay=sanitizeGhost(JSON.parse(rows[0]?.ghost_data??'null'));return replay?{...entry,replay}:null;}catch{return null;}
  }
}
