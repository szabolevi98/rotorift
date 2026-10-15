const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const offset=(gate,amount)=>gate.p.map((v,i)=>v+gate.n[i]*amount);

// Authoring-time visibility search. Game clients only draw the saved polyline;
// no pathfinding or collision queries run in the flight/render loop.
export function findGuidePath(start,end,clear,{step=2,boundary=300,maxVisited=18000}={}) {
  if(clear(start,end))return [start,end];
  const margin=24, low=start.map((v,i)=>i===1?Math.max(.25,Math.min(v,end[i])-8):Math.max(-boundary,Math.min(v,end[i])-margin));
  const high=start.map((v,i)=>i===1?Math.min(195,Math.max(v,end[i])+18):Math.min(boundary,Math.max(v,end[i])+margin));
  const queue=[],costs=new Map(),parents=new Map(),points=new Map();
  const key=p=>p.join(','), origin=[0,0,0], first=key(origin);
  function push(node){queue.push(node);let i=queue.length-1;while(i){const p=(i-1)>>1;if(queue[p].score<=node.score)break;queue[i]=queue[p];i=p;}queue[i]=node;}
  function pop(){const first=queue[0],last=queue.pop();if(queue.length){let i=0;while(i*2+1<queue.length){let c=i*2+1;if(c+1<queue.length&&queue[c+1].score<queue[c].score)c++;if(last.score<=queue[c].score)break;queue[i]=queue[c];i=c;}queue[i]=last;}return first;}
  costs.set(first,0);points.set(first,start);push({grid:origin,id:first,g:0,score:distance(start,end)});
  const directions=[];for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)if(x||y||z)directions.push([x,y,z]);
  let visited=0;
  while(queue.length&&visited++<maxVisited){
    const node=pop();if(node.g!==costs.get(node.id))continue;
    const p=points.get(node.id);
    if((visited%12===0||distance(p,end)<step*2)&&clear(p,end)){
      const path=[end,p];let id=node.id;while(parents.has(id)){id=parents.get(id);path.push(points.get(id));}path.reverse();
      const simplified=[path[0]];let at=0;
      while(at<path.length-1){let next=path.length-1;while(next>at+1&&!clear(path[at],path[next]))next--;simplified.push(path[next]);at=next;}
      return simplified;
    }
    for(const d of directions){
      const grid=node.grid.map((v,i)=>v+d[i]), id=key(grid), q=grid.map((v,i)=>start[i]+v*step);
      if(q.some((v,i)=>v<low[i]||v>high[i]))continue;
      const g=node.g+distance(p,q);if(g>=(costs.get(id)??Infinity)||!clear(p,q))continue;
      costs.set(id,g);parents.set(id,node.id);points.set(id,q);push({grid,id,g,score:g+distance(q,end)});
    }
  }
  throw Error('No clear guide path found. Move the gates or increase their height.');
}

export function planRaceGuide(gates,clear,options={}) {
  return gates.map((gate,i)=>{
    const next=gates[(i+1)%gates.length], lead=Math.min(2,gate.width*.4,next.width*.4);
    const exit=offset(gate,lead),entry=offset(next,-lead);
    if(!clear(gate.p,exit))throw Error(`Gate ${i+1} has a blocked exit at ${gate.p}.`);
    if(!clear(entry,next.p))throw Error(`Gate ${(i+1)%gates.length+1} has a blocked entry at ${next.p}.`);
    try{return roundGuideCorners([gate.p,...findGuidePath(exit,entry,clear,options),next.p],clear).map(p=>p.map(v=>Number(v.toFixed(3))));}
    catch(error){throw Error(`Guide leg ${i+1} → ${(i+1)%gates.length+1}: ${error.message}`);}
  });
}

function roundGuideCorners(points,clear){
  const result=[points[0]];
  for(let i=1;i<points.length-1;i++){
    const a=points[i-1],p=points[i],b=points[i+1],before=distance(a,p),after=distance(p,b);
    if(before<.001||after<.001){result.push(p);continue;}
    const incoming=p.map((v,j)=>(v-a[j])/before),outgoing=b.map((v,j)=>(v-p[j])/after);
    if(incoming.reduce((n,v,j)=>n+v*outgoing[j],0)>.998){result.push(p);continue;}
    const radius=Math.min(3,before*.28,after*.28),start=p.map((v,j)=>v-incoming[j]*radius),end=p.map((v,j)=>v+outgoing[j]*radius);
    const curve=Array.from({length:9},(_,k)=>{const t=k/8;return p.map((v,j)=>(1-t)**2*start[j]+2*(1-t)*t*v+t*t*end[j]);});
    if(curve.every((q,k)=>!k||clear(curve[k-1],q)))result.push(...curve);else result.push(p);
  }
  result.push(points.at(-1));return result;
}
