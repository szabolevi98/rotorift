import { CONSTRUCTION_HANGAR, constructionHeight } from "../../shared/world/construction-layout.js";

export function buildConstructionHangar(parts) {
  const {box,beam,model,cylinder}=parts,h=CONSTRUCTION_HANGAR,base=constructionHeight(h.x,h.z),half=h.width/2;
  model("partly-clad-maintenance-hangar",[h.x,base,h.z],0,()=>{
    box([h.width,0.25,h.depth],[0,0.125,0],"concreteDark");
    for(let z=-25;z<=25;z+=10) {
      for(const x of [-half,half]) {
        box([1.5,0.5,1.5],[x,0.25,z],"concrete");
        box([0.4,10,0.4],[x,5,z],"steel");
        beam([x,10,z],[0,17,z],0.35,"steel");
        beam([x,10,z],[x*0.55,10,z],0.2,"steel");
        beam([x*0.55,10,z],[x*0.55,13.15,z],0.16,"steel",false);
      }
      box([h.width,0.18,0.2],[0,10,z],"steel");
    }
    // Partially installed corrugated cladding; side openings and two large
    // end doors retain multiple usable flight lines through the interior.
    for(const x of [-half,half])for(const z of [-20,-10,0,10,20]) {
      if(x===half&&z===10)continue;
      box([0.14,7.5,9.8],[x,3.75,z],"white");
      box([0.14,1.7,9.8],[x,9.15,z],"blue");
      for(let dz=-4.6;dz<4.8;dz+=0.8)box([0.08,7.4,0.09],[x+Math.sign(x)*0.1,3.75,z+dz],"white",false);
      box([0.17,0.8,9.8],[x,1.2,z],"ochre",false);
    }
    for(const z of [-25,25]) {
      for(const x of [-(half+14)/2,(half+14)/2])box([half-14,9.8,0.16],[x,4.9,z],"blue");
      box([28,1.5,0.18],[0,9.25,z],"white");
      for(const x of [-14,14])box([0.3,8.5,0.4],[x,4.25,z],"steel");
    }
    const angle=Math.atan(7/half),roofLength=Math.hypot(half,7);
    for(const side of [-1,1])for(let bay=0;bay<5;bay++) {
      const z=-20+bay*10;
      if((side===1&&bay===3)||(side===-1&&bay===1))continue;
      box([roofLength,0.16,9.9],[side*half/2,13.5,z],"steel",true,[0,0,-side*angle]);
      for(let dz=-4;dz<=4;dz+=2)beam([0,17.12,z+dz],[side*half,10.12,z+dz],0.065,"steel",false);
    }
    for(const x of [-half+4,-half/2,0,half/2,half-4])box([0.16,0.16,50],[x,17-Math.abs(x)*7/half-0.2,0],"steel");
    // The equipment stays along the walls, clear of the centre door corridor.
    for(const x of [-25,25])for(const z of [-14,2,16]) {
      box([5,0.2,3],[x,0.1,z],"wood");box([4.7,1.5,2.7],[x,0.95,z],"brick");
    }
    for(const z of [-14,-9,-4]){
      box([2,0.8,1.3],[-25,0.4,z],"steel");
      cylinder(0.65,1.1,[-23,0.55,z],"red");
    }
    for(const x of [-10,10])box([0.5,0.5,0.2],[x,9,24.8],"white",false);
    // A mezzanine on one side adds a covered gap and a raised flight shelf.
    for(const z of [-17,-6,6])box([0.3,3.8,0.3],[-17,1.9,z],"steel");
    box([10,0.2,28],[-22,3.9,-6],"steel");
    for(const z of [-19,7])beam([-27,4.9,z],[-17,4.9,z],0.07,"steel");
  });
  // Loading apron and a deliberate outdoor formwork assembly yard.
  model("hangar-formwork-yard",[-136,constructionHeight(-136,-62),-62],0,()=>{
    for(let i=0;i<5;i++) {
      const x=i*6-12;
      box([4.4,0.3,5],[x,0.15,0],"wood");
      box([4,3.4,0.2],[x,1.7,-2],"wood");
      for(const sx of [-1.7,1.7])beam([x+sx,3,-2],[x+sx,0,2],0.14,"steel");
    }
  });
}
