import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {createLaunchPad} from '../web/game/launch-pad.js';
import {parkSurfaceHeight} from '../shared/world/park-layout.js';
import {constructionSurfaceHeight} from '../shared/world/construction-layout.js';
import {citySurfaceHeight} from '../shared/world/city-layout.js';
import {playgroundHeight} from '../web/game/playground.js';

for(const [id,heightAt]of [['liget',(x,z)=>parkSurfaceHeight(x,z)+.065],['betonudvar',constructionSurfaceHeight],['jatszoter',playgroundHeight],['skyline',citySurfaceHeight]])
test(`${id}: the launch marking clears its supporting surface and remains depth-biased at distance`,async()=>{
  const map=JSON.parse(await readFile(new URL(`../data/maps/${id}.json`,import.meta.url)));
  const pad=createLaunchPad(map.spawn,heightAt);pad.updateMatrixWorld(true);
  try{
    const p=pad.geometry.attributes.position;
    for(let i=0;i<p.count;i++){
      const v=pad.localToWorld(new THREE.Vector3().fromBufferAttribute(p,i));
      assert.ok(v.y-heightAt(v.x,v.z)>.0039,'the marking must not intersect grass, paving or the road');
    }
    assert.equal(pad.material.polygonOffset,true);
    assert.ok(pad.material.polygonOffsetFactor<0&&pad.material.polygonOffsetUnits<0);
    assert.equal(pad.material.depthTest,true,'other objects must still occlude the marking');
    assert.equal(pad.material.depthWrite,true);
    assert.ok(pad.renderOrder>0);
    assert.ok(pad.geometry.attributes.normal.getY(0)>.99,'one upward-facing surface, without a competing underside');
  }finally{pad.geometry.dispose();pad.material.dispose();}
});
