import {validRate} from '../shared/physics/rates.js';
import {validSimulation} from '../shared/simulation/options.js';
// Preferences only: never export identity/resume tokens, records or ghost data.
const keys=new Set(['language','keys','input-source','radio-device','rates','camera','camera-profiles','airplane-controls','auto-arm','simulation','drone-color']);
const allowed=key=>keys.has(key)||/^radio(?:-v\d+)?\./.test(key);
const plain=value=>value&&typeof value==='object'&&!Array.isArray(value);
function safeValue(value,depth=0){
  if(depth>8)throw Error('Too deep');
  if(value===null||typeof value==='boolean')return;
  if(typeof value==='number'&&Number.isFinite(value))return;
  if(typeof value==='string'&&value.length<=1024)return;
  if(Array.isArray(value)&&value.length<=128){value.forEach(v=>safeValue(v,depth+1));return;}
  if(plain(value)&&Object.keys(value).length<=256){
    for(const[k,v]of Object.entries(value)){
      if(['__proto__','constructor','prototype'].includes(k))throw Error('Invalid key');
      safeValue(v,depth+1);
    }return;
  }throw Error('Invalid preference');
}
export function exportSettings(storage){
  const preferences={};
  for(let i=0;i<storage.length;i++){
    const name=storage.key(i),key=name?.startsWith('rotorift.')?name.slice(9):'';
    if(!allowed(key))continue;
    try{const value=JSON.parse(storage.getItem(name));safeValue(value);preferences[key]=value;}catch{}
  }
  return {format:'rotorift-settings',version:1,createdAt:new Date().toISOString(),preferences};
}
export function parseSettings(text){
  if(typeof text!=='string'||text.length>512000)throw Error('Invalid size');
  const data=JSON.parse(text);
  if(data?.format!=='rotorift-settings'||data.version!==1||!plain(data.preferences)||Object.keys(data.preferences).length>128)throw Error('Invalid settings');
  const preferences={};
  for(const[key,value]of Object.entries(data.preferences)){
    if(!allowed(key))throw Error('Unexpected preference');safeValue(value);
    if(['keys','rates','camera','camera-profiles','airplane-controls','simulation'].includes(key)||key.startsWith('radio')){
      if(key!=='radio-device'&&!plain(value))throw Error('Invalid object');
    }
    if(key==='keys'&&!Object.values(value).every(v=>typeof v==='string'&&/^[A-Za-z0-9]+$/.test(v)))throw Error('Invalid keys');
    if(key==='rates'&&!Object.values(value).every(profile=>plain(profile)&&['roll','pitch','yaw'].every(axis=>validRate(profile[axis]))))throw Error('Invalid rates');
    if(key==='simulation'&&!validSimulation(value))throw Error('Invalid simulation');
    if(key==='camera'&&!Object.entries(value).every(([name,v])=>['sound','horizon','analog'].includes(name)?typeof v==='boolean':['angle','fov','volume'].includes(name)&&Number.isFinite(v)&&v>=0&&v<=(['angle','fov'].includes(name)?180:1)))throw Error('Invalid camera');
    if(key==='camera-profiles'&&!Object.values(value).every(p=>plain(p)&&Number.isFinite(p.angle)&&p.angle>=0&&p.angle<=60&&Number.isFinite(p.fov)&&p.fov>=70&&p.fov<=140))throw Error('Invalid cameras');
    if(key==='airplane-controls'&&!Object.entries(value).every(([k,v])=>['travel','expo'].includes(k)&&Number.isFinite(v)&&v>=0&&v<=1))throw Error('Invalid controls');
    if(key.startsWith('radio.')&&!['throttle','roll','pitch','yaw'].every(name=>{
      const a=value.axes?.[name];return a&&Number.isInteger(a.index)&&a.index>=0&&a.index<128&&[a.min,a.max,a.center].every(Number.isFinite)&&a.max>a.min&&typeof a.invert==='boolean';
    }))throw Error('Invalid radio');
    if(key==='auto-arm'&&typeof value!=='boolean')throw Error('Invalid auto arm');
    if(key==='input-source'&&!['auto','keyboard'].includes(value))throw Error('Invalid input');
    if(['radio-device','language','drone-color'].includes(key)&&typeof value!=='string')throw Error('Invalid text');
    preferences[key]=value;
  }
  if(!Object.keys(preferences).length)throw Error('Empty settings');
  return preferences;
}
export function importSettings(storage,preferences){
  const originals=Object.keys(preferences).map(key=>['rotorift.'+key,storage.getItem('rotorift.'+key)]);
  try{for(const[key,value]of Object.entries(preferences))storage.setItem('rotorift.'+key,JSON.stringify(value));}
  catch(error){for(const[key,value]of originals){try{value===null?storage.removeItem(key):storage.setItem(key,value);}catch{}}throw error;}
}
export function downloadJson(value,name){
  const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download=name;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
