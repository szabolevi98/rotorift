import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import RAPIER from "@dimforge/rapier3d-compat";
import { buildEnvironment } from "./environment.js";
import { parkSurfaceHeight } from "../../shared/world/park-layout.js";
import { read } from "../storage.js";

const translations = {
  hu: ["Park áttekintése", "Épület és átjáró", "Kerti pergola", "Tó és keleti liget", "Dombos erdő", "Kerítés és külső táj", "Egér: forgatás · Görgő: közelítés · Jobb gomb: mozgatás", "Repülés ↗", "A Liget betöltése…", "A pályanézet nem tölthető be. Frissítsd az oldalt."],
  en: ["Park overview", "Pavilion and passage", "Garden pergola", "Lake and east grove", "Wooded hills", "Fence and landscape", "Mouse: rotate · Scroll: zoom · Right button: pan", "Fly ↗", "Loading Liget…", "Cannot load the park view. Reload the page."],
  de: ["Parkübersicht", "Pavillon und Durchgang", "Gartenpergola", "See und östlicher Hain", "Bewaldete Hügel", "Zaun und Landschaft", "Maus: drehen · Rad: zoomen · Rechte Taste: verschieben", "Fliegen ↗", "Liget wird geladen…", "Die Parkansicht konnte nicht geladen werden. Lade die Seite neu."],
  fr: ["Vue du parc", "Pavillon et passage", "Pergola du jardin", "Lac et bosquet est", "Collines boisées", "Clôture et paysage", "Souris : tourner · Molette : zoomer · Bouton droit : déplacer", "Voler ↗", "Chargement de Liget…", "Impossible de charger le parc. Recharge la page."],
  es: ["Vista del parque", "Pabellón y pasaje", "Pérgola del jardín", "Lago y arboleda este", "Colinas arboladas", "Valla y paisaje", "Ratón: girar · Rueda: zoom · Botón derecho: desplazar", "Volar ↗", "Cargando Liget…", "No se puede cargar el parque. Recarga la página."],
};
const language = read("language", "hu"), labels = translations[language] ?? translations.en;
document.documentElement.lang = translations[language] ? language : "en";
document.querySelectorAll("[data-view]").forEach((button, i) => { button.textContent = labels[i]; });
document.querySelector("#hint").textContent = labels[6];
document.querySelector("#fly").textContent = labels[7];
document.querySelector("#status").textContent = labels[8];
document.querySelector("#scene").setAttribute("aria-label", `Liget · ${labels[0]}`);
document.querySelector("nav").setAttribute("aria-label", labels[0]);
document.title = `Liget · Rotorift · ${labels[0]}`;

try {
  await RAPIER.init();
  const { maps } = await (await fetch("/api/catalog")).json();
  const map = maps.find((m) => m.id === "liget");
  const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector("#scene"), antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xbcd4df);
  scene.fog = new THREE.FogExp2(0xbcd4df, 0.0018);
  scene.add(new THREE.HemisphereLight(0xfaf8e5, 0x768367, 2.4));
  const sun = new THREE.DirectionalLight(0xfff0d5, 3); sun.position.set(-90, 150, 80);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -100, right: 100, top: 100, bottom: -100, near: 1, far: 400 });
  sun.shadow.bias = -0.0003; scene.add(sun);
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const environment = buildEnvironment(scene, world, RAPIER, map);
  environment.highlight(0, false);
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 2500);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 3; controls.maxDistance = 900;
  const views = {
    park: [[185, 110, 205], [0, 2, 0]],
    pavilion: [[43, 21, 55], [0, 3, 0]],
    garden: [[-75, 21, -43], [-52, 3, -67]],
    lake: [[245, 55, 207], [190, 3, 145]],
    hill: [[-265, 58, 225], [-210, 12, 180]],
    fence: [[40, 21, 382], [0, parkSurfaceHeight(0, 350) + 1, 350]],
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
  document.querySelector("#status").textContent = labels[9];
}
