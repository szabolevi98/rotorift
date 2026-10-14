export const DEFAULT_CAMERA_PROFILE=Object.freeze({angle:20,fov:100});
const valid=p=>p&&Number.isFinite(p.angle)&&p.angle>=0&&p.angle<=60&&Number.isFinite(p.fov)&&p.fov>=70&&p.fov<=140;
export class CameraProfiles{
  constructor(saved,legacy){
    this.profiles={};
    if(saved&&typeof saved==='object')for(const [id,p]of Object.entries(saved))if(/^rift-[a-z0-9]+$/.test(id)&&valid(p))this.profiles[id]={angle:p.angle,fov:p.fov};
    this.fallback=valid(legacy)?{angle:legacy.angle,fov:legacy.fov}:{...DEFAULT_CAMERA_PROFILE};
  }
  get(id){return {...(Object.hasOwn(this.profiles,id)?this.profiles[id]:this.fallback)};}
  set(id,p){if(!/^rift-[a-z0-9]+$/.test(id)||!valid(p))throw Error('Invalid camera profile');this.profiles[id]={angle:p.angle,fov:p.fov};}
}
