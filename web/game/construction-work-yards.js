import { constructionSurfaceHeight } from "../../shared/world/construction-layout.js";

export function buildConstructionWorkYards(parts) {
  const {model,box,cylinder,beam,part}=parts;
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
