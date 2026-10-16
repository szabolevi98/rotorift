import test from 'node:test';
import assert from 'node:assert/strict';
import { routeMetrics, validateRouteDetails, ROUTE_LANGUAGES } from '../shared/race/route-info.js';
import { loadCatalog } from '../server/catalog.js';
import { RouteDraft } from '../shared/race/editor.js';
import { validateRoute } from '../shared/race/routes.js';

test('route length includes guide detours, vertical distance and the closing leg exactly once', () => {
  const gates=[{p:[0,0,0]},{p:[3,4,0]}];
  assert.deepEqual(routeMetrics({gates}),{lengthM:10,gateCount:2,estimated:true});
  assert.deepEqual(routeMetrics({gates,guide:[[[0,0,0],[3,0,0],[3,4,0]],[[3,4,0],[0,0,0]]]}),
    {lengthM:12,gateCount:2,estimated:false});
  assert.deepEqual(routeMetrics(null),{lengthM:0,gateCount:0,estimated:true});
});

test('every built-in route has localized, validated details and known recommendations preserved by the editor', async () => {
  const catalog=await loadCatalog();
  for(const map of catalog.maps) for(const route of map.routes){
    const details=route.details;
    assert.deepEqual(validateRouteDetails(details),details);
    for(const lang of ROUTE_LANGUAGES) assert.ok(details.description[lang].length>20);
    assert.ok(details.recommendedDrones.every(id=>catalog.drones.some(d=>d.id===id)));
    const draft=new RouteDraft(map,route);draft.setGate(1,{width:route.gates[1].width+.1});
    assert.deepEqual(validateRoute(draft.export(),map).details,details);
    draft.undo();assert.deepEqual(draft.route,route);
    assert.equal(routeMetrics(route).estimated,false);
  }
});

test('custom routes may omit details; malformed or incomplete details are rejected', () => {
  assert.equal(validateRouteDetails(undefined),undefined);
  for(const details of [null,{}, {difficulty:'expert'},
    {difficulty:'easy',recommendedDrones:['../bad'],description:{}},
    {difficulty:'easy',recommendedDrones:['rift-65'],description:{en:'Only English'}}])
    assert.throws(()=>validateRouteDetails(details));
});
