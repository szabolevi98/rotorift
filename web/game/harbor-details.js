import { HARBOR } from '../../shared/world/harbor-layout.js';

// Cargo is grouped into working areas, leaving the terminal's flight lanes open.
// Reuse the harbor's instanced primitives instead of adding per-prop materials.
export function buildHarborDetails(parts,{container,tractor,warehouse}) {
  const {box,cylinder,beam,pipe,model,prism,part}=parts,Y=HARBOR.quayY;
  const wheel=(x,z,r=.55)=>{
    cylinder(r*2,.42,[x,r,z],'rubber',true,[0,0,Math.PI/2]);
    cylinder(r,.44,[x,r,z],'steel',false,[0,0,Math.PI/2]);
  };
  function pallet(p,layers=2) {model('Palletized_freight',p,0,()=>{
    for(const x of [-1.3,0,1.3])box([.18,.25,2.5],[x,.125,0],'wood',false);
    box([3,.13,2.5],[0,.315,0],'wood');
    box([2.8,layers*.85,2.3],[0,.38+layers*.425,0],'grey');
    for(const x of [-.9,.9])box([.07,layers*.85+.04,2.34],[x,.38+layers*.425,0],'steel',false);
  });}
  function forklift(p,yaw=0) {model('Freight_forklift',p,yaw,()=>{
    box([1.9,.7,2.8],[0,.9,.15],'ochre');box([1.8,1,1],[0,1.65,1.05],'ochre');
    for(const x of [-.9,.9])for(const z of [-.8,1])wheel(x,z,.42);
    for(const x of [-.75,.75])for(const z of [-.7,.85])beam([x,1.1,z],[x,3,z],.09,'steelDark');
    box([1.9,.16,2.1],[0,3.06,0],'steelDark');
    for(const x of [-.58,.58]){
      box([.16,3.5,.17],[x,1.8,-1.6],'steelDark');
      box([.19,.12,1.8],[x,.4,-2.4],'steel');
    }
    box([.8,.75,.65],[0,1.65,.25],'rubber');cylinder(.18,.2,[.7,3.25,.65],'light',false);
  });}
  function trailer(p,color,yaw=0) {model('Freight_semitrailer',p,yaw,()=>{
    box([2.7,.35,13.8],[0,1.25,0],'steelDark');
    box([2.6,3,13.4],[0,2.925,0],color);
    for(const x of [-1.35,1.35])for(const z of [3.9,5.2,6.5])wheel(x,z,.56);
    for(const x of [-1,1])box([.15,1.1,.15],[x,.55,-4.4],'steel');
    for(const x of [-.65,.65])box([.04,2.7,.05],[x,2.9,6.73],'steel',false);
    box([2.5,.2,.15],[0,.85,7.03],'steel');
    for(const x of [-1,1])box([.3,.18,.06],[x,1.1,7.12],'red',false);
  });}

  // North pier: covered break-bulk cargo, steel stock and export containers.
  warehouse([200,Y,-190],48,36,13,'blue',{open:true,name:'Pier_cargo_shed'});
  for(const x of [185,215])for(const z of [-197,-187])pallet([x,Y,z],3);
  for(const x of [88,94,100,106])for(let level=0;level<2;level++)
    container([x,Y+level*2.64,-200],level?'grey':'red');
  model('Steel_stock_loading_area',[140,Y,-190],0,()=>{
    for(const z of [-9,9])box([24,.2,.4],[0,.1,z],'wood');
    for(let row=0;row<3;row++)for(let level=0;level<3-row;level++)
      cylinder(1.3,19,[-7+row*2.8+level*.7,.85+level*1.15,0],'steel',true,[Math.PI/2,0,0]);
    for(let i=0;i<4;i++)box([7,.4,14],[7,.2+i*.43,0],'steelDark');
  });
  forklift([160,Y,-204],-.7);

  // South pier: a freight transfer apron, not another identical container bank.
  for(const [x,z,color]of [[92,66,'teal'],[108,66,'grey'],[113,95,'blue'],[129,95,'blue']])
    container([x,Y,z],color,{yaw:Math.PI/2});
  for(const x of [138,145])for(const z of [68,75,82])pallet([x,Y,z],2+(z%2));
  forklift([151,Y,96],Math.PI/2);
  trailer([86,Y,85],'white',Math.PI/2);tractor([78,Y,85],'teal',Math.PI/2);
  for(const [x,z]of [[135,-165],[135,55]]){
    model('Pier_lifting_winch',[x,Y,z],0,()=>{
      box([3,.4,3],[0,.2,0],'steel');
      cylinder(1.7,2.5,[0,1.3,0],'rope',true,[0,0,Math.PI/2]);
      for(const side of [-1,1])cylinder(2.2,.18,[side*1.3,1.3,0],'ochre',false,[0,0,Math.PI/2]);
    });
  }

  // A compact tank farm makes a different landmark on the landward side.
  model('Harbor_tank_farm',[-348,Y,-126],0,()=>{
    box([72,.25,96],[0,.125,0],'concrete');
    for(const x of [-35,35])box([.45,1.1,96],[x,.8,0],'edge');
    for(const z of [-47,47])box([70,1.1,.45],[0,.8,z],'edge');
    for(const x of [-17,17])for(const z of [-27,5,32]){
      cylinder(19,.5,[x,.5,z],'steelDark');cylinder(17,11,[x,6.25,z],'white');
      part('cone',[17.4,1.8,17.4],[x,12.65,z],'grey');
      for(const y of [1.5,10.7])cylinder(17.08,.15,[x,y,z],'steel',false);
      cylinder(1.3,.6,[x,13.8,z],'steel');
      pipe([x+8.8,1,z],[x+8.8,12,z],.12,'steel');
      for(let y=1;y<12;y+=.55)pipe([x+8.85,y,z],[x+8.85,y,z+.65],.045,'steel',false);
    }
    for(const z of [-37,-35]){
      pipe([-28,2,z],[29,2,z],.4,'teal');
      pipe([29,2,z],[29,1,z-8],.4,'teal');
    }
    box([8,5,9],[22,2.6,-37],'steelDark');box([5,.8,6],[22,5.5,-37],'grey');
  });

  // The warehouse has cargo along both walls and a generous through aisle.
  for(const side of [-1,1])for(const z of [10,35,60]){
    model('Warehouse_freight_rack',[-300+side*25,Y,z],0,()=>{
      for(const x of [-3,3])for(const dz of [-7,7])box([.2,8,.2],[x,4,dz],'steel');
      for(const h of [.4,4.2]){
        box([6.4,.2,14.4],[0,h,0],'ochre');
        for(const dz of [-4,0,4])pallet([0,h+.1,dz],2);
      }
    });
  }
  forklift([-280,Y,80],Math.PI);
  // Loading apron on the outside wall, with dock equipment and parked trailers.
  for(const z of [3,36,69]){
    box([.12,5.5,6],[-335.27,Y+2.75,z],'steelDark',false);
    box([4,1.1,7],[-337.5,Y+.55,z],'concrete');
    trailer([-346,Y,z],'white',Math.PI/2);
    for(const dz of [-4,4])cylinder(.2,1.3,[-341,Y+.65,z+dz],'paint');
  }
  for(const z of [140,157,174]){
    trailer([-368,Y,z],z===157?'blue':'white');
    box([4,.015,.15],[-368,Y+.012,z-8],'paint',false);
  }
  tractor([-368,Y,128],'red');
  for(const x of [-29,-21])for(const z of [-200,-185,-170])
    container([x,Y,z],(x+z)%3?'teal':'grey');

  // Larger perimeter depots give the terminal depth at low flying height.
  warehouse([-65,Y,365],110,42,16,'teal',{open:true,name:'South_equipment_depot'});
  for(const x of [-100,-30])for(const z of [355,373])pallet([x,Y,z],3);
  forklift([-65,Y,336],.3);tractor([-140,Y,355],'ochre',Math.PI/2);
  model('Northern_timber_export_yard',[-100,Y,-350],0,()=>{
    for(const x of [-42,-14,14,42])for(const z of [-13,13]){
      for(const dz of [-6,6])box([19,.25,.4],[x,.125,z+dz],'steelDark');
      for(let level=0;level<4;level++)box([18,.75,11],[x,.65+level*.85,z],'wood');
      for(const dx of [-6,6])box([.12,3.7,11.08],[x+dx,1.95,z],'steel',false);
    }
  });
  forklift([-170,Y,-345],Math.PI/2);

  // A fenced entrance and small parking court frame the otherwise bare yard.
  const fencePosts=new Set();
  function fence(a,b){
    const count=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/14);
    const point=t=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
    for(let i=0;i<=count;i++){
      const [x,z]=point(i/count),key=x+':'+z;
      if(!fencePosts.has(key)){pipe([x,Y,z],[x,Y+2.7,z],.1,'steel');fencePosts.add(key);}
      if(i===count)break;
      const [nx,nz]=point((i+1)/count);
      for(const h of [.9,2.5])pipe([x,Y+h,z],[nx,Y+h,nz],.06,'steel',false);
      for(const f of [.25,.5,.75]){
        const [px,pz]=point((i+f)/count);pipe([px,Y+.25,pz],[px,Y+2.65,pz],.025,'steel',false);
      }
    }
  }
  // Three connected landward sides, ending at the quay; keep the entrance open.
  fence([-398,-398],[-398,259]);fence([-398,315],[-398,398]);
  fence([-398,-398],[56,-398]);fence([-398,398],[56,398]);
  model('Harbor_gatehouse',[-378,Y,285],0,()=>{
    box([10,4.2,8],[0,2.1,0],'grey');box([11,.3,9],[0,4.35,0],'steelDark');
    for(const side of [-1,1])box([.07,1.5,5],[side*5.05,2.6,0],'glass',false);
    box([7,1.5,.07],[0,2.6,4.05],'glass',false);
    box([.8,1.2,.8],[9,.6,8],'ochre');
    beam([9,1.4,8],[9,7.4,4],.18,'white');
  });
  model('Staff_parking',[-346,Y,254],0,()=>{
    for(let i=0;i<5;i++){
      const x=i*4;
      box([.12,.015,7],[x,0.012,0],'white',false);
      if(i%3===0)continue;
      model('Staff_car',[x+2,0,0],0,()=>{
        box([1.8,.65,4.2],[0,.85,0],i%2?'blue':'white');
        box([1.6,.7,2.2],[0,1.5,.2],'glass');
        for(const sx of [-.9,.9])for(const z of [-1.3,1.3])wheel(sx,z,.32);
      });
    }
  });

  // A moored workboat uses a closed tapered hull, with proper rubber fenders.
  model('Harbor_workboat',[108,0,-70],0,()=>{
    const outline=[[-4,12],[4,12],[4,-7],[2.5,-12],[0,-14],[-2.5,-12],[-4,-7]];
    prism(outline,-1.3,3.8,'hullRed','Workboat_closed_hull');
    prism(outline,2.5,.22,'deck','Workboat_deck');
    box([5.8,2.8,5],[0,4.12,1],'white');box([6.4,.25,5.7],[0,5.65,1],'ochre');
    for(const x of [-3,3])box([.06,1,3.8],[x,4.7,1],'glass',false);
    box([4.8,1,.07],[0,4.7,-1.55],'glass',false);
    cylinder(.35,4,[0,7.8,1],'steel');beam([-1.5,8,1],[1.5,8,1],.12,'steel');
    cylinder(1.3,3,[2,6.2,4.6],'steelDark');
    for(const x of [-4.05,4.05])for(const z of [-7,-2,4,9])
      cylinder(1.4,.35,[x,1.7,z],'rubber',true,[0,0,Math.PI/2]);
    box([5,.35,6],[0,2.95,8],'wood');
  });
  pipe([105,2.8,-79],[61,3.6,-76],.09,'rope');
  pipe([105,2.8,-60],[61,3.6,-57],.09,'rope');
}
