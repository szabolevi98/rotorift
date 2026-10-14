import { CONSTRUCTION_SMALL_DETAILS, constructionSurfaceHeight } from '../../shared/world/construction-layout.js';

export function buildConstructionSiteDetails(parts){
  const {model,box,cylinder}=parts;
  function grounded(name,x,z,build,align=false){
    // Small resting objects follow the existing earth, rather than needing
    // additional terrain pads or floating above a sloping storage area.
    const angle=align?[
      Math.atan(constructionSurfaceHeight(x,z-.5)-constructionSurfaceHeight(x,z+.5)),0,
      Math.atan(constructionSurfaceHeight(x+.5,z)-constructionSurfaceHeight(x-.5,z)),
    ]:0;
    model(name,[x,constructionSurfaceHeight(x,z),z],angle,build);
  }
  function pallet(x,z,loaded){
    grounded('stored-material-pallet',x,z,()=>{
      for(const px of [-.46,0,.46])box([.16,.12,.92],[px,.06,0],'wood');
      for(let i=0;i<5;i++)box([1.2,.055,.14],[0,.1475,-.36+i*.18],'wood');
      if(loaded){
        box([1.06,.63,.78],[0,.49,0],'brick');
        for(const y of [.34,.55])box([1.075,.012,.79],[0,y,0],'concreteDark',false);
        for(const x of [-.3,.3])box([.032,.635,.79],[x,.49,0],'white',false);
      }else for(let i=0;i<4;i++)box([1.2,.075,.9],[0,.215+i*.1,0],'wood');
    },true);
  }
  for(const [index,detail]of CONSTRUCTION_SMALL_DETAILS.entries()){
    const {x,z,id,type}=detail;
    // Landmark anchors let the map viewer find each deliberately placed group.
    model(id,[x,constructionSurfaceHeight(x,z),z],0,()=>{});
    if(type==='drums'){
      for(const [i,[dx,dz]]of [[0,0],[.85,.08],[.12,.85],[1,.94]].entries())grounded('site-storage-drum',x+dx,z+dz,()=>{
        cylinder(.65,.93,[0,.465,0],i%2?'blue':'red');
        for(const y of [.17,.73])cylinder(.68,.045,[0,y,0],'steel',false);
        cylinder(.66,.04,[0,.93,0],'steel',false);cylinder(.065,.028,[.15,.965,.1],'white',false);
      });
      pallet(x+2.5,z+.4,false);
    }else if(type==='pallets'){
      for(const [i,[dx,dz]]of [[0,0],[2.1,.15],[.1,1.8]].entries())pallet(x+dx,z+dz,(i+index)%2===0);
    }else if(type==='reels'){
      for(const [dx,dz]of [[0,0],[1.75,.5]])grounded('stored-cable-reel',x+dx,z+dz,()=>{
        cylinder(1.32,.1,[0,.05,0],'wood');cylinder(1.06,.8,[0,.5,0],'rubber');cylinder(1.32,.1,[0,.95,0],'wood');
        cylinder(.2,.025,[0,1.015,0],'steel',false);
        for(const y of [.24,.39,.54,.69,.84])cylinder(1.085,.025,[0,y,0],'steel',false);
      },true);
    }else if(type==='skip')grounded('open-waste-skip',x,z,()=>{
      box([2.6,.16,3.8],[0,.12,0],'steel');
      for(const sx of [-1.3,1.3])box([.13,1.25,3.8],[sx,.825,0],'blue');
      for(const sz of [-1.9,1.9])box([2.6,1.25,.13],[0,.825,sz],'blue');
      for(const sx of [-1.38,1.38])for(const sz of [-1.2,1.2])box([.11,.32,.17],[sx,1.15,sz],'steel',false);
      for(let i=0;i<4;i++)box([1.5,.12,.18],[-.35+i*.22,.32+i*.14,-.8+i*.5],'wood',true,[.1, i*.35, .05]);
    },true);
  }
}
