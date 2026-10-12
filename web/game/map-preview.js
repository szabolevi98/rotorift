import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import RAPIER from "@dimforge/rapier3d-compat";
import { buildEnvironment } from "./environment.js";
import { parkSurfaceHeight, PARK_GARDEN } from "../../shared/world/park-layout.js";
import { read } from "../storage.js";
import { PARK_VIEW_DISTANCE, PARK_FOG_DENSITY } from "./park-terrain.js";
import { ParkShadows } from "./park-shadows.js";
import { CONSTRUCTION_VIEW_DISTANCE, CONSTRUCTION_FOG_DENSITY } from "./construction.js";
import { configureDroneRenderer, addDroneReflections } from "../../shared/visual/drone-rendering.js";

const construction = new URLSearchParams(location.search).get("map") === "betonudvar";
const constructionCopy = {
  hu: ["Építkezés áttekintése", "Nyitott betonvázak", "Toronydaruk", "Munkagépek", "Alapozás és munkagödör", "Anyagraktár és csövek", "Acélvázas csarnok", "Irodák és bejárat", "A Betonudvar betöltése…", "A pályanézet nem tölthető be. Frissítsd az oldalt."],
  en: ["Construction overview", "Open concrete frames", "Tower cranes", "Construction vehicles", "Foundations and excavation", "Materials and pipes", "Steel warehouse frame", "Offices and entry", "Loading Betonudvar…", "Cannot load the site. Reload the page."],
  de: ["Baustellenübersicht", "Offene Betonbauten", "Turmkräne", "Baumaschinen", "Fundamente und Baugrube", "Materiallager und Rohre", "Stahlbauhalle", "Büros und Zufahrt", "Betonudvar wird geladen…", "Die Baustelle konnte nicht geladen werden. Lade die Seite neu."],
  fr: ["Vue du chantier", "Ossatures en béton", "Grues à tour", "Engins de chantier", "Fondations et excavation", "Matériaux et tuyaux", "Ossature du hangar", "Bureaux et entrée", "Chargement de Betonudvar…", "Impossible de charger le chantier. Recharge la page."],
  es: ["Vista de la obra", "Estructuras de hormigón", "Grúas torre", "Maquinaria de obra", "Cimientos y excavación", "Materiales y tuberías", "Estructura de la nave", "Oficinas y entrada", "Cargando Betonudvar…", "No se puede cargar la obra. Recarga la página."],
};

const translations = {
  hu: ["Park áttekintése", "Épület és átjáró", "Kerti pergola", "Kis tó és híd", "Dombtetői pavilon", "Kerítés és külső táj", "Nagy tó és szökőkút", "Kávézó és terasz", "Fedett sétány", "Egér: forgatás · Görgő: közelítés · Jobb gomb: mozgatás", "Repülés ↗", "A Liget betöltése…", "A pályanézet nem tölthető be. Frissítsd az oldalt."],
  en: ["Park overview", "Pavilion and passage", "Garden pergola", "Small lake and bridge", "Hilltop pavilion", "Fence and landscape", "Grand lake and fountain", "Cafe and terrace", "Shade arcade", "Mouse: rotate · Scroll: zoom · Right button: pan", "Fly ↗", "Loading Liget…", "Cannot load the park view. Reload the page."],
  de: ["Parkübersicht", "Pavillon und Durchgang", "Gartenpergola", "Kleiner See und Brücke", "Hügelpavillon", "Zaun und Landschaft", "Großer See und Fontäne", "Café und Terrasse", "Überdachter Weg", "Maus: drehen · Rad: zoomen · Rechte Taste: verschieben", "Fliegen ↗", "Liget wird geladen…", "Die Parkansicht konnte nicht geladen werden. Lade die Seite neu."],
  fr: ["Vue du parc", "Pavillon et passage", "Pergola du jardin", "Petit lac et pont", "Pavillon sur la colline", "Clôture et paysage", "Grand lac et fontaine", "Café et terrasse", "Allée couverte", "Souris : tourner · Molette : zoomer · Bouton droit : déplacer", "Voler ↗", "Chargement de Liget…", "Impossible de charger le parc. Recharge la page."],
  es: ["Vista del parque", "Pabellón y pasaje", "Pérgola del jardín", "Lago pequeño y puente", "Pabellón en la colina", "Valla y paisaje", "Lago grande y fuente", "Café y terraza", "Paseo cubierto", "Ratón: girar · Rueda: zoom · Botón derecho: desplazar", "Volar ↗", "Cargando Liget…", "No se puede cargar el parque. Recarga la página."],
};
const language = read("language", "hu"), labels = translations[language] ?? translations.en;
const siteLabels = constructionCopy[language] ?? constructionCopy.en;
const mapName = construction ? "Betonudvar" : "Liget", overview = construction ? siteLabels[0] : labels[0];
if (construction) {
  const names = ["site", "frames", "cranes", "machines", "pit", "storage", "warehouse", "offices"];
  document.querySelector("nav").replaceChildren(...names.map((name, i) => {
    const button = document.createElement("button"); button.dataset.view = name; button.textContent = siteLabels[i]; return button;
  }));
}
const communityLabels = { hu: "Sportliget és parkoló", en: "Sports garden and parking", de: "Sportgarten und Parkplatz", fr: "Espace sportif et parking", es: "Zona deportiva y aparcamiento" };
document.documentElement.lang = translations[language] ? language : "en";
document.querySelectorAll("[data-view]").forEach((button, i) => {
  button.textContent = construction ? siteLabels[i] : button.dataset.view === "community" ? (communityLabels[language] ?? communityLabels.en) : labels[i];
});
document.querySelector("#hint").textContent = labels[9];
document.querySelector("#fly").textContent = labels[10];
document.querySelector("#status").textContent = construction ? siteLabels[8] : labels[11];
document.querySelector("#scene").setAttribute("aria-label", `${mapName} · ${overview}`);
document.querySelector("#map-title").textContent = `ROTORIFT. / ${mapName.toUpperCase()}`;
document.querySelector("nav").setAttribute("aria-label", overview);
document.title = `${mapName} · Rotorift · ${overview}`;

