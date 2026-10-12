import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { makeMapSky, MAP_WEATHER } from "../web/game/map-atmosphere.js";
import { ParkShadows } from "../web/game/park-shadows.js";

test("sunny and overcast skies are seamless reusable textures with distinct lighting", () => {
  const sunny=makeMapSky("park"),cloudy=makeMapSky("construction"),repeat=makeMapSky("park");
  try {
    const stats=texture=>{
      const {data,width,height}=texture.image;let r=0,b=0,max=0,count=0;
      for(let y=Math.floor(height*.6);y<height;y+=3)for(let x=0;x<width;x+=3) {
        const i=(y*width+x)*4;r+=data[i];b+=data[i+2];max=Math.max(max,data[i],data[i+1],data[i+2]);count++;
      }
      return {blue:b/count-r/count,max};
    };
    assert.ok(stats(sunny).blue>25,"the park has a blue daylight sky");
    assert.ok(stats(cloudy).blue<20,"construction clouds have a neutral cool grey sky");
    assert.notDeepEqual(sunny.image.data,cloudy.image.data);
    assert.equal(sunny.image.data,repeat.image.data,"sky pixels are baked once per weather, not computed each frame");
    for(const texture of [sunny,cloudy]) {
      assert.equal(texture.mapping,THREE.EquirectangularReflectionMapping);
      const {data,width,height}=texture.image;
      for(let y=0;y<height;y+=7)for(let channel=0;channel<3;channel++)
        assert.ok(Math.abs(data[(y*width)*4+channel]-data[(y*width+width-1)*4+channel])<20,"sky wraps without a cubemap seam");
    }
    for(const kind of ["park","construction"]) {
      const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(100,16/9,.012,12000);
      const shadows=new ParkShadows(scene,camera,MAP_WEATHER[kind]);
      for(const light of shadows.csm.lights) {
        assert.equal(light.intensity,MAP_WEATHER[kind].sunIntensity);
        assert.equal(light.color.getHex(),MAP_WEATHER[kind].sunColor);
        assert.equal(light.shadow.radius,MAP_WEATHER[kind].shadowRadius);
        assert.equal(light.shadow.mapSize.x,2048,"weather preserves shadow resolution");
      }
      shadows.dispose();
    }
    assert.ok(MAP_WEATHER.construction.sunIntensity<MAP_WEATHER.park.sunIntensity/3);
  } finally {sunny.dispose();cloudy.dispose();repeat.dispose();}
});
