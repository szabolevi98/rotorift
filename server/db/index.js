import mysql from "mysql2/promise";
import { randomUUID } from "node:crypto";
import { normalizeSimulation, simulationKey } from "../../shared/simulation/options.js";
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
      await this.pool.query(
        "CREATE TABLE IF NOT EXISTS laps (id CHAR(36) PRIMARY KEY, player_id CHAR(36) NOT NULL, map_id VARCHAR(32) NOT NULL, route_version INT NOT NULL, drone_id VARCHAR(32) NOT NULL, config_hash CHAR(16) NOT NULL, flight_mode VARCHAR(12) NOT NULL, duration_ms DOUBLE NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX category (map_id,route_version,drone_id,config_hash,flight_mode), FOREIGN KEY (player_id) REFERENCES players(id))",
      );
      await this.pool.query(
        "CREATE TABLE IF NOT EXISTS results (id CHAR(36) PRIMARY KEY, map_id VARCHAR(32) NOT NULL, payload LONGTEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
      );
      const [simulationColumn] = await this.pool.query("SHOW COLUMNS FROM laps LIKE 'simulation_key'");
      if (!simulationColumn.length)
        await this.pool.query("ALTER TABLE laps ADD COLUMN simulation_key CHAR(5) NOT NULL DEFAULT '00010'");
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
        "INSERT INTO players(id,nick) VALUES(?,?) ON DUPLICATE KEY UPDATE nick=VALUES(nick)",
        [id, nick],
      );
    return id;
  }
  async saveLap(player, map, drone, mode, ms, simulation) {
    if (!this.available) return false;
    try {
      await this.pool.execute(
        "INSERT INTO laps(id,player_id,map_id,route_version,drone_id,config_hash,flight_mode,duration_ms,simulation_key) VALUES(?,?,?,?,?,?,?,?,?)",
        [
          randomUUID(),
          player,
          map.id,
          map.routeVersion,
          drone.id,
          drone.configHash,
          mode,
          ms,
          simulationKey(simulation),
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
            [...room.players.values()].map((p) => ({
              name: p.name,
              mode: p.mode ?? room.mode,
              simulation: normalizeSimulation(room.simulation),
              completed: p.lap.completed,
              bestMs: p.lap.bestMs,
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
        "SELECT p.nick AS name, MIN(l.duration_ms) AS ms, MAX(l.created_at) AS date FROM laps l JOIN players p ON p.id=l.player_id WHERE l.map_id=? AND l.route_version=? AND l.drone_id=? AND l.config_hash=? AND l.flight_mode=? AND l.simulation_key=? GROUP BY l.player_id,p.nick ORDER BY ms ASC LIMIT 30",
        [map.id, map.routeVersion, drone.id, drone.configHash, mode, simulationKey(simulation)],
      );
      return { available: true, entries: rows };
    } catch {
      return { available: false, entries: [] };
    }
  }
}
