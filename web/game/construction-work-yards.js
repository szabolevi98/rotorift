import { constructionSurfaceHeight } from "../../shared/world/construction-layout.js";

export function buildConstructionWorkYards(parts) {
  const {model,box,cylinder,beam,part}=parts;
  model("concrete-pump-work-zone",[44,constructionSurfaceHeight(44,156),156],0,()=>{
    // Deployed pump truck: separate chassis, cab, stabilisers and articulated
    // hydraulic boom, on its own work pad rather than obstructing a road.
    box([2.5,.32,9],[0,1.1,0],"steel");
    box([2.6,.9,6],[0,1.7,1],"white");
    box([2.55,2.2,2.6],[0,2.3,-3.2],"blue");
    box([2.1,1,.055],[0,2.65,-4.53],"glass",false);
    for(const x of [-1.29,1.29]) {
      box([.055,1,1.6],[x,2.65,-3.3],"glass",false);
      box([.17,.22,.5],[x*1.2,2.55,-4],"steel",false);
      box([.05,.18,.6],[x,1.55,-3.4],"white",false);
    }
    for(const x of [-1.25,1.25]) for(const z of [-3.2,1.7,3.1]) {
      cylinder(1.15,.4,[x,.575,z],"rubber",true,[0,0,Math.PI/2]);
      cylinder(.62,.43,[x,.575,z],"steel",false,[0,0,Math.PI/2]);
    }
    box([2.7,.22,.22],[0,1,-4.6],"steel");
    for(const x of [-.9,.9]) box([.4,.22,.075],[x,1.45,-4.54],"white",false);
    for(const side of [-1,1]) for(const z of [-1.5,3.3]) {
      beam([side,1.1,z],[side*3.5,.8,z],.26,"red");
      box([.85,.18,.85],[side*3.5,.09,z],"wood");
      cylinder(.18,.8,[side*3.5,.57,z],"steel");
    }
    cylinder(1.6,.45,[0,2.5,.6],"steel");
    const joints=[[0,2.7,.6],[0,9,-1.2],[0,13,5.5],[0,9.5,11.5]];
    for(let i=0;i<joints.length-1;i++) {
      beam(joints[i],joints[i+1],.43,"red");
      const a=joints[i].map((v,k)=>v+(k===0?.32:0)), b=joints[i+1].map((v,k)=>v+(k===0?.32:0));
      beam(a,b,.10,"steel",false);
      cylinder(.6,.7,joints[i],"steel",false,[0,0,Math.PI/2]);
    }
    beam([0,3.1,.1],[0,6.3,-.2],.17,"steel",false);
    beam([0,9.5,11.5],[0,5,11.5],.13,"rubber");
    // Hose and shuttering are stored parallel to the truck, leaving approach
    // space for the mixer and an unobstructed passage beneath the raised boom.
    for(let i=0;i<4;i++) cylinder(.22,5,[6,.3+i*.23,1.5],"rubber",false,[Math.PI/2,0,0]);
    for(const x of [8,10]) {
      box([1.3,.25,3.2],[x,.125,-5],"wood");
      for(let i=0;i<4;i++) box([1.2,.13,3],[x,.35+i*.19,-5],"wood");
      for(const z of [-6,-4]) box([1.25,.06,.1],[x,1.06,z],"steel",false);
    }
    for(const [x,z] of [[-7,-7],[-7,8],[11,8]]) {
      box([.5,.09,.5],[x,.045,z],"rubber",false);
      part("cone",[.32,.8,.32],[x,.49,z],"orange",false);
      cylinder(.19,.13,[x,.61,z],"white",false);
    }
  });
  model("concrete-batching-plant",[65,constructionSurfaceHeight(65,246),246],0,()=>{
    // Twin cement silos, raised hopper, stairs and aggregate feed conveyor.
    for(const x of [-19,-10]) {
      for(const sx of [-2,2])for(const z of [-2,2]) {
        box([1,0.4,1],[x+sx,0.2,z],"concrete");
        box([0.2,7,0.2],[x+sx,3.5,z],"steel");
      }
      cylinder(6.3,10,[x,12,0],"white");
      part("cone",[6.3,3,6.3],[x,5.5,0],"white","mesh",[Math.PI,0,0]);
      cylinder(1.3,3,[x,2.5,0],"steel");
      cylinder(6.5,0.2,[x,17.1,0],"steel");
      for(const y of [8,16.8])cylinder(6.4,0.25,[x,y,0],"blue",false);
      for(let y=0.5;y<17;y+=0.4)box([0.7,0.055,0.08],[x+3.3,y,0],"steel",false);
      for(const z of [-0.4,0.4])box([0.07,17,0.07],[x+3.3,8.5,z],"steel",false);
      beam([x-2,0,-2],[x+2,7,-2],0.12,"steel");
    }
    for(const x of [1,13])for(const z of [-3,3])box([0.3,6.5,0.3],[x,3.25,z],"steel");
    box([15,0.25,9],[7,6.6,0],"steel");
    cylinder(5,4,[7,8.8,0],"blue");
    part("cone",[4.8,2.5,4.8],[7,5,0],"steel","mesh",[Math.PI,0,0]);
    cylinder(1.3,2.5,[7,2.8,0],"steel");
    box([17,0.25,10],[7,11.3,0],"blue");
    // A mixer truck can pull under the open six-metre gantry.
    for(const z of [-4.5,4.5])beam([0,7.7,z],[14,7.7,z],0.08,"white",false);
    for(let i=0;i<22;i++)box([1.8,0.12,0.42],[16,0.3+i*0.3,-5+i*0.48],"steel");
    beam([15.2,0.8,-5],[15.2,7.4,5.4],0.07,"white");
    beam([16.8,0.8,-5],[16.8,7.4,5.4],0.07,"white");
    beam([26,1.2,-12],[7,8.1,-3],1.2,"steel",true,0.4);
    for(const x of [18,25])box([0.3,3,0.3],[x,1.5,-9],"steel");
    for(const x of [3,12,21]) {
      box([0.25,2.5,9],[x,1.25,-13],"concrete");
      box([8.5,2.5,0.25],[x+4.3,1.25,-17.5],"concrete");
      part("sphere",[7,2.5,7],[x+4.2,0.9,-13],"gravel","mesh");
    }
    box([6,2.7,4],[-3,1.35,12],"blue");
    box([3,1.1,0.05],[-3,1.7,9.97],"glass",false);
  });
  model("precast-assembly-court",[66,constructionSurfaceHeight(66,109),109],0,()=>{
    // Five upright precast portal frames create a slalom/underpass line.
    for(let x=-20;x<=20;x+=10) {
      for(const z of [-9,9])box([0.8,5,0.8],[x,2.5,z],"concrete");
      box([0.8,0.8,18],[x,4.6,0],"concrete");
      for(const z of [-9,9])beam([x,4,z],[x+3,0,z],0.14,"steel");
    }
    for(const x of [-15,5])for(const z of [-6,6]) {
      box([5,0.25,2.5],[x,0.125,z],"wood");
      for(let i=0;i<4;i++)box([4.5,0.35,2.2],[x,0.5+i*0.45,z],"concrete");
    }
  });
}
