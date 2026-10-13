import { propellerState } from "../../shared/physics/propellers.js";
export class PropellerHud {
  constructor(root,t) {
    this.root=root;this.t=t;this.lastKey=null;
    const title=document.createElement('strong');title.className='propeller-heading';this.root.append(title);this.title=title;
    const grid=document.createElement('div');grid.className='propeller-grid';this.root.append(grid);
    this.cells=Array.from({length:4},(_,index)=>{
      const cell=document.createElement('div');cell.className='propeller-cell';cell.setAttribute('role','img');cell.dataset.motor=String(index);
      cell.innerHTML='<svg viewBox="0 0 40 40" aria-hidden="true">'+[0,1,2].map(i=>`<g transform="rotate(${i*120} 20 20)"><path class="propeller-blade" d="M20 18C22 11 28 3 33 6C36 9 30 17 22 22Z"/></g>`).join('')+'<circle cx="20" cy="20" r="3"/></svg><span></span>';
      grid.append(cell);return cell;
    });
  }
  update(enabled,rotors) {
    this.root.classList.toggle('hidden',!enabled);if(!enabled)return;
    const key=JSON.stringify(rotors)+this.t('hud.propDamage');if(key===this.lastKey)return;this.lastKey=key;
    this.title.textContent=this.t('hud.propDamage');
    this.root.setAttribute('aria-label',this.title.textContent);
    for(const [index,cell]of this.cells.entries()){
      const blades=rotors[index],state=propellerState(blades),name=this.t('hud.prop.position.'+index),status=this.t('hud.prop.'+state);
      cell.dataset.state=state;cell.setAttribute('aria-label',name+' · '+status);cell.title=name+' · '+status;
      cell.querySelector('span').textContent=this.t('hud.prop.short.'+index);
      cell.querySelectorAll('.propeller-blade').forEach((path,i)=>path.dataset.state=String(blades[i]));
    }
  }
}
