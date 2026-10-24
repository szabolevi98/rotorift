import test from 'node:test';
import assert from 'node:assert/strict';
import { routeDiagram } from '../shared/race/route-diagram.js';
import { loadCatalog } from '../server/catalog.js';

test('diagram follows guide detours and closing leg, with uniform scale and centred bounds', () => {
  const gates=[{p:[0,2,0]},{p:[100,2,50]}];
  const guide=[[[0,2,0],[20,10,100],[100,2,50]],[[100,2,50],[0,2,0]]];
  const result=routeDiagram({gates,guide});
  assert.equal(result.line.length,4);
  assert.deepEqual(result.line[0],result.line.at(-1));
  assert.deepEqual(result.gates[1],result.line[2]);
  assert.equal(result.line[1][1],142,'actual detour defines the lower bound');
  const scaleX=(result.line[2][0]-result.line[0][0])/100;
  const scaleZ=(result.line[1][1]-result.line[0][1])/100;
  assert.equal(scaleX,scaleZ,'preserve the real shape without stretching');
  assert.ok(result.arrow);
});

test('legacy routes close between gate centres, while vertical routes remain finite and readable', () => {
  const gates=[{p:[1,0,2]},{p:[1,10,2]},{p:[1,30,2]}];
  const vertical=routeDiagram({gates});
  assert.equal(vertical.sideView,true);
  assert.deepEqual(vertical.line[0],vertical.line.at(-1));
  assert.ok(vertical.line[1][1]>vertical.line[2][1],'higher altitude is above');
  assert.ok(vertical.line.flat().every(Number.isFinite));
  assert.ok(routeDiagram({gates:[gates[0]]}).line.flat().every(Number.isFinite));
  assert.equal(routeDiagram(null),null);
});

test('all built-in diagrams fit the viewport and retain every saved guide bend', async () => {
  const catalog=await loadCatalog();let count=0;
  for(const map of catalog.maps)for(const route of map.routes){
    const result=routeDiagram(route);count++;
    assert.equal(result.gates.length,route.gates.length);
    assert.deepEqual(result.line[0],result.line.at(-1),`${map.id}/${route.id}: complete loop`);
    for(const p of [...result.line,...result.gates]){
      assert.ok(p[0]>=17.99&&p[0]<=302.01&&p[1]>=17.99&&p[1]<=142.01);
    }
    assert.ok(result.arrow);
  }
  assert.equal(count,27);
});
