import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import RAPIER from "@dimforge/rapier3d-compat";
import { buildEnvironment } from "../web/game/environment.js";
import { createMapAtmosphere } from "../web/game/map-atmosphere.js";
import { ParkShadows } from "../web/game/park-shadows.js";
import { PARK_VIEW_DISTANCE } from "../web/game/park-terrain.js";
import { CONSTRUCTION_VIEW_DISTANCE } from "../web/game/construction.js";
import { PARK_GARDEN, parkSurfaceHeight } from "../shared/world/park-layout.js";
import { configureDroneRenderer } from "../shared/visual/drone-rendering.js";
import { validateRoute } from "../shared/race/routes.js";
import { RouteDraft, normalFromYaw, yawFromNormal } from "../shared/race/editor.js";

const PARK_VIEWS = {
  overview: ["Park overview", [0,520,125], [0,2,0]],
  pavilion: ["Pavilion and passage", [43,21,55], [0,3,0]],
  garden: ["Garden pergola", [PARK_GARDEN.x-23,21,PARK_GARDEN.z+24], [PARK_GARDEN.x,3,PARK_GARDEN.z]],
  lake: ["Small lake and bridge", [249,43,240], [190,2,175]],
  hill: ["Hilltop pavilion", [-265,58,225], [-210,12,180]],
  fence: ["Fence and landscape", [40,21,382], [0,parkSurfaceHeight(0,350)+1,350]],
  grandLake: ["Grand lake and fountain", [15,80,0], [-155,3,-130]],
  cafe: ["Cafe and terrace", [145,11,-118], [110,4,-155]],
  arcade: ["Shade arcade", [205,parkSurfaceHeight(170,-76)+18,-43], [170,parkSurfaceHeight(170,-76)+2,-76]],
  community: ["Sports garden and parking", [-115,78,315], [0,3,216]],
};
const SITE_VIEWS = {
  overview: ["Construction overview", [410,390,470], [0,15,0]],
  frames: ["Open concrete frames", [14,42,58], [-55,22,-35]],
  cranes: ["Tower cranes", [-122,81,30], [-75,63,-70]],
  machines: ["Construction vehicles", [-119,10,70], [-142,2,101]],
  pit: ["Foundations and excavation", [-123,31,135], [-178,-1,100]],
  storage: ["Materials and pipes", [132,14,219], [170,2,187]],
  warehouse: ["Steel warehouse frame", [85,26,-141], [135,7,-185]],
  offices: ["Offices and entry", [-78,24,299], [-170,3,244]],
  earthworks: ["Earthworks and ramps", [282,28,-146], [231,5,-225]],
  hangar: ["Hangar and loading yard", [-101,17,29], [-136,7,-20]],
  plant: ["Concrete batching plant", [112,23,280], [65,7,246]],
  pump: ["Concrete pump work zone", [67,17,182], [44,6,158]],
  landscape: ["Fence and landscape", [60,85,408], [10,12,292]],
};

