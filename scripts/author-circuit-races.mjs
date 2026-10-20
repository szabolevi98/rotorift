import { mkdir, writeFile, readFile } from "node:fs/promises";
import {
  circuitPoint,
  CIRCUIT_LENGTH,
} from "../shared/world/circuit-layout.js";
import { validateRoute } from "../shared/race/routes.js";
import './build-circuit-apron.mjs';
const map = JSON.parse(
  await readFile(new URL("../data/maps/apex.json", import.meta.url)),
);
const round = (n) => Math.round(n * 1000) / 1000,
  mod = (a, b) => ((a % b) + b) % b;
const track = (d, y = 4.7) => {
  const p = circuitPoint(d);
  return [p.x, y, p.z];
};
const pitPath = [];
for (let d = 470; d < CIRCUIT_LENGTH + 15; d += 5) {
  if (d === 1130) pitPath.push(
    track(1130), [95, 4.7, 20], [65, 4.7, 34], [20, 2.7, 42],
    [20, 2.7, 95], [-10, 4.7, 105], [-40, 4.7, 83],
    [-40, 2.7, 32], [-90, 2.7, 32], [-97, 4.7, 5],
    [-70, 6, -35], [-30, 5, -90], track(1320),
  );
  if (d >= 1130 && d <= 1320) continue;
  pitPath.push(track(d));
}
pitPath.push(
  track(15),
  [-218, 4.7, 174],
  [-198, 3.4, 184],
  [-160, 3.4, 190],
  [-100, 3.4, 190],
  [-40, 3.4, 190],
  [20, 3.4, 190],
  [80, 3.4, 190],
  [104, 4.7, 188],
  [115, 5.2, 175],
  [155, 4.7, 180],
  [190, 4.7, 167],
  track(420),
);
for (let d = 425; d < 470; d += 5) pitPath.push(track(d));
function polyline(points) {
  const lengths = [0];
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    total += Math.hypot(
      ...points[(i + 1) % points.length].map((v, k) => v - points[i][k]),
    );
    lengths.push(total);
  }
  return {
    length: total,
    point: (t) => {
      const d = mod(t, 1) * total;
      let i = 0;
      while (lengths[i + 1] < d) i++;
      const f = (d - lengths[i]) / (lengths[i + 1] - lengths[i]);
      return points[i].map(
        (v, k) => v + (points[(i + 1) % points.length][k] - v) * f,
      );
    },
  };
}
const pit = polyline(pitPath);
const descriptions = {
  race_1: {
    en: "Follow the GT cars around the full asphalt circuit. Broad low gates, flowing bends and a clear line under the pedestrian bridge.",
    hu: "Kövesd a GT autókat az aszfaltpálya teljes körén. Széles, alacsony kapuk, íves kanyarok és szabad átrepülés a gyaloghíd alatt.",
    de: "Folge den GT-Autos rund um die Asphaltstrecke. Breite niedrige Tore, fließende Kurven und ein freier Durchflug unter der Fußgängerbrücke.",
    fr: "Suivez les GT sur tout le circuit. Portes larges et basses, virages fluides et passage libre sous la passerelle.",
    es: "Sigue a los GT por todo el circuito. Puertas anchas y bajas, curvas fluidas y paso libre bajo el puente peatonal.",
  },
  race_2: {
    en: "A technical circuit lap through the clubhouse breezeway, below the media tower and along the open pit garages, returning under the bridge.",
    hu: "Technikás pályakör a klubház átjáróján és a médiatorony alatt, majd a nyitott boxok előtt és a híd alatt.",
    de: "Eine technische Runde durch den Clubhaus-Durchgang, unter dem Medienturm und entlang der offenen Boxen, zurück unter der Brücke.",
    fr: "Un tour technique par le passage du club-house, sous la tour média et devant les garages ouverts, puis sous la passerelle.",
    es: "Una vuelta técnica por el paso del club, bajo la torre de medios y frente a los boxes abiertos, regresando bajo el puente.",
  },
  wing_1: {
    en: "A broad, smooth airplane circuit above the motorsport park, with ample wing clearance and views of the moving cars.",
    hu: "Széles, lágy ívű repülős kör a versenypálya felett, bőséges szárnyhellyel és kilátással a mozgó autókra.",
    de: "Ein weiter, sanfter Flugzeugkurs über dem Motorsportpark mit viel Platz für die Flügel und Blick auf die fahrenden Autos.",
    fr: "Un grand circuit aérien fluide au-dessus du parc, avec une large marge pour les ailes et une vue sur les voitures.",
    es: "Un amplio circuito aéreo sobre el parque, con espacio para las alas y vistas a los coches en movimiento.",
  },
  wing_2: {
    en: "A lower figure-eight over the infield and main straight. Smooth direction changes clear the buildings and pedestrian bridge.",
    hu: "Alacsonyabb nyolcas a belső terület és a főegyenes felett. Lágy irányváltásokkal, az épületek és a gyaloghíd felett vezet.",
    de: "Eine tiefere Acht über Innenfeld und Startgerade. Sanfte Richtungswechsel führen über Gebäude und Fußgängerbrücke.",
    fr: "Un huit plus bas au-dessus du terrain intérieur et de la ligne droite, avec des changements de direction fluides au-dessus des bâtiments.",
    es: "Un ocho más bajo sobre el interior y la recta principal, con cambios suaves de dirección por encima de edificios y puente.",
  },
};
const designs = [
  {
    id: "race_1",
    name: "GT Chase",
    count: 30,
    point: (t) =>
      track(140 + t * CIRCUIT_LENGTH, 4.7 + 0.8 * Math.sin(t * Math.PI * 2)),
    length: CIRCUIT_LENGTH,
    width: 9,
    height: 4,
    difficulty: "medium",
  },
  {
    id: "race_2",
    name: "Pit Lane Run",
    count: 34,
    ...pit,
    width: 7,
    height: 4,
    difficulty: "medium",
  },
  {
    id: "wing_1",
    name: "Apex Air Circuit",
    count: 18,
    point: (t) => {
      const a = t * Math.PI * 2;
      return [330 * Math.sin(a), 45, 275 * Math.cos(a)];
    },
    length: 1900,
    width: 18,
    height: 14,
    difficulty: "easy",
    plane: true,
  },
  {
    id: "wing_2",
    name: "Infield Figure Eight",
    count: 24,
    point: (t) => {
      const a = t * Math.PI * 2;
      return [
        280 * Math.sin(a),
        30 + 4 * Math.cos(a * 2),
        180 * Math.sin(a * 2),
      ];
    },
    length: 2000,
    width: 18,
    height: 14,
    difficulty: "medium",
    plane: true,
  },
];
await mkdir(new URL("../data/maps/apex/", import.meta.url), {
  recursive: true,
});
for (const d of designs) {
  const gates = Array.from({ length: d.count }, (_, i) => {
    const t = i / d.count,
      a = d.point(t - 0.0001),
      b = d.point(t + 0.0001),
      v = b.map((n, k) => n - a[k]),
      len = Math.hypot(...v);
    return {
      p: d.point(t).map(round),
      n: v.map((n) => n / len),
      width: d.width,
      height: d.height,
    };
  });
  const guide = gates.map((g, i) => [
    g.p,
    ...Array.from({ length: 13 }, (_, j) =>
      d.point((i + (j + 1) / 14) / d.count).map(round),
    ),
    gates[(i + 1) % d.count].p,
  ]);
  const route = validateRoute(
    {
      id: d.id,
      name: d.name,
      version: d.plane ? 1 : 2,
      spawn: d.point(-14 / d.length).map(round),
      gates,
      guide,
      aircraftKinds: [d.plane ? "fixedWing" : "quadrotor"],
      details: {
        difficulty: d.difficulty,
        recommendedDrones: d.plane
          ? ["rift-a40", "rift-s75", "rift-t15"]
          : ["rift-c3", "rift-x35", "rift-x5", "rift-r5"],
        description: descriptions[d.id],
      },
    },
    map,
  );
  await writeFile(
    new URL("../data/maps/apex/" + d.id + ".json", import.meta.url),
    JSON.stringify(route, null, 2) + "\n",
  );
  console.log(d.id, route.gates.length + " gates");
}
