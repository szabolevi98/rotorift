// Shared by flight, the menu preview and the standalone showcase build.
export const DRONE_SURFACES = {
  pcb: { name: "Rotorift_green_PCB", color: "#143a35", metalness: 0.15, roughness: 0.63 },
  lens: { name: "Rotorift_optical_glass", color: "#25465e", metalness: 0.55, roughness: 0.08, clearcoat: 1 },
};

export function configureDroneRenderer(THREE, renderer) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}

export function addDroneReflections(THREE, renderer, scene) {
  // Hemisphere lights illuminate diffuse surfaces, but provide no reflections.
  // A small procedural sky/ground environment keeps lenses and metal readable
  // without external HDR assets or a cubemap rendered every frame.
  const room = new THREE.Scene();
  const geometry = new THREE.SphereGeometry(10, 32, 16);
  const positions = geometry.getAttribute("position");
  const colors = new Float32Array(positions.count * 3);
  const sky = new THREE.Color("#b6d8ee"), horizon = new THREE.Color("#e0e7e1"), ground = new THREE.Color("#687a53");
  for (let i = 0; i < positions.count; i++) {
    const elevation = positions.getY(i) / 10;
    const color = horizon.clone().lerp(elevation >= 0 ? sky : ground, Math.abs(elevation));
    color.toArray(colors, i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide });
  room.add(new THREE.Mesh(geometry, material));
  const panelMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.8, 3.5) });
  const panelGeometry = new THREE.PlaneGeometry(3, 3);
  const panel = new THREE.Mesh(panelGeometry, panelMaterial);
  panel.position.set(-3.5, 7.5, 2.5); panel.lookAt(0, 0, 0); room.add(panel);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(room, 0.04, 0.1, 30);
  scene.environment = target.texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose(); geometry.dispose(); material.dispose(); panelGeometry.dispose(); panelMaterial.dispose();
  return target;
}
