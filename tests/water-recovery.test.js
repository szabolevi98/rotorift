import test from 'node:test';
import assert from 'node:assert/strict';
import {WaterRecovery} from '../web/game/water-recovery.js';

function fixture(){
  const classes=new Set(),title={},detail={};
  const element={classList:{add:v=>classes.add(v),remove:v=>classes.delete(v)},querySelector:s=>s==='strong'?title:detail};
  return {feedback:new WaterRecovery(element,key=>key),classes,title,detail};
}
test('water contact is identified for 1.8 seconds before a single reset, including while paused',()=>{
  const {feedback,classes,title,detail}=fixture();
  feedback.start('water',100);
  assert.equal(classes.has('hidden'),false);
  assert.equal(title.textContent,'hud.waterCrash');assert.equal(detail.textContent,'hud.waterRecovering');
  assert.equal(feedback.update(1899),null);
  assert.deepEqual(feedback.update(1900),{pose:null});
  assert.equal(feedback.update(5000),null);
  feedback.clear();assert.equal(classes.has('hidden'),true);assert.equal(feedback.update(6000),null);
});
test('authoritative water reset waits for the existing notice without restarting its deadline',()=>{
  const {feedback,title}=fixture(),pose={p:[0,1,0]};
  feedback.start('fountain',100);feedback.start('fountain',900,pose);
  assert.equal(title.textContent,'hud.fountainCrash');
  assert.equal(feedback.update(1899),null);assert.deepEqual(feedback.update(1900),{pose});
  feedback.clear();feedback.start('water',2000);feedback.clear();
  assert.equal(feedback.update(5000),null,'map changes/manual resets cancel stale recovery');
});
