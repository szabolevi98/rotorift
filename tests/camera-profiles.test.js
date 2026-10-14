import test from 'node:test';import assert from 'node:assert/strict';import {CameraProfiles,DEFAULT_CAMERA_PROFILE} from '../web/game/camera-profiles.js';
test('camera profiles migrate legacy settings, isolate each drone and survive JSON reload',()=>{
 const p=new CameraProfiles({}, {angle:32,fov:110,sound:false});assert.deepEqual(p.get('rift-65'),{angle:32,fov:110});
 for(const id of ['rift-65','rift-x35','rift-x5'])p.set(id,p.get(id));p.set('rift-65',{angle:12,fov:90});
 const copy=new CameraProfiles(JSON.parse(JSON.stringify(p.profiles)),{angle:20,fov:100});
 assert.deepEqual(copy.get('rift-65'),{angle:12,fov:90});assert.deepEqual(copy.get('rift-x35'),{angle:32,fov:110});
 const leaked=copy.get('rift-x5');leaked.angle=60;assert.equal(copy.get('rift-x5').angle,32);
});
test('camera profile restoration rejects invalid ranges and unsafe keys',()=>{
 const p=new CameraProfiles({'rift-x5':{angle:80,fov:10},constructor:{angle:5,fov:70}},null);
 assert.deepEqual(p.get('rift-x5'),DEFAULT_CAMERA_PROFILE);assert.throws(()=>p.set('__proto__',{angle:0,fov:100}));
 assert.throws(()=>p.set('rift-65',{angle:NaN,fov:100}));
});
