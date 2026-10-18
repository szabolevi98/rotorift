import { readFile, writeFile } from "node:fs/promises";
import { validateRoute } from "../shared/race/routes.js";

const map = JSON.parse(
  await readFile(new URL("../data/maps/liget.json", import.meta.url)),
);
const round = (n) => Math.round(n * 1000) / 1000;
const descriptions = {
  wing_1: {
    en: "A broad aerial circuit above Grove, with roomy gates and gentle turns for the T15.",
    hu: "Tágas légi kör a Liget felett, széles kapukkal és nyugodt fordulókkal a T15 számára.",
    de: "Eine weite Luftrunde über Grove mit großen Toren und sanften Kurven für die T15.",
    fr: "Un grand circuit aérien au-dessus du parc, avec de larges portes et des virages doux pour le T15.",
    es: "Un circuito aéreo amplio sobre Grove, con puertas grandes y curvas suaves para el T15.",
  },
  wing_2: {
    en: "A rising and falling figure eight above the lakes. Cross the centre at different heights and keep room for each turn.",
    hu: "Emelkedő és süllyedő nyolcas a tavak fölött. A középső keresztezést eltérő magasságban repüld, és hagyj helyet a fordulóknak.",
    de: "Eine steigende und sinkende Acht über den Seen mit versetzten Kreuzungshöhen und weiten Kurven.",
    fr: "Un huit montant et descendant au-dessus des lacs, avec des croisements à des hauteurs différentes.",
    es: "Un ocho con ascensos y descensos sobre los lagos y cruces centrales a distintas alturas.",
  },
};
for (const [id, name, count, point, difficulty] of [
  [
    "wing_1",
    "Grove Air Circuit",
    16,
    (t) => [230 * Math.sin(t), 52, 220 * Math.cos(t)],
    "easy",
  ],
  [
    "wing_2",
    "Lakeside Figure Eight",
    24,
    (t) => [240 * Math.sin(t), 60 + 22 * Math.cos(t), 135 * Math.sin(2 * t)],
    "medium",
  ],
]) {
  const gates = Array.from({ length: count }, (_, i) => {
    const t = (i / count) * Math.PI * 2,
      p = point(t),
      a = point(t - 0.001),
      b = point(t + 0.001),
      d = b.map((v, j) => v - a[j]),
      length = Math.hypot(...d);
    return {
      p: p.map(round),
      n: d.map((v) => v / length),
      width: 18,
      height: 14,
    };
  });
  const guide = gates.map((gate, i) => [
    gate.p,
    ...[1, 2, 3].map((j) =>
      point(((i + j / 4) / count) * Math.PI * 2).map(round),
    ),
    gates[(i + 1) % count].p,
  ]);
  const route = validateRoute(
    {
      id,
      name,
      version: 1,
      aircraftKinds: ["fixedWing"],
      spawn: gates[0].p.map((v, i) => round(v - gates[0].n[i] * 30)),
      gates,
      guide,
      details: {
        difficulty,
        recommendedDrones: ["rift-t15"],
        description: descriptions[id],
      },
    },
    map,
  );
  await writeFile(
    new URL("../data/maps/liget/" + id + ".json", import.meta.url),
    JSON.stringify(route, null, 2) + "\n",
  );
}
