import {read,write} from '../storage.js';
import {sanitizeGhost} from '../../shared/race/ghost.js';
import {raceCategoryKey} from '../../shared/race/category.js';
import {simulationKey} from '../../shared/simulation/options.js';
export const ghostQuery=({map,drone,mode,simulation})=>new URLSearchParams({map:map.id,route:map.routeId,drone:drone.id,mode,simulation:simulationKey(simulation)});
export const ghostKey=c=>raceCategoryKey(c.map,c.drone,c.mode,c.simulation);
export function personalGhost(key){
  const data=read('lap-ghost.'+key,null),replay=sanitizeGhost(data?.replay);
  return replay&&Number.isFinite(data.ms)&&data.ms>0&&Math.abs(data.ms-replay.frames.at(-1)[0])<=2?{ms:data.ms,replay}:null;
}
export function savePersonalGhost(key,ms,value){
  const replay=sanitizeGhost(value),previous=personalGhost(key);
  if(!replay||!Number.isFinite(ms)||Math.abs(ms-replay.frames.at(-1)[0])>2||previous&&ms>previous.ms)return false;
  return write('lap-ghost.'+key,{ms,replay});
}
export class GhostSelection {
  constructor(root,t,time){
    this.root=root;this.select=root.querySelector('select');this.note=root.querySelector('[data-ghost-note]');this.t=t;this.time=time;this.version=0;
    const saved=read('lap-ghost-choices',{});this.choices=saved&&typeof saved==='object'&&!Array.isArray(saved)?saved:{};
    this.select.onchange=()=>this.choose(this.context,this.select.value);
    root.querySelector('button').onclick=()=>this.refresh(this.context,true);
  }
  choice(context){const value=this.choices[ghostKey(context)];return value==='self'||/^[a-f0-9-]{36}$/.test(value??'')?value:'off';}
  choose(context,value){this.choices[ghostKey(context)]=value==='self'||/^[a-f0-9-]{36}$/.test(value??'')?value:'off';write('lap-ghost-choices',this.choices);}
  async refresh(context,active){
    this.abort?.abort();const version=++this.version;this.context=context;this.root.classList.toggle('hidden',!active);
    if(!active||!context)return;
    this.abort=new AbortController();const chosen=this.choice(context),own=personalGhost(ghostKey(context));
    const off=new Option(this.t('ghost.off'),'off'),self=new Option(this.t('ghost.self')+(own?' · '+this.time(own.ms):' · '+this.t('ghost.missing')),'self');
    self.disabled=!own;this.select.replaceChildren(off,self);this.select.value=chosen==='self'&&own?'self':'off';
    this.note.textContent=this.t('ghost.loading');
    try{
      const response=await fetch('/api/leaderboard?'+ghostQuery(context),{signal:this.abort.signal});
      if(!response.ok)throw Error('Leaderboard unavailable');const data=await response.json();
      if(version!==this.version)return;
      for(const [i,entry]of data.entries.slice(0,10).entries()){
        const option=new Option(`${i+1}. ${entry.name} · ${this.time(entry.ms)}${entry.hasGhost?'':' · '+this.t('ghost.missing')}`,entry.ghostId);
        option.disabled=!entry.hasGhost;this.select.append(option);
      }
      this.note.textContent=this.t(data.available?(data.entries.length?'ghost.hint':'ghost.empty'):'records.unavailable');
      const allowed=[...this.select.options].some(o=>o.value===chosen&&!o.disabled);
      this.select.value=allowed?chosen:'off';
      if(data.available&&!allowed)this.choose(context,'off');
    }catch(error){if(version===this.version&&error.name!=='AbortError')this.note.textContent=this.t('records.unavailable');}
  }
  async load(context){
    const key=ghostKey(context),choice=this.choice(context);
    if(choice==='off')return null;
    if(choice==='self'){const own=personalGhost(key);return own?{...own,label:this.t('ghost.self')}:null;}
    const query=ghostQuery(context);query.set('id',choice);
    const response=await fetch('/api/ghost?'+query);if(!response.ok)throw Error('Ghost unavailable');
    const data=await response.json(),replay=sanitizeGhost(data.replay);
    if(data.category!==key||!replay)throw Error('Wrong ghost category');
    return {replay,ms:data.ms,label:data.name};
  }
}
