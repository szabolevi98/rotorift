import test from 'node:test';
import assert from 'node:assert/strict';
import clipping from 'polygon-clipping';
import { surfaceSourceHash as generatedHash, parkPaving, parkGravel, parkCurbs, constructionRoads, playgroundWalk, playgroundGrass } from '../shared/world/map-surfaces.js';
import { PLAYGROUND_RAISED_FOOTPRINTS } from '../shared/world/playground-layout.js';
import { surfaceSourceHash } from '../scripts/build-map-surfaces.mjs';
import { makeSurfaceGeometry } from '../web/game/surface-geometry.js';
import { parkSurfaceHeight } from '../shared/world/park-layout.js';
import { constructionHeight } from '../shared/world/construction-layout.js';
import { makeTreeCrown, makeTreeTrunk } from '../web/game/tree-models.js';

const surfaceArea = polygons => polygons.reduce((total,rings)=>total+rings.reduce((sum,ring,index)=>{
  const area=Math.abs(ring.reduce((a,p,i)=>a+p[0]*ring[(i+1)%ring.length][1]-p[1]*ring[(i+1)%ring.length][0],0))/2;
  return sum+(index===0?area:-area);
},0),0);

test('generated map surfaces are current, disjoint at junctions and clipped at the fence',()=>{
  assert.equal(generatedHash,surfaceSourceHash(),'run npm run maps:build after changing either layout');
  // Boolean operations on independently clipped tile boundaries can yield a
  // 1e-14 m sliver. Reject actual overlapping area, allowing arithmetic noise.
  assert.ok(surfaceArea(clipping.intersection(parkPaving,parkGravel))<1e-8);
  assert.ok(surfaceArea(clipping.intersection(parkCurbs,parkPaving))<1e-8);
  assert.ok(surfaceArea(clipping.intersection(parkCurbs,parkGravel))<1e-8);
  for(const [surfaces,half] of [[parkPaving,350],[parkGravel,350],[parkCurbs,350],[constructionRoads,300]])
    for(const p of surfaces.flat(2)) assert.ok(Math.abs(p[0])<=half && Math.abs(p[1])<=half);
  // The construction crossroads must be one continuous surface, with no seam
  // or leftover interior edge crossing its centre.
  const crossing=[[[ -8,199],[8,199],[8,211],[-8,211],[-8,199]]];
  assert.deepEqual(clipping.difference(crossing,constructionRoads),[]);
});

test('playground grass excludes raised floors and the garden walk has no overlapping cap or junction faces',()=>{
  assert.ok(surfaceArea(clipping.intersection(playgroundGrass,playgroundWalk))<1e-8);
  for(const [x,z,w,d]of PLAYGROUND_RAISED_FOOTPRINTS){
    const footprint=[[[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2],[x-w/2,z-d/2]]];
    assert.ok(surfaceArea(clipping.intersection(playgroundGrass,footprint))<1e-8,'no hidden grass face under the floor');
  }
  assert.ok(Math.abs(surfaceArea(playgroundWalk)-surfaceArea(clipping.union(playgroundWalk)))<1e-8,'walk caps and junctions must be triangulated once');
});

test('union road interiors retain clearance over every underlying terrain triangle',()=>{
  for(const [surfaces,height,lift] of [[parkGravel,parkSurfaceHeight,.065],[constructionRoads,constructionHeight,.085]]) {
    const g=makeSurfaceGeometry(surfaces,height,lift),p=g.attributes.position;
    assert.ok(p.count/3<120000,'road tessellation must stay bounded');
    for(let i=0;i<p.count;i+=3) {
      const x=(p.getX(i)+p.getX(i+1)+p.getX(i+2))/3,z=(p.getZ(i)+p.getZ(i+1)+p.getZ(i+2))/3;
      const y=(p.getY(i)+p.getY(i+1)+p.getY(i+2))/3;
      assert.ok(Math.abs(y-height(x,z)-lift)<.00005,`surface slices through terrain at ${x},${z}`);
    }
    g.dispose();
  }
});

test('tree silhouettes retain low-poly budgets and actual per-face shading',()=>{
  const shapes=['oak','birch','pine'].map(makeTreeCrown);
  assert.equal(new Set(shapes.map(g=>g.attributes.position.count)).size,3);
  for(const g of shapes) {
    assert.ok(g.attributes.position.count/3<=450,'canopy budget per tree');
    assert.ok(g.hasAttribute('color'));
    g.dispose();
  }
  const trunk=makeTreeTrunk(); assert.ok(trunk.attributes.position.count/3<120); trunk.dispose();
});
