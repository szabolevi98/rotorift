// Keep the cause visible before teleporting back to launch. No timers survive
// a reset/map change, and an authoritative reset can wait behind the same notice.
export class WaterRecovery {
  constructor(element, t, delayMs = 1800) {
    this.element=element;this.t=t;this.delayMs=delayMs;this.clear();
  }
  start(reason, now, pose = null) {
    if(!this.active){this.active=true;this.deadline=now+this.delayMs;this.requested=false;}
    if(pose)this.pose=pose;
    this.element.querySelector('strong').textContent=this.t(reason==='fountain'?'hud.fountainCrash':'hud.waterCrash');
    this.element.querySelector('span').textContent=this.t('hud.waterRecovering');
    this.element.classList.remove('hidden');
  }
  update(now) {
    if(!this.active||this.requested||now<this.deadline)return null;
    this.requested=true;
    return {pose:this.pose};
  }
  clear() {
    this.active=false;this.requested=false;this.pose=null;this.deadline=null;
    this.element.classList.add('hidden');
  }
}
