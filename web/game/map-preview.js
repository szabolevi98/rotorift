import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import RAPIER from "@dimforge/rapier3d-compat";
import { buildEnvironment } from "./environment.js";
import { parkSurfaceHeight, PARK_GARDEN } from "../../shared/world/park-layout.js";
import { read } from "../storage.js";
import { PARK_VIEW_DISTANCE, PARK_FOG_DENSITY } from "./park-terrain.js";

const translations = {
  hu: ["Park áttekintése", "Épület és átjáró", "Kerti pergola", "Kis tó és híd", "Dombtetői pavilon", "Kerítés és külső táj", "Nagy tó és szökőkút", "Kávézó és terasz", "Fedett sétány", "Egér: forgatás · Görgő: közelítés · Jobb gomb: mozgatás", "Repülés ↗", "A Liget betöltése…", "A pályanézet nem tölthető be. Frissítsd az oldalt."],
  en: ["Park overview", "Pavilion and passage", "Garden pergola", "Small lake and bridge", "Hilltop pavilion", "Fence and landscape", "Grand lake and fountain", "Cafe and terrace", "Shade arcade", "Mouse: rotate · Scroll: zoom · Right button: pan", "Fly ↗", "Loading Liget…", "Cannot load the park view. Reload the page."],
  de: ["Parkübersicht", "Pavillon und Durchgang", "Gartenpergola", "Kleiner See und Brücke", "Hügelpavillon", "Zaun und Landschaft", "Großer See und Fontäne", "Café und Terrasse", "Überdachter Weg", "Maus: drehen · Rad: zoomen · Rechte Taste: verschieben", "Fliegen ↗", "Liget wird geladen…", "Die Parkansicht konnte nicht geladen werden. Lade die Seite neu."],
  fr: ["Vue du parc", "Pavillon et passage", "Pergola du jardin", "Petit lac et pont", "Pavillon sur la colline", "Clôture et paysage", "Grand lac et fontaine", "Café et terrasse", "Allée couverte", "Souris : tourner · Molette : zoomer · Bouton droit : déplacer", "Voler ↗", "Chargement de Liget…", "Impossible de charger le parc. Recharge la page."],
  es: ["Vista del parque", "Pabellón y pasaje", "Pérgola del jardín", "Lago pequeño y puente", "Pabellón en la colina", "Valla y paisaje", "Lago grande y fuente", "Café y terraza", "Paseo cubierto", "Ratón: girar · Rueda: zoom · Botón derecho: desplazar", "Volar ↗", "Cargando Liget…", "No se puede cargar el parque. Recarga la página."],
};
const language = read("language", "hu"), labels = translations[language] ?? translations.en;
const communityLabels = { hu: "Sportliget és parkoló", en: "Sports garden and parking", de: "Sportgarten und Parkplatz", fr: "Espace sportif et parking", es: "Zona deportiva y aparcamiento" };
document.documentElement.lang = translations[language] ? language : "en";
document.querySelectorAll("[data-view]").forEach((button, i) => {
  button.textContent = button.dataset.view === "community" ? (communityLabels[language] ?? communityLabels.en) : labels[i];
});
document.querySelector("#hint").textContent = labels[9];
document.querySelector("#fly").textContent = labels[10];
document.querySelector("#status").textContent = labels[11];
document.querySelector("#scene").setAttribute("aria-label", `Liget · ${labels[0]}`);
document.querySelector("nav").setAttribute("aria-label", labels[0]);
document.title = `Liget · Rotorift · ${labels[0]}`;

try {
  await RAPIER.init();
  const { maps } = await (await fetch("/api/catalog")).json();
  const map = maps.find((m) => m.id === "liget");
  const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector("#scene"), antialias: true, logarithmicDepthBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xbcd4df);
  scene.fog = new THREE.FogExp2(0xbcd4df, PARK_FOG_DENSITY);
  scene.add(new THREE.HemisphereLight(0xfaf8e5, 0x768367, 2.4));
  const sun = new THREE.DirectionalLight(0xfff0d5, 3); sun.position.set(-90, 150, 80);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -100, right: 100, top: 100, bottom: -100, near: 1, far: 400 });
  sun.shadow.bias = -0.0003; scene.add(sun);
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const environment = buildEnvironment(scene, world, RAPIER, map);
  environment.highlight(0, false);
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, PARK_VIEW_DISTANCE);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 3; controls.maxDistance = 900;
  const views = {
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
    sun.target.position.set(...target); sun.target.updateMatrixWorld();
    sun.position.set(target[0] - 90, target[1] + 150, target[2] + 80);
  }
  for (const button of document.querySelectorAll("[data-view]"))
    button.onclick = () => setView(button.dataset.view);
  setView("park");
  document.querySelector("#status").remove();
  function frame() {
    if (renderer.domElement.width !== Math.round(innerWidth * renderer.getPixelRatio()) ||
      renderer.domElement.height !== Math.round(innerHeight * renderer.getPixelRatio())) {
      renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    }
    controls.update(); environment.update(controls.target.toArray());
    renderer.render(scene, camera); requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
} catch (error) {
  console.error(error);
  document.querySelector("#status").textContent = labels[12];
}