try {
  await RAPIER.init();
  const { maps } = await (await fetch("/api/catalog")).json();
  const map = maps.find((m) => m.id === (construction ? "betonudvar" : "liget"));
  document.querySelector("#map-size").textContent = `${map.size} × ${map.size} m`;
  const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector("#scene"), antialias: true, logarithmicDepthBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  configureDroneRenderer(THREE, renderer);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(construction ? 0xc9dedc : 0xbcd4df);
  addDroneReflections(THREE, renderer, scene);
  scene.fog = new THREE.FogExp2(scene.background, construction ? CONSTRUCTION_FOG_DENSITY : PARK_FOG_DENSITY);
  scene.add(new THREE.HemisphereLight(0xfaf8e5, 0x768367, 2.4));
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const environment = buildEnvironment(scene, world, RAPIER, map);
  environment.highlight(0, false);
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, construction ? CONSTRUCTION_VIEW_DISTANCE : PARK_VIEW_DISTANCE);
  const shadows = new ParkShadows(scene, camera);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 3; controls.maxDistance = 1200;
  const views = construction ? {
    site: [[410, 390, 470], [0, 15, 0]],
    frames: [[14, 42, 58], [-55, 22, -35]],
    cranes: [[-122, 81, 30], [-75, 63, -70]],
    machines: [[-119, 10, 70], [-142, 2, 101]],
    pit: [[-123, 31, 135], [-178, -1, 100]],
    storage: [[132, 14, 219], [170, 2, 187]],
    warehouse: [[85, 26, -141], [135, 7, -185]],
    offices: [[-78, 24, 299], [-170, 3, 244]],
  } : {
    park: [[0, 520, 125], [0, 2, 0]],
    pavilion: [[43, 21, 55], [0, 3, 0]],
    garden: [[PARK_GARDEN.x - 23, 21, PARK_GARDEN.z + 24], [PARK_GARDEN.x, 3, PARK_GARDEN.z]],
    lake: [[249, 43, 240], [190, 2, 175]],
    hill: [[-265, 58, 225], [-210, 12, 180]],
    fence: [[40, 21, 382], [0, parkSurfaceHeight(0, 350) + 1, 350]],
    largeLake: [[15, 80, 0], [-155, 3, -130]],
    cafe: [[145, 11, -118], [110, 4, -155]],
    arcade: [[205, parkSurfaceHeight(170, -76) + 18, -43], [170, parkSurfaceHeight(170, -76) + 2, -76]],
    community: [[-115, 78, 315], [0, 3, 216]],
  };
  function setView(name) {
    const [position, target] = views[name];
    camera.position.set(...position); controls.target.set(...target); controls.update();
    environment.update(target);
    document.querySelectorAll("[data-view]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.view === name)));
  }
  for (const button of document.querySelectorAll("[data-view]"))
    button.onclick = () => setView(button.dataset.view);
  setView(construction ? "site" : "park");
  document.querySelector("#status").remove();
  function frame() {
    if (renderer.domElement.width !== Math.round(innerWidth * renderer.getPixelRatio()) ||
      renderer.domElement.height !== Math.round(innerHeight * renderer.getPixelRatio())) {
      renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    }
    controls.update(); environment.update(controls.target.toArray());
    shadows.update();
    renderer.render(scene, camera); requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
} catch (error) {
  console.error(error);
  document.querySelector("#status").textContent = construction ? siteLabels[9] : labels[12];
}
