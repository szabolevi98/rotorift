import {CITY_BLOCK_CENTERS,CITY_BUILDINGS} from '../../shared/world/city-layout.js';

// Populate only the paired-building blocks. Keep the landmark plazas and the
// middle eight metres of every alley open, with props against the side walls.
export const CITY_DETAIL_COURTS = CITY_BLOCK_CENTERS.flatMap((z,zi) => CITY_BLOCK_CENTERS
  .filter(x => CITY_BUILDINGS.some(b => b.z===z && Math.abs(b.x-x)===23))
  .map(x => ({x,z,variant:(CITY_BLOCK_CENTERS.indexOf(x)+zi*2)%4})));

export function buildCityDetails({box,cylinder,beam,part,model}) {
  function pallet(crate=true) {
    // One cheap solid core covers the small stack; slats remain visual detail.
    box([1.2,.3,1],[0,.15,0],'wood',true,undefined,false);
    for(const z of [-.4,0,.4])box([1.2,.09,.15],[0,.08,z],'wood',false);
    for(let i=0;i<5;i++)box([.17,.07,1],[-.48+i*.24,.265,0],'wood',false);
    for(const x of [-.45,.45])box([.14,.15,.85],[x,.17,0],'wood',false);
    if(crate){
      box([1.05,.72,.86],[0,.66,0],'ochre');
      for(const z of [-.28,.28])box([1.06,.025,.055],[0,1.032,z],'rubber',false);
      for(const x of [-.53,.53])for(const z of [-.28,.28])box([.02,.73,.055],[x,.665,z],'rubber',false);
    }
  }
  function dumpster() {
    box([1.25,1.05,2.2],[0,.725,0],'leaf');
    box([1.36,.12,2.3],[0,1.31,0],'rubber');
    for(const z of [-.85,.85])cylinder(.24,.16,[-.48,.12,z],'rubber',false,[0,0,Math.PI/2]);
    for(const z of [-.8,.8])box([.08,.12,.35],[-.69,1.15,z],'steel',false);
    box([.025,.22,.34],[-.64,.85,0],'cream',false);
  }
  function cabinet() {
    box([.9,1.9,1.5],[0,.95,0],'steel');
    box([.035,1.62,1.32],[-.47,1,0],'roof',false);
    box([.045,.3,.2],[-.5,1.1,.4],'ochre',false);
    for(const y of [.35,.46,.57])box([.045,.035,.8],[-.5,y,0],'rubber',false);
  }
  function airUnit() {
    box([1.05,1.1,1.8],[0,.68,0],'cream');
    for(const z of [-.45,.45]){
      cylinder(.68,.05,[-.55,.7,z],'steel',false,[0,0,Math.PI/2]);
      cylinder(.16,.065,[-.59,.7,z],'rubber',false,[0,0,Math.PI/2]);
    }
    for(const z of [-.65,.65])box([1.1,.15,.12],[0,.075,z],'steel',false);
  }
  function bench() {
    for(const x of [-1,1]){
      box([.12,.48,.7],[x,.24,0],'steel');
      beam([x,.35,.3],[x,1.12,.46],.08,'steel');
    }
    for(let i=0;i<4;i++)box([2.65,.07,.15],[0,.515,-.27+i*.18],'wood',false);
    for(const y of [.82,1.03])box([2.65,.16,.08],[0,y,.4],'wood',false);
  }
  function planter(tree=false) {
    box([2.8,.6,2.8],[0,.3,0],'concrete');
    box([2.5,.04,2.5],[0,.62,0],'earth',false);
    if(tree){
      cylinder(.25,3.2,[0,2.22,0],'trunk');
      for(const [x,y,z]of [[0,4.4,0],[-.8,3.9,.2],[.8,3.9,-.2]])part('sphere',[2.4,2.6,2.3],[x,y,z],'leaf',false);
    }else part('sphere',[2.3,.8,2.3],[0,.9,0],'leaf',false);
  }
  function bikeRack() {
    for(const x of [-1.2,0,1.2]){
      for(const z of [-.4,.4])cylinder(.07,.85,[x,.425,z],'steel');
      box([.07,.07,.8],[x,.85,0],'steel');
    }
  }
  function bin() {
    cylinder(.6,.85,[0,.425,0],'steel');cylinder(.65,.07,[0,.9,0],'rubber',false);
    box([.3,.15,.035],[0,.71,-.31],'rubber',false);
  }
  for(const {x,z,variant}of CITY_DETAIL_COURTS){
    model('Service_alley_'+variant,[x,.18,z],0,()=>{
      for(const side of [-1,1]){
        const along=side<0?-19:19;
        model(variant===0?'Recycling_dumpster':variant===1?'Delivery_pallet':variant===2?'Utility_cabinet':'Alley_planter',
          [side*(variant===3?5.5:5.65),0,along],side>0?0:Math.PI,()=>{
            if(variant===0)dumpster();else if(variant===1)pallet();else if(variant===2)cabinet();else planter();
          });
      }
      model(variant%2?'Ground_air_conditioner':'Stored_pallets',[variant%2?-5.8:5.65,0,0],variant%2?Math.PI:0,
        ()=>variant%2?airUnit():pallet(false));
    });
    // Furnish the setback beyond the facades, clear of the street/crosswalks
    // and the direct approach to each central alley.
    model('Street_pocket_'+variant,[x,.18,z+41],0,()=>{
      model('Sidewalk_bench',[-28,0,0],0,bench);
      model('Street_planter',[32,0,0],0,()=>planter(variant===1));
      if(variant%2===0)model('Bicycle_stands',[24,0,0],0,bikeRack);
      else model('Litter_bin',[-24,0,0],0,bin);
    });
  }
}
