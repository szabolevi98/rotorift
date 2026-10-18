import * as THREE from "three";
import { makeTreeCrown, makeTreeTrunk, treeCanopyLobes } from "./tree-models.js";
import { ColliderRegions } from "../../shared/world/collider-regions.js";
import { buildParkLandmarks } from "./park-landmarks.js";
import { buildParkCommunity } from "./park-community.js";
import { appendTerrainVertex, makeParkDistantTerrain } from "./park-terrain.js";
import { makeSurfaceGeometry } from "./surface-geometry.js";
import { parkPaving, parkGravel, parkCurbs } from "../../shared/world/map-surfaces.js";
import {
  PARK_CHUNK_SIZE, PARK_GRID_STEPS, PARK_PATHS, PARK_LAKES, PARK_TREE_POSITIONS, PARK_SHRUB_POSITIONS,
  PARK_BENCHES, PARK_GARDEN, sampleParkPath, pathClearance,
  parkSurfaceHeight, parkClearance, chunkRandom, lakeOutline,
} from "../../shared/world/park-layout.js";

function groundTexture(kind) {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d"), rng = chunkRandom(17, kind === "grass" ? 1 : 2);
  ctx.fillStyle = kind === "grass" ? "#b1bca0" : "#cfc8b5";
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 9000; i++) {
    const value = Math.floor(110 + rng() * 110);
    ctx.fillStyle = `rgba(${value},${value},${value},${kind === "grass" ? 0.28 : 0.24})`;
    ctx.fillRect(rng() * 128, rng() * 128, 1, kind === "grass" ? 2 : 1);
  }
  if (kind === "paving") {
    ctx.strokeStyle = "#8e8b7e"; ctx.lineWidth = 0.7;
    for (let row = 0; row < 8; row++) {
      ctx.beginPath(); ctx.moveTo(0, row * 16); ctx.lineTo(128, row * 16); ctx.stroke();
      for (let col = 0; col < 5; col++) {
        const x = col * 32 + (row % 2) * 16;
        ctx.beginPath(); ctx.moveTo(x, row * 16); ctx.lineTo(x, row * 16 + 16); ctx.stroke();
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function treeTexture(bark = false) {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d"), rng = chunkRandom(28, bark ? 3 : 4);
  ctx.fillStyle = "#dddcd0"; ctx.fillRect(0, 0, 128, 128);
  if (bark) {
    for (let i = 0; i < 200; i++) {
      ctx.strokeStyle = `rgba(52,45,35,${0.12 + rng() * 0.24})`;
      const x = rng() * 128, y = rng() * 128;
      ctx.lineWidth = 0.5 + rng() * 1.5; ctx.beginPath(); ctx.moveTo(x, y);
      ctx.lineTo(x + rng() * 2 - 1, y + 12 + rng() * 42); ctx.stroke();
    }
  } else {
    for (let i = 0; i < 1600; i++) {
      const gray = 110 + Math.floor(rng() * 140);
      ctx.fillStyle = `rgba(${gray},${gray},${gray},0.65)`;
      ctx.beginPath(); ctx.ellipse(rng() * 128, rng() * 128, 1 + rng() * 2.5, 0.6 + rng() * 1.5, rng() * 6, 0, Math.PI * 2); ctx.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8; return texture;
}

export function makeParkTerrain(cx, cz) {
  const count = PARK_GRID_STEPS + 1, step = PARK_CHUNK_SIZE / PARK_GRID_STEPS;
  const positions = [], normals = [], colors = [], uv = [], indices = [];
  const buffers = { positions, normals, colors, uv };
  for (let z = 0; z < count; z++) for (let x = 0; x < count; x++) {
    const wx = cx * PARK_CHUNK_SIZE + x * step, wz = cz * PARK_CHUNK_SIZE + z * step;
    appendTerrainVertex(buffers, wx, wz);
    if (x < count - 1 && z < count - 1) {
      const a = z * count + x, b = a + 1, c = a + count, d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(indices);
  return g;
}

function clipPolygon(polygon, distance) {
  const result = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const da = distance(a), db = distance(b);
    if (da >= 0) result.push(a);
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db);
      result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return result;
}

export function ribbon(points, width, lateral = 0, lift = 0.065) {
  const samples = sampleParkPath(points), steps = samples.length - 1;
  const edges = [], positions = [], uv = [], indices = [];
  for (let i = 0; i <= steps; i++) {
    const p = samples[i];
    for (const side of [-1, 1]) {
      const offset = lateral + side * width / 2;
      const x = p.x - p.tz * offset, z = p.z + p.tx * offset;
      edges.push([x, z]);
    }
  }
  // Split the path at every ground-triangle edge. Interpolating only its two
  // outer edges makes a wide path slice through hills between those edges.
  const cell = PARK_CHUNK_SIZE / PARK_GRID_STEPS;
  const emit = (polygon) => {
    for (let i = 1; i < polygon.length - 1; i++) {
      const tri = [polygon[0], polygon[i], polygon[i + 1]];
      const [a, b, c] = tri;
      if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) < 1e-8) continue;
      for (const [x, z] of tri) {
        indices.push(positions.length / 3);
        positions.push(x, parkSurfaceHeight(x, z) + lift, z);
        uv.push(x / 2, z / 2);
      }
    }
  };
  for (let i = 0; i < steps; i++) {
    const a = i * 2;
    for (const tri of [[edges[a], edges[a + 1], edges[a + 2]], [edges[a + 1], edges[a + 3], edges[a + 2]]]) {
      const minX = Math.floor(Math.min(...tri.map((p) => p[0])) / cell);
      const maxX = Math.floor(Math.max(...tri.map((p) => p[0])) / cell);
      const minZ = Math.floor(Math.min(...tri.map((p) => p[1])) / cell);
      const maxZ = Math.floor(Math.max(...tri.map((p) => p[1])) / cell);
      for (let ix = minX; ix <= maxX; ix++) for (let iz = minZ; iz <= maxZ; iz++) {
        const x = ix * cell, z = iz * cell;
        let polygon = clipPolygon(tri, (p) => p[0] - x);
        polygon = clipPolygon(polygon, (p) => x + cell - p[0]);
        polygon = clipPolygon(polygon, (p) => p[1] - z);
        polygon = clipPolygon(polygon, (p) => z + cell - p[1]);
        const diagonal = x + z + cell;
        emit(clipPolygon(polygon, (p) => diagonal - p[0] - p[1]));
        emit(clipPolygon(polygon, (p) => p[0] + p[1] - diagonal));
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(indices); g.computeVertexNormals();
  return g;
}

export function buildPark(scene, world, RAPIER, map) {
  const root = new THREE.Group(); root.name = "Liget_700m"; scene.add(root);
  const chunks = new Map(), geometries = new Set(), materials = new Set(), textures = new Set();
  const geometry = (g) => { geometries.add(g); return g; };
  const material = (color, extra = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.92, ...extra });
    materials.add(m); return m;
  };
  const grassMap = groundTexture("grass"), pavingMap = groundTexture("paving"), gravelMap = groundTexture("gravel");
  const barkMap = treeTexture(true);
  for (const texture of [grassMap, pavingMap, gravelMap, barkMap]) if (texture) textures.add(texture);
  const palette = {
    grass: material(0xffffff, { map: grassMap, vertexColors: true }),
    paving: material(0xf0e8d6, { map: pavingMap, side: THREE.DoubleSide }),
    gravel: material(0xcdbd96, { map: gravelMap, side: THREE.DoubleSide }),
    curb: material(0xb8b4a6), concrete: material(0xddd8c8), wood: material(0x9c6840),
    cedar: material(0x8a5738), metal: material(0x313e3e), dark: material(0x44544b),
    glass: material(0x97c0c6, { transparent: true, opacity: 0.38, roughness: 0.15, metalness: 0.1, depthWrite: false }),
    bark: material(0xffffff, { map: barkMap }), leaves: material(0xffffff, { vertexColors: true, flatShading: true }), pine: material(0xffffff, { vertexColors: true, flatShading: true }),
    bush: material(0x6d844c, { flatShading: true }), water: material(0x729e9f, { roughness: 0.22, metalness: 0.3 }),
    stone: material(0x8b9084), flowers: material(0xd7bb72), tuft: material(0x8b995e),
  };
  const boxGeometry = geometry(new THREE.BoxGeometry(1, 1, 1));
  const cylinderGeometry = geometry(new THREE.CylinderGeometry(1, 1, 1, 12));
  const planterShrubGeometry = geometry(new THREE.IcosahedronGeometry(1, 1));
  const batches = new Map(), dummy = new THREE.Object3D();
  const collisionRegions = new ColliderRegions();
  function part(size, p, mat, solid = true, angle = 0, shape = "box") {
    const g = shape === "box" ? boxGeometry : shape === "bush" ? planterShrubGeometry : cylinderGeometry;
    const key = `${shape}:${mat.uuid}`;
    if (!batches.has(key)) batches.set(key, { g, mat, instances: [] });
    dummy.position.set(...p); dummy.scale.set(...size); dummy.rotation.set(0, angle, 0); dummy.updateMatrix();
    batches.get(key).instances.push(dummy.matrix.clone());
    if (solid && world) {
      const desc = shape === "box" ? RAPIER.ColliderDesc.cuboid(...size.map((v) => v / 2))
        : RAPIER.ColliderDesc.cylinder(size[1] / 2, size[0]);
      const collider = world.createCollider(desc.setTranslation(...p).setRotation({ x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) }).setFriction(0.85));
      const bounds = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(), new THREE.Vector3(shape === "box" ? 1 : 2, 1, shape === "box" ? 1 : 2)).applyMatrix4(dummy.matrix);
      collisionRegions.add(collider, bounds.min.toArray(), bounds.max.toArray());
    }
  }
  function bench(x, z, angle = 0, lift = 0) {
    const y = parkSurfaceHeight(x, z) + lift, q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    const add = (size, offset, mat, solid = true) => {
      const p = new THREE.Vector3(...offset).applyQuaternion(q).add(new THREE.Vector3(x, y, z));
      part(size, p.toArray(), mat, solid, angle);
    };
    for (let i = 0; i < 5; i++) add([2.1, 0.07, 0.085], [0, 0.49, -0.2 + i * 0.1], palette.wood);
    for (let i = 0; i < 4; i++) add([2.1, 0.09, 0.055], [0, 0.73 + i * 0.115, 0.26], palette.wood);
    for (const side of [-0.8, 0.8]) {
      add([0.065, 0.46, 0.48], [side, 0.23, 0], palette.metal);
      add([0.055, 0.72, 0.055], [side, 0.77, 0.28], palette.metal);
      add([0.08, 0.055, 0.55], [side, 0.74, 0], palette.metal);
    }
  }
  // A contemporary park pavilion: two wings, with an unobstructed 8 m wide,
  // 4.2 m high north-south passage below the connecting upper floor.
  part([38, 0.12, 34], [0, 0.06, 0], palette.paving);
  for (const side of [-1, 1]) {
    part([13, 0.25, 26], [side * 11.5, 4.35, 0], palette.concrete);
    for (const z of [-12.3, -4, 4, 12.3]) {
      part([0.5, 4.2, 0.5], [side * 4.6, 2.1, z], palette.concrete);
      part([0.5, 8.1, 0.5], [side * 17.7, 4.05, z], palette.concrete);
    }
    part([0.2, 1.8, 26], [side * 18, 0.9, 0], palette.cedar);
    for (const z of [-12.8, 12.8]) {
      part([13, 1.1, 0.2], [side * 11.5, 0.55, z], palette.concrete);
      part([13, 2.8, 0.12], [side * 11.5, 2.5, z], palette.glass);
    }
    for (let i = 0; i < 27; i++)
      part([0.09, 2.2, 0.035], [side * 18.15, 2.3, -12.5 + i * 0.95], palette.cedar, false);
  }
  part([36.5, 0.28, 26], [0, 4.48, 0], palette.concrete);
  part([39, 0.32, 29], [0, 8.25, 0], palette.concrete);
  part([39.3, 0.22, 29.3], [0, 8.46, 0], palette.metal, false);
  // Retain the glazed wings and floating roof, but open a 10 m gallery route
  // through the upper storey, directly above the iconic ground passage.
  for (const z of [-12.8, 12.8]) {
    for(const side of [-1,1])part([13, 2.8, 0.1], [side*11.5, 6.25, z], palette.glass);
    for (const x of [-17.7, -12, -5, 5, 12, 17.7])
      part([0.075, 3.45, 0.1], [x, 6.5, z], palette.metal);
    part([36, 0.12, 0.12], [0, 7.9, z], palette.metal);
  }
  part([0.1, 3.2, 25], [-17.9, 6.15, 0], palette.glass);
  // A full-height side doorway joins the stair landing at Z=5.
  for(const [z,depth]of [[-4.65,15.7],[9.65,5.7]])
    part([0.1,3.2,depth],[17.9,6.15,z],palette.glass);
  for(const z of [3.2,6.8])part([.12,3.46,.12],[17.9,6.35,z],palette.metal);
  part([.12,.12,3.72],[17.9,7.9,5],palette.metal);
  for(const side of [-1,1]){
    bench(side*11,7,0,4.62);
    part([3.2,.42,1.1],[side*12,4.83,-7],palette.cedar);
    for(const dx of [-.9,0,.9])part([.8,.48,.47],[side*12+dx,5.25,-7],palette.bush,false,dx,'bush');
  }
  // Slatted soffit and side lights leave the entire flight corridor clear.
  for (let z = -12; z <= 12; z += 1.4)
    part([8.2, 0.085, 0.1], [0, 4.26, z], palette.wood);
  for (const x of [-4.5, 4.5]) part([0.08, 0.04, 23], [x, 4.2, 0], palette.flowers, false);
  // Grounded solid steps terminate at a supported landing exactly flush with
  // the 4.62 m gallery floor; its open left edge meets the new side doorway.
  const stairBase=.12,stairTop=4.62,tread=.30,count=28,firstZ=14.2;
  const lastZ=firstZ-(count-1)*tread,landingEdge=lastZ-tread/2;
  part([4,.12,1.7],[21,.06,firstZ+tread/2+.85],palette.concrete);
  for(let i=0;i<count;i++){
    const height=(stairTop-stairBase)*(i+1)/count;
    part([3,height,tread],[21,stairBase+height/2,firstZ-i*tread],palette.concrete);
  }
  part([4.25,.22,2],[20.375,stairTop-.11,landingEdge-1],palette.concrete);
  for(const z of [landingEdge-.2,landingEdge-1.8])
    part([.22,4.4,.22],[22.2,2.2,z],palette.concrete);
  const slopedRail=(a,b)=>{
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);
    const rail=new THREE.Mesh(boxGeometry,palette.metal);rail.position.copy(start).add(end).multiplyScalar(.5);
    rail.scale.set(.075,delta.length(),.075);rail.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
    rail.castShadow=rail.receiveShadow=true;root.add(rail);rail.updateMatrixWorld(true);
    if(world){
      const desc=RAPIER.ColliderDesc.cuboid(.0375,rail.scale.y/2,.0375).setTranslation(...rail.position.toArray()).setRotation(rail.quaternion).setFriction(.85);
      const collider=world.createCollider(desc),bounds=new THREE.Box3().setFromObject(rail);
      collisionRegions.add(collider,bounds.min.toArray(),bounds.max.toArray());
    }
  };
  for(const x of [19.43,22.57]){
    for(const i of [0,7,14,21,27]){
      const top=stairBase+(stairTop-stairBase)*(i+1)/count;
      part([.075,1.05,.075],[x,top+.525,firstZ-i*tread],palette.metal);
    }
    slopedRail([x,stairBase+(stairTop-stairBase)/count+1.05,firstZ],[x,stairTop+1.05,lastZ]);
  }
  for(const z of [landingEdge,landingEdge-2])part([.075,1.05,.075],[22.57,stairTop+.525,z],palette.metal);
  part([.075,.075,2.15],[22.57,stairTop+1.05,lastZ-1.075],palette.metal);
  part([4.32,.075,.075],[20.41,stairTop+1.05,landingEdge-2],palette.metal);
  bench(-10, 19, Math.PI); bench(10, 19, Math.PI);
  // Curving promenades, gravel trails, and narrow stone edging.
  for (const [polygons, mat] of [[parkPaving, palette.paving], [parkGravel, palette.gravel]]) {
    const mesh = new THREE.Mesh(geometry(makeSurfaceGeometry(polygons, parkSurfaceHeight)), mat);
    mesh.name = "park-path";
    mesh.receiveShadow = true; root.add(mesh);
    world?.createCollider(RAPIER.ColliderDesc.trimesh(
      mesh.geometry.attributes.position.array, new Uint32Array(mesh.geometry.index.array),
    ).setFriction(0.9));
  }
  const curb = new THREE.Mesh(geometry(makeSurfaceGeometry(parkCurbs, parkSurfaceHeight, 0.11)), palette.curb);
  curb.name = "park-curb"; curb.receiveShadow = true; root.add(curb);
  // West garden pergola, picnic tables, and seats along the main paths.
  const { x: gardenX, z: gardenZ } = PARK_GARDEN;
  const pergolaY = parkSurfaceHeight(gardenX, gardenZ);
  for (const x of [gardenX - 4, gardenX + 4]) for (const z of [gardenZ - 8, gardenZ, gardenZ + 8]) {
    const ground = parkSurfaceHeight(x, z), top = pergolaY + 3.25;
    part([0.18, top - ground, 0.18], [x, (ground + top) / 2, z], palette.wood);
  }
  for (const x of [gardenX - 4, gardenX + 4])
    part([0.22, 0.22, 22], [x, pergolaY + 3.2, gardenZ], palette.wood);
  for (let z = gardenZ - 10; z < gardenZ + 10; z += 0.75)
    part([10, 0.16, 0.13], [gardenX, pergolaY + 3.37, z], palette.wood);
  for (const { x, z, angle, tx, tz } of PARK_BENCHES) {
    bench(x, z, angle, 0.065);
    // Street furniture belongs in the seating bay, not on the promenade.
    const binX = x + tx * 1.45, binZ = z + tz * 1.45, binY = parkSurfaceHeight(binX, binZ) + 0.065;
    part([0.22, 0.74, 0.22], [binX, binY + 0.37, binZ], palette.metal, true, angle, "cylinder");
    part([0.25, 0.065, 0.25], [binX, binY + 0.77, binZ], palette.cedar, false, angle, "cylinder");
    part([0.13, 0.025, 0.13], [binX, binY + 0.815, binZ], palette.dark, false, angle, "cylinder");
  }
  for (const [x, z] of [[gardenX, gardenZ - 4], [gardenX, gardenZ + 4]]) {
    const y = parkSurfaceHeight(x, z) + 0.065;
    part([2.1, 0.08, 1], [x, y + 0.76, z], palette.wood);
    for (const side of [-0.75, 0.75]) {
      part([0.1, 0.72, 0.75], [x + side, y + 0.36, z], palette.metal);
      part([2.1, 0.08, 0.28], [x, y + 0.45, z + side], palette.wood);
    }
  }
  // Low planters and regularly spaced promenade lights give scale close up.
  for (const x of [-25, 25]) for (const z of [-25, 25]) {
    const y = parkSurfaceHeight(x, z);
    part([4.6, 0.12, 8], [x, y + 0.06, z], palette.concrete);
    for (const side of [-1, 1]) {
      part([0.18, 0.55, 8], [x + side * 2.21, y + 0.275, z], palette.concrete);
      part([4.24, 0.55, 0.18], [x, y + 0.275, z + side * 3.91], palette.concrete);
    }
    // Soil fills the open container, five cm below its rim.
    part([4.24, 0.38, 7.64], [x, y + 0.31, z], palette.dark, false);
    for (let i = 0; i < 7; i++)
      part([0.9, 0.58, 0.82], [x + Math.sin(i) * 0.28, parkSurfaceHeight(x, z) + 1.05, z - 3 + i], palette.bush, false, i, "bush");
  }
  for (let z = -300; z <= 300; z += 35) for (const side of [-1, 1]) {
    const x = side * 5.5, y = parkSurfaceHeight(x, z);
    if ((Math.abs(z) < 30) || pathClearance(x, z) < 1.5) continue;
    part([0.07, 3.4, 0.07], [x, y + 1.7, z], palette.metal);
    part([0.6, 0.12, 0.45], [x, y + 3.4, z], palette.metal, false);
    part([0.45, 0.025, 0.32], [x, y + 3.33, z], palette.flowers, false);
  }
  const waterMaterial = new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { time: { value: 0 } }]),
    vertexShader: `
      varying vec3 waterPosition;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      #include <fog_pars_vertex>
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        waterPosition = worldPosition.xyz;
        vec4 mvPosition = viewMatrix * worldPosition;
        gl_Position = projectionMatrix * mvPosition;
        #include <logdepthbuf_vertex>
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float time;
      varying vec3 waterPosition;
      #include <logdepthbuf_pars_fragment>
      #include <fog_pars_fragment>
      void main() {
        #include <logdepthbuf_fragment>
        float a = waterPosition.x * 2.1 + waterPosition.z * 0.8 + time * 0.7;
        float b = waterPosition.z * 3.3 - waterPosition.x * 0.5 - time * 0.5;
        vec3 normal = normalize(vec3(cos(a) * 0.018, 1.0, sin(b) * 0.011));
        vec3 viewDirection = normalize(cameraPosition - waterPosition);
        float fresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), 3.0);
        vec3 color = mix(vec3(0.08, 0.22, 0.2), vec3(0.53, 0.7, 0.76), fresnel);
        float sparkle = pow(max(dot(reflect(-normalize(vec3(-0.4, 0.85, 0.3)), normal), viewDirection), 0.0), 100.0);
        color += vec3(sparkle * 0.18 + (sin(a) + sin(b)) * 0.0025);
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  materials.add(waterMaterial);
  for (const lake of PARK_LAKES) {
    const outline = lakeOutline(lake, 1.08), positions = [lake.x, lake.waterY, lake.z], indices = [];
    for (const [x, z] of outline) positions.push(x, lake.waterY, z);
    for (let i = 1; i < outline.length; i++) indices.push(0, i + 1, i);
    const waterGeometry = geometry(new THREE.BufferGeometry());
    waterGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    waterGeometry.setIndex(indices); waterGeometry.computeVertexNormals();
    const water = new THREE.Mesh(waterGeometry, waterMaterial); water.name = lake.id; root.add(water);
    const shorelineRng = chunkRandom(lake.x, lake.z), shore = lakeOutline(lake, 1.11, 100);
    for (let i = 0; i < shore.length - 1; i++) {
      const [x, z] = shore[i], y = parkSurfaceHeight(x, z);
      if (i % 4 === 0)
        part([0.5, 0.2, 0.4], [x, y + 0.15, z], palette.stone, false, i, "bush");
      else if (shorelineRng() < 0.5) for (let blade = 0; blade < 4; blade++) {
        const height = 0.45 + shorelineRng() * 0.65;
        part([0.022, height, 0.022], [x + (blade - 1.5) * 0.12, y + height / 2, z], palette.bush, false);
      }
    }
  }
  const landmarks = buildParkLandmarks({ root, world, RAPIER, part, palette, geometry, material, materials, textures });
  buildParkCommunity({ root, world, RAPIER, part, palette, geometry, material, materials, textures });
  // Fence is deliberately permeable. It marks the play area without becoming
  // an invisible wall; only the bare terrain continues across it.
  const half = map.size / 2;
  for (let side = 0; side < 4; side++) for (let s = -half; s < half; s += 4) {
    const horizontal = side < 2, fixed = side % 2 ? half : -half;
    const point = (along) => horizontal ? [along, fixed] : [fixed, along];
    const [x, z] = point(s), y = parkSurfaceHeight(x, z);
    const angle = horizontal ? 0 : Math.PI / 2;
    part([0.14, 1.65, 0.14], [x, y + 0.825, z], palette.metal, false);
    part([0.21, 0.07, 0.21], [x, y + 1.68, z], palette.concrete, false);
    for (const railHeight of [0.35, 1.4]) {
      const [rx, rz] = point(s + 2);
      part([4, 0.06, 0.06], [rx, parkSurfaceHeight(rx, rz) + railHeight, rz], palette.metal, false, angle);
    }
    for (let i = 1; i <= 7; i++) {
      const [px, pz] = point(s + i * 0.5);
      part([0.026, 1.1, 0.026], [px, parkSurfaceHeight(px, pz) + 0.875, pz], palette.metal, false);
    }
  }
  for (const { g, mat, instances } of batches.values()) {
    const mesh = new THREE.InstancedMesh(g, mat, instances.length);
    instances.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.castShadow = mat !== palette.glass;
    mesh.receiveShadow = true; mesh.computeBoundingSphere(); root.add(mesh);
  }

  const treeTrunk = geometry(makeTreeTrunk()), pineTrunk = geometry(makeTreeTrunk("pine"));
  const oakCrown = geometry(makeTreeCrown("oak")), birchCrown = geometry(makeTreeCrown("birch")), pineCrown = geometry(makeTreeCrown("pine"));
  const bushGeometry = geometry(new THREE.IcosahedronGeometry(1, 1));
  const tuftGeometry = geometry(new THREE.BufferGeometry());
  const tuftVertices = [];
  for (let a = 0; a < 3; a++) {
    const dx = Math.cos(a * Math.PI / 3) * 0.08, dz = Math.sin(a * Math.PI / 3) * 0.08;
    tuftVertices.push(-dx, 0, -dz, dx, 0, dz, dx * 0.35, 0.32, dz * 0.35);
  }
  tuftGeometry.setAttribute("position", new THREE.Float32BufferAttribute(tuftVertices, 3)); tuftGeometry.computeVertexNormals();
  palette.tuft.side = THREE.DoubleSide;
  // Bare terrain extends far beyond the detailed chunks, without objects or
  // distant physics. Its inner boundary is stitched to the 7 × 7 near chunks.
  const distantTerrain = new THREE.Mesh(new THREE.BufferGeometry(), palette.grass);
  distantTerrain.name = "park-distant-terrain";
  distantTerrain.receiveShadow = true; root.add(distantTerrain);
  let centerKey = "", center = null, physicsCenter = null;
  function createChunk(cx, cz) {
    const group = new THREE.Group(), colliderHandles = [], colliderDescs = [], rng = chunkRandom(cx, cz);
    const terrainGeometry = makeParkTerrain(cx, cz);
    const terrain = new THREE.Mesh(terrainGeometry, palette.grass); terrain.receiveShadow = true; group.add(terrain);
    if (world) colliderDescs.push(RAPIER.ColliderDesc.trimesh(
      terrainGeometry.attributes.position.array, new Uint32Array(terrainGeometry.index.array),
    ).setFriction(0.9));
    const objects = { trunk: [], pineTrunk: [], oak: [], birch: [], pine: [], bush: [], tuft: [] };
    const add = (kind, x, y, z, scale, angle, color) => {
      dummy.position.set(x, y, z); dummy.scale.set(...scale); dummy.rotation.set(0, angle, 0); dummy.updateMatrix();
      objects[kind].push({ matrix: dummy.matrix.clone(), color });
    };
    const x0 = cx * PARK_CHUNK_SIZE, z0 = cz * PARK_CHUNK_SIZE;
    for (const [x, z] of PARK_TREE_POSITIONS) {
      if (x < x0 || x >= x0 + PARK_CHUNK_SIZE || z < z0 || z >= z0 + PARK_CHUNK_SIZE) continue;
      if (!parkClearance(x, z, map, 8)) continue;
      const kind = rng(), pine = kind > 0.77, birch = kind < 0.25;
      const height = (pine ? 10 : birch ? 8 : 7) + rng() * 6, aspect = birch ? 0.68 : 0.95 + rng() * 0.3;
      const y = parkSurfaceHeight(x, z), angle = rng() * Math.PI * 2;
      const scale = [height * aspect, height, height * aspect];
      add(pine ? "pineTrunk" : "trunk", x, y, z, scale, angle, birch ? 0xd6d3be : 0x6a5341);
      add(pine ? "pine" : birch ? "birch" : "oak", x, y, z, scale, angle,
        pine ? 0x557a66 : birch ? 0x95ab67 : [0x8fa969, 0x6f8d50, 0x94a963, 0x648657][Math.floor(rng() * 4)]);
      if (world) {
      colliderDescs.push(RAPIER.ColliderDesc.cylinder(height * 0.34, height * aspect * 0.027)
        .setTranslation(x, y + height * 0.34, z));
      if (pine) colliderDescs.push(RAPIER.ColliderDesc.cone(height * 0.4, height * aspect * 0.245).setTranslation(x, y + height * 0.63, z));
      else for (const [lx, ly, lz, radius] of treeCanopyLobes[birch ? "birch" : "oak"]) {
        const px = (lx * Math.cos(angle) + lz * Math.sin(angle)) * height * aspect;
        const pz = (-lx * Math.sin(angle) + lz * Math.cos(angle)) * height * aspect;
        colliderDescs.push(RAPIER.ColliderDesc.ball(radius * height * Math.min(1, aspect)).setTranslation(x + px, y + ly * height, z + pz));
      }
      }
    }
    for (let i = 0; i < 16; i++) {
      const x = x0 + rng() * PARK_CHUNK_SIZE, z = z0 + rng() * PARK_CHUNK_SIZE;
      if (!parkClearance(x, z, map, 2.5)) continue;
      const h = 0.6 + rng() * 0.9;
      add("bush", x, parkSurfaceHeight(x, z) + h * 0.55, z, [h * 1.1, h * 0.65, h], rng() * 6,
        rng() > 0.6 ? 0xa9af74 : 0x78915b);
    }
    for (const {x,z,height:h,angle,shade} of PARK_SHRUB_POSITIONS) {
      if (x<x0||x>=x0+PARK_CHUNK_SIZE||z<z0||z>=z0+PARK_CHUNK_SIZE) continue;
      if (!parkClearance(x,z,map,2.2)) continue;
      const color=[0x78915b,0x8d9b63,0x667e48][shade];
      add('bush',x,parkSurfaceHeight(x,z)+h*.53,z,[h*1.3,h*.65,h*1.1],angle,color);
      const lx=x+Math.cos(angle)*h*.8,lz=z+Math.sin(angle)*h*.8;
      add('bush',lx,parkSurfaceHeight(lx,lz)+h*.35,lz,[h*.8,h*.45,h*.85],angle+.8,color);
    }
    for (let i = 0; i < 180; i++) {
      const x = x0 + rng() * PARK_CHUNK_SIZE, z = z0 + rng() * PARK_CHUNK_SIZE;
      if (!parkClearance(x, z, map, 0.25)) continue;
      const scale = 0.65 + rng();
      add("tuft", x, parkSurfaceHeight(x, z), z, [scale, scale, scale], rng() * 6,
        rng() < 0.04 ? 0xddcd94 : 0xadb77e);
    }
    const types = { trunk: [treeTrunk, palette.bark], pineTrunk: [pineTrunk, palette.bark], oak: [oakCrown, palette.leaves],
      birch: [birchCrown, palette.leaves], pine: [pineCrown, palette.pine], bush: [bushGeometry, palette.bush], tuft: [tuftGeometry, palette.tuft] };
    let grass;
    for (const [kind, instances] of Object.entries(objects)) {
      if (!instances.length) continue;
      const [g, mat] = types[kind], mesh = new THREE.InstancedMesh(g, mat, instances.length);
      for (let i = 0; i < instances.length; i++) {
        mesh.setMatrixAt(i, instances[i].matrix); mesh.setColorAt(i, new THREE.Color(instances[i].color));
      }
      mesh.castShadow = kind === "trunk" || kind === "pineTrunk" || kind === "oak" || kind === "birch" || kind === "pine";
      mesh.receiveShadow = true; mesh.computeBoundingSphere(); group.add(mesh);
      if (kind === "tuft") grass = mesh;
    }
    root.add(group);
    return { group, terrain, terrainGeometry, colliderHandles, colliderDescs, grass, cx, cz, treeCount: objects.trunk.length + objects.pineTrunk.length };
  }
  function deactivatePhysics(chunk) {
    for (const handle of chunk.colliderHandles) {
      const collider = world.getCollider(handle);
      if (collider) world.removeCollider(collider, true);
    }
    chunk.colliderHandles.length = 0;
  }
  function removeChunk(chunk) {
    root.remove(chunk.group);
    deactivatePhysics(chunk);
    chunk.group.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
    chunk.terrainGeometry.dispose();
  }
  function update(position, velocity, observerPosition = null) {
    collisionRegions.update(position, velocity);
    waterMaterial.uniforms.time.value = performance.now() / 1000;
    landmarks.update(waterMaterial.uniforms.time.value);
    // A resting drone can jitter across a grid edge by fractions of a mm.
    // Keep a buffer so that noise never unloads/rebuilds an entire chunk row.
    const renderPosition = observerPosition ?? position;
    const axis = (p,old) => old !== undefined && p >= old*PARK_CHUNK_SIZE-16 && p <= (old+1)*PARK_CHUNK_SIZE+16 ? old : Math.floor(p/PARK_CHUNK_SIZE);
    const cx = axis(renderPosition[0],center?.cx), cz = axis(renderPosition[2],center?.cz);
    const px = axis(position[0],physicsCenter?.cx), pz = axis(position[2],physicsCenter?.cz);
    const key = `${cx}:${cz}/${px}:${pz}`;
    if (centerKey === key) return;
    centerKey = key;
    if (center?.cx !== cx || center?.cz !== cz) {
      distantTerrain.geometry.dispose();
      distantTerrain.geometry = makeParkDistantTerrain(cx, cz);
    }
    center = { cx, cz };
    physicsCenter = { cx:px, cz:pz };
    // Keep scenery around a stationary pilot, while physics still follows the
    // airplane. Only nine extra chunks are needed when those areas separate.
    const wanted = new Set();
    for (const [x0,z0,radius] of [[cx,cz,3],[px,pz,1]])
      for (let x=x0-radius;x<=x0+radius;x++)for(let z=z0-radius;z<=z0+radius;z++)wanted.add(`${x}:${z}`);
    for (const id of wanted) {
      const [x,z] = id.split(':').map(Number);
      if (!chunks.has(id)) chunks.set(id, createChunk(x, z));
      const chunk = chunks.get(id);
      const nearby = Math.abs(x-px)<=1 && Math.abs(z-pz)<=1;
      // Distant terrain already fills this area; do not overlap a second skin.
      chunk.terrain.visible = Math.abs(x-cx)<=3 && Math.abs(z-cz)<=3;
      if (chunk.grass) chunk.grass.visible = Math.abs(x-cx)<=1 && Math.abs(z-cz)<=1;
      if (world && nearby && !chunk.colliderHandles.length)
        for (const desc of chunk.colliderDescs) chunk.colliderHandles.push(world.createCollider(desc).handle);
      else if (!nearby && chunk.colliderHandles.length) deactivatePhysics(chunk);
    }
    for (const [id, chunk] of chunks) if (!wanted.has(id)) { removeChunk(chunk); chunks.delete(id); }
  }
  update(map.spawn);
  return {
    root, update,
    get chunkCount() { return chunks.size; },
    get treeCount() { return [...chunks.values()].reduce((total, chunk) => total + chunk.treeCount, 0); },
    get physicsChunkCount() { return [...chunks.values()].filter((chunk) => chunk.colliderHandles.length > 0).length; },
    dispose() {
      collisionRegions.clear();
      for (const chunk of chunks.values()) removeChunk(chunk);
      chunks.clear();
      distantTerrain.geometry.dispose();
      root.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      for (const texture of textures) texture.dispose();
      scene.remove(root);
    },
  };
}