export async function startMapViewer(embeddedCatalog) {
  const $ = selector => document.querySelector(selector), canvas = $("#map-scene"), viewport = $(".map-viewport");
  let maps = embeddedCatalog.maps, projectSaving = false;
  // Local API map data keeps its stable metadata; display the English names
  // embedded at build time, just like the static GitHub Pages showcase.
  const mapName = map => embeddedCatalog.maps.find(item => item.id === map.id)?.name ?? map.name;
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  if (local) {
    try { const response = await fetch("/api/catalog"); if (response.ok) { maps = (await response.json()).maps; projectSaving = true; } } catch { /* Static XAMPP preview uses the embedded catalog. */ }
  }
  $("#save-project").hidden = !projectSaving;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); configureDroneRenderer(THREE, renderer);
  const camera = new THREE.PerspectiveCamera(52, 1, .1, PARK_VIEW_DISTANCE), controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.maxPolarAngle = Math.PI * .49; controls.minDistance = 3; controls.maxDistance = 1200;
  const transform = new TransformControls(camera, canvas); transform.setSize(.8); transform.setSpace("world");
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  let scene, world, environment, atmosphere, shadows, map, draft, gateRoot, gateGroups = [], selected = -1;
  let editing = false, placing = false, busy = false, request = 0, active = true, dragging = false, rebuilding = false;
  const status = text => { $("#status").textContent = text; };
  const attempt = fn => { try { fn(); } catch (error) { status(error.message); } };
  const disposeGroup = group => {
    const materials = new Set(); group?.traverse(object => {
      object.geometry?.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) if (material) materials.add(material);
    });
    for (const material of materials) { material.map?.dispose(); material.dispose(); }
    group?.removeFromParent();
  };
  const remember = () => {
    try { localStorage.setItem("rotorift-race-draft-" + map.id, JSON.stringify(draft.route)); } catch { /* Storage may be disabled. */ }
    $("#restore-draft").hidden = false;
  };
  function updateFields() {
    let option = [...$("#route-select").options].find(option => option.value === draft.route.id);
    if(!option){option=new Option(draft.route.name+" · draft",draft.route.id);$("#route-select").append(option);}
    $("#route-select").value=draft.route.id;
    const source=map.routes.find(route=>route.id===draft.route.id);
    option.textContent=draft.route.name+(!source||draft.route.version>source.version?" · draft":"");
    $("#race-id").value = draft.route.id; $("#race-name").value = draft.route.name;
    for (const [index, axis] of ["x","y","z"].entries()) $("#spawn-" + axis).value = draft.route.spawn[index];
    const gate = draft.route.gates[selected];
    $("#gate-properties").disabled = !gate;
    $("#gate-title").textContent = gate ? `Gate ${selected+1}${selected===0?" · start / finish":""}` : "Select a gate";
    if (gate) {
      const field = (id,value) => { if(document.activeElement!==$(id))$(id).value=value; };
      for (const [index, axis] of ["x","y","z"].entries()) field("#gate-"+axis,Number(gate.p[index].toFixed(3)));
      field("#gate-yaw",Number(yawFromNormal(gate.n).toFixed(1)));
      field("#gate-width",gate.width);field("#gate-height",gate.height);
    }
    $("#undo").disabled = !draft.undoStack.length; $("#redo").disabled = !draft.redoStack.length;
    $("#file-path").textContent = `data/maps/${map.id}/${draft.route.id}.json · version ${draft.route.version}`;
  }
  function renderGates() {
    rebuilding = true; transform.detach(); disposeGroup(gateRoot);
    gateRoot = new THREE.Group(); gateRoot.name = "Editable_race_gates"; scene.add(gateRoot); gateGroups = [];
    draft.route.gates.forEach((gate,index) => {
      const group = new THREE.Group(); group.userData.gateIndex = index; group.position.set(...gate.p); group.rotation.y = yawFromNormal(gate.n)*Math.PI/180;
      const mat = new THREE.MeshBasicMaterial({color:index===selected?0x21b5c8:index===0?0xff6648:0xfdf7df});
      const parts = [[[.16,gate.height,.16],[-gate.width/2,0,0]],[[.16,gate.height,.16],[gate.width/2,0,0]],[[gate.width+.16,.16,.16],[0,gate.height/2,0]]];
      for(const [size,p] of parts){const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),mat);mesh.position.set(...p);group.add(mesh);}
      const label=document.createElement("canvas");label.width=label.height=128;
      const context=label.getContext("2d");context.fillStyle=index===0?"#ff6648":"#26342c";context.fillRect(0,0,128,128);context.fillStyle="#fff";context.font="bold 82px Arial";context.textAlign="center";context.fillText(String(index+1),64,93);
      const texture=new THREE.CanvasTexture(label);texture.colorSpace=THREE.SRGBColorSpace;
      const sign=new THREE.Sprite(new THREE.SpriteMaterial({map:texture}));sign.position.y=gate.height/2+.8;sign.scale.set(1.3,1.3,1);group.add(sign);
      const arrow=new THREE.ArrowHelper(new THREE.Vector3(0,0,1),new THREE.Vector3(0,0,-1),3,0x21b5c8,.7,.45);group.add(arrow);
      gateRoot.add(group);gateGroups.push(group);
    });
    if(draft.route.gates.length>1) {
      const points=draft.route.gates.map(g=>new THREE.Vector3(...g.p));points.push(points[0].clone());
      gateRoot.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0xff6648,transparent:true,opacity:.65})));
    }
    const spawn=draft.route.spawn,start=new THREE.ArrowHelper(new THREE.Vector3(0,0,-1),new THREE.Vector3(spawn[0],environment.heightAt(spawn[0],spawn[2])+spawn[1]+1,spawn[2]),5,0x26a27c,1,.7);gateRoot.add(start);
    $("#gate-list").replaceChildren(...draft.route.gates.map((gate,index)=>{
      const button=document.createElement("button");button.type="button";button.textContent=`${String(index+1).padStart(2,"0")}${index===0?" · S":""}`;button.setAttribute("aria-pressed",String(index===selected));button.setAttribute("aria-label",`Gate ${index+1}${index===0?", start / finish":""}`);button.onclick=()=>{selected=index;renderGates();};return button;
    }));
    if(editing&&gateGroups[selected])transform.attach(gateGroups[selected]);
    rebuilding = false; updateFields();
  }
  function changed(message = "Draft saved in this browser. Download JSON or save to the project to publish it.") { remember();renderGates();status(message); }
  function selectRoute(id) {
    $("#route-select").replaceChildren(...map.routes.map(route=>new Option(route.name,route.id)));
    const route=map.routes.find(route=>route.id===id)??map.routes[0];
    draft=new RouteDraft(map,route??{id:"race_1",name:"New race",version:1,spawn:[...map.spawn],gates:[]});selected=-1;placing=false;
    $("#add-gate").textContent="Place gate"; renderGates(); status("");
    try{$("#restore-draft").hidden=!localStorage.getItem("rotorift-race-draft-"+map.id);}catch{$("#restore-draft").hidden=true;}
  }
  function setView(name) {
    const view=(map.kind==="park"?PARK_VIEWS:SITE_VIEWS)[name];if(!view)return;
    camera.position.set(...view[1]);controls.target.set(...view[2]);controls.update();environment.update(view[2]);
  }
  async function selectMap(id,routeId) {
    const token=++request;busy=true;$("#loading").hidden=false;$("#loading").textContent="Opening the map…";
    await new Promise(requestAnimationFrame);if(token!==request)return;
    try {
      transform.detach();disposeGroup(gateRoot);gateRoot=null;shadows?.dispose();environment?.dispose();atmosphere?.dispose();world?.free();
      map=maps.find(m=>m.id===id)??maps[0];scene=new THREE.Scene();world=new RAPIER.World({x:0,y:-9.81,z:0});
      atmosphere=createMapAtmosphere(renderer,scene,map.kind);
      environment=buildEnvironment(scene,world,RAPIER,{...map,gates:[],spawn:map.baseSpawn??map.spawn});
      camera.far=map.kind==="park"?PARK_VIEW_DISTANCE:CONSTRUCTION_VIEW_DISTANCE;camera.updateProjectionMatrix();
      shadows=new ParkShadows(scene,camera,atmosphere.profile);scene.add(transform.getHelper());
      $("#map-select").value=map.id;$("#map-title").textContent=`ROTORIFT. / ${mapName(map).toUpperCase()}`;$("#map-size").textContent=`${map.size} × ${map.size} m`;
      const views=map.kind==="park"?PARK_VIEWS:SITE_VIEWS;
      $("#view-select").replaceChildren(...Object.entries(views).map(([id,view])=>new Option(view[0],id)));
      $("#route-select").replaceChildren(...map.routes.map(route=>new Option(route.name,route.id)));
      if(map.routes.some(r=>r.id===routeId))$("#route-select").value=routeId;
      selectRoute($("#route-select").value);setView("overview");$("#loading").hidden=true;
    }catch(error){$("#loading").textContent="Cannot load the map: "+error.message;console.error(error);}finally{busy=false;}
  }
  function setEditing(value) {
    editing=value;$("#editor").hidden=!value;$("#map-layout").classList.toggle("editing",value);$("#edit").setAttribute("aria-pressed",String(value));$("#edit").textContent=value?"Browse map":"Edit gates";
    $("#map-hint").textContent=value?"Click a gate to select it · Place gate, then click the map":"Drag: rotate · Scroll: zoom · Right drag: pan";
    if(!value){transform.detach();placing=false;$("#add-gate").textContent="Place gate";}else if(gateGroups[selected])transform.attach(gateGroups[selected]);
  }
  $("#edit").onclick=()=>setEditing(!editing);$("#close-editor").onclick=()=>setEditing(false);
  $("#map-select").replaceChildren(...maps.map(map=>new Option(mapName(map),map.id)));
  $("#map-select").onchange=()=>selectMap($("#map-select").value);
  $("#route-select").onchange=()=>{if($("#route-select").value!==draft.route.id)selectRoute($("#route-select").value);};
  $("#view-select").onchange=()=>setView($("#view-select").value);
  $("#add-gate").onclick=()=>{placing=!placing;$("#add-gate").textContent=placing?"Cancel placement":"Place gate";status(placing?"Click the terrain or a floor to place the next gate.":"");};
  let down;
  canvas.addEventListener("pointerdown",event=>{down=[event.clientX,event.clientY];});
  canvas.addEventListener("pointerup",event=>{
    if(!editing||busy||dragging||event.button!==0||!down||Math.hypot(event.clientX-down[0],event.clientY-down[1])>5)return;
    const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
    attempt(()=>{
      if(placing) {
        const hits=raycaster.intersectObjects(scene.children.filter(object=>object!==gateRoot&&object!==transform.getHelper()),true);
        const hit=hits.find(hit=>hit.object.isMesh&&hit.object.visible);if(!hit)return;
        const p=hit.point;const yaw=draft.route.gates.at(-1)?yawFromNormal(draft.route.gates.at(-1).n):180;
        selected=draft.add({p:[Number(p.x.toFixed(3)),Number((p.y+2.08).toFixed(3)),Number(p.z.toFixed(3))],n:normalFromYaw(yaw),width:6,height:4});placing=false;$("#add-gate").textContent="Place gate";changed();
      }else{
        const hit=raycaster.intersectObjects(gateGroups,true)[0];let object=hit?.object;
        while(object&&object.userData.gateIndex===undefined)object=object.parent;
        if(object){selected=object.userData.gateIndex;renderGates();}
      }
    });
  });
  transform.addEventListener("dragging-changed",event=>{dragging=event.value;controls.enabled=!event.value;if(event.value)draft.checkpoint();else if(draft&&!rebuilding)changed();});
  transform.addEventListener("objectChange",()=>{
    if(rebuilding||selected<0||!gateGroups[selected])return;
    const object=gateGroups[selected];attempt(()=>{draft.setGate(selected,{p:object.position.toArray(),n:normalFromYaw(object.rotation.y*180/Math.PI)},false);updateFields();});
  });
  function transformMode(mode){transform.setMode(mode);transform.showX=mode==="translate";transform.showY=true;transform.showZ=mode==="translate";$("#translate").setAttribute("aria-pressed",String(mode==="translate"));$("#rotate").setAttribute("aria-pressed",String(mode==="rotate"));}
  $("#translate").onclick=()=>transformMode("translate");$("#rotate").onclick=()=>transformMode("rotate");
  for(const id of ["x","y","z","yaw","width","height"])$("#gate-"+id).oninput=()=>attempt(()=>{
    if($("#gate-"+id).value==="")return;
    const gate=draft.route.gates[selected],value=Number($("#gate-"+id).value);if(!Number.isFinite(value))throw Error("Enter a valid number.");
    const change=id==="yaw"?{n:normalFromYaw(value)}:["width","height"].includes(id)?{[id]:value}:{p:gate.p.map((v,i)=>i===["x","y","z"].indexOf(id)?value:v)};
    draft.setGate(selected,change);changed();
  });
  $("#ground-gate").onclick=()=>attempt(()=>{const g=draft.route.gates[selected];draft.setGate(selected,{p:[g.p[0],environment.heightAt(g.p[0],g.p[2])+g.height/2+.08,g.p[2]]});changed();});
  $("#focus-gate").onclick=()=>{const g=draft.route.gates[selected];controls.target.set(...g.p);camera.position.set(g.p[0]+g.n[0]*14,g.p[1]+6,g.p[2]+g.n[2]*14);controls.update();environment.update(g.p);};
  $("#delete-gate").onclick=()=>{draft.remove(selected);selected=Math.min(selected,draft.route.gates.length-1);changed();};
  $("#gate-up").onclick=()=>{selected=draft.move(selected,-1);changed();};$("#gate-down").onclick=()=>{selected=draft.move(selected,1);changed();};
  $("#undo").onclick=()=>{if(draft.undo()){selected=Math.min(selected,draft.route.gates.length-1);changed("Undo.");}};$("#redo").onclick=()=>{if(draft.redo()){selected=Math.min(selected,draft.route.gates.length-1);changed("Redo.");}};
  $("#race-id").onchange=()=>attempt(()=>{const id=$("#race-id").value.trim();if(!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(id))throw Error("Use lowercase letters, numbers, underscores and hyphens for the file ID.");draft.change(r=>{r.id=id;});changed();});
  $("#race-name").onchange=()=>attempt(()=>{const name=$("#race-name").value.trim();if(!name)throw Error("Enter a race name.");draft.change(r=>{r.name=name;});changed();});
  for(const [index,axis] of ["x","y","z"].entries())$("#spawn-"+axis).onchange=()=>attempt(()=>{const value=Number($("#spawn-"+axis).value);if(!Number.isFinite(value)||Math.abs(value)>map.size/2)throw Error("Start position must be inside the map.");draft.change(r=>{r.spawn[index]=value;});changed();});
  $("#start-at-view").onclick=()=>attempt(()=>{draft.change(r=>{r.spawn=[Number(controls.target.x.toFixed(2)),.2,Number(controls.target.z.toFixed(2))];});changed();});
  $("#new-race").onclick=()=>{let number=1;while(map.routes.some(r=>r.id===`race_${number}`))number++;draft=new RouteDraft(map,{id:`race_${number}`,name:`Race ${number}`,version:1,spawn:[...(map.baseSpawn??map.spawn)],gates:[]});draft.baseVersion=0;selected=-1;changed("New race. Place at least two gates, then save the JSON.");};
  $("#restore-draft").onclick=()=>attempt(()=>{const route=JSON.parse(localStorage.getItem("rotorift-race-draft-"+map.id));draft=new RouteDraft(map,route);selected=-1;renderGates();status("Browser draft restored.");});
  function download(route) {
    $("#export-json").value=JSON.stringify(route,null,2)+"\n";$("#json-preview").hidden=false;
    const blob=new Blob([JSON.stringify(route,null,2)+"\n"],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=route.id+".json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function exportRace() {
    const route={...draft.route,id:$("#race-id").value.trim(),name:$("#race-name").value.trim()};
    if(route.name!==draft.route.name&&route.id===draft.route.id)route.version=Math.max(route.version,draft.baseVersion+1);
    return validateRoute(route,map);
  }
  $("#download").onclick=()=>attempt(()=>{const route=exportRace();download(route);status(`Exported ${route.id}.json. Store it in data/maps/${map.id}/ and rebuild the showcase.`);});
  $("#save-project").onclick=async()=>{
    const button=$("#save-project");button.disabled=true;
    try {
      const response=await fetch("/api/routes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mapId:map.id,route:exportRace()})});const result=await response.json();if(!response.ok)throw Error(result.error??"Cannot save the race.");
      maps=result.catalog.maps;map=maps.find(m=>m.id===map.id);draft=new RouteDraft(map,result.route);selected=-1;
      $("#route-select").replaceChildren(...map.routes.map(route=>new Option(route.name,route.id)));$("#route-select").value=result.route.id;
      try{localStorage.removeItem("rotorift-race-draft-"+map.id);}catch{}
      $("#restore-draft").hidden=true;renderGates();status("Saved to the project. Reload the game to choose this race. Rebuild and push to update GitHub Pages.");
    }catch(error){status(error.message);}finally{button.disabled=false;}
  };
  $("#import").onchange=async event=>{
    try{const file=event.target.files[0];if(!file)return;if(file.size>256*1024)throw Error("Race file is too large.");const route=validateRoute(JSON.parse(await file.text()),map);draft=new RouteDraft(map,route);selected=-1;changed("Imported JSON. Save to project or download to keep the race file.");}catch(error){status(error.message);}finally{event.target.value="";}
  };
  window.addEventListener("message",event=>{if(event.source===parent&&event.origin===location.origin&&event.data?.type==="showcase-map-active")active=!!event.data.active;});
  new ResizeObserver(()=>{
    const width=viewport.clientWidth,height=viewport.clientHeight;if(!width||!height)return;
    renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();shadows?.update();
  }).observe(viewport);
  await RAPIER.init();
  const params=new URLSearchParams(location.search);await selectMap(params.get("map")??"liget",params.get("route"));
  renderer.setAnimationLoop(()=>{if(!active||document.hidden||busy||!scene)return;controls.update();environment.update(controls.target.toArray());shadows.update();renderer.render(scene,camera);});
}
