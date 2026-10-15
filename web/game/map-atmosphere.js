import * as THREE from "three";

export const MAP_WEATHER = {
  park: { horizon: 0xd4e4eb, zenith: 0x3485ca, fogDensity: 0.00065, sunIntensity: 3, sunColor: 0xfff0d5,
    skyLight: 0xe6f2ff, groundLight: 0x7c8763, hemisphereIntensity: 2.4, environmentIntensity: 0.65, shadowRadius: 1 },
  construction: { horizon: 0xb5bcc4, zenith: 0x667381, fogDensity: 0.00055, sunIntensity: 0.65, sunColor: 0xdde5ef,
    skyLight: 0xd5dfe9, groundLight: 0x887968, hemisphereIntensity: 3, environmentIntensity: 0.85, shadowRadius: 3 },
  city: { horizon: 0xcbd7df, zenith: 0x5484b0, fogDensity: 0.00048, sunIntensity: 2.3, sunColor: 0xffeed6,
    skyLight: 0xdce9f4, groundLight: 0x737979, hemisphereIntensity: 2.3, environmentIntensity: 0.65, shadowRadius: 1.5 },
};

const pixels = new Map();
const smooth = (a,b,x) => {const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const lattice = new Float32Array(32**3);
let seed=137;
for(let i=0;i<lattice.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;lattice[i]=seed/4294967296;}
function noise(x,y,z) {
  const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);
  const fx=smooth(0,1,x-ix),fy=smooth(0,1,y-iy),fz=smooth(0,1,z-iz);
  const at=(dx,dy,dz)=>lattice[((ix+dx)&31)+(((iy+dy)&31)<<5)+(((iz+dz)&31)<<10)];
  const mix=(a,b,t)=>a+(b-a)*t;
  return mix(mix(mix(at(0,0,0),at(1,0,0),fx),mix(at(0,1,0),at(1,1,0),fx),fy),
    mix(mix(at(0,0,1),at(1,0,1),fx),mix(at(0,1,1),at(1,1,1),fx),fy),fz);
}
function cloudNoise(x,y,z) {
  return noise(x,y,z)*0.56+noise(x*2.03+7,y*2.03,z*2.03)*0.27+noise(x*4.07,y*4.07+13,z*4.07)*0.17;
}

export function makeMapSky(kind) {
  const weather=MAP_WEATHER[kind]??MAP_WEATHER.park,width=1024,height=512;
  if(!pixels.has(kind)) {
    const bytes=new Uint8Array(width*height*4),color=new THREE.Color();
    const horizon=new THREE.Color(weather.horizon),zenith=new THREE.Color(weather.zenith),ground=new THREE.Color(weather.groundLight);
    const bright=new THREE.Color(kind==="construction"?0xdde0e3:0xffffff),shade=new THREE.Color(kind==="construction"?0x798593:0xdce5eb);
    const sun=new THREE.Vector3(-35,75,25).normalize(),sunColor=new THREE.Color(0xfff9e7),white=new THREE.Color(0xffffff),cloud=new THREE.Color();
    for(let y=0;y<height;y++) {
      const latitude=((y+0.5)/height-0.5)*Math.PI,ny=Math.sin(latitude),horizontal=Math.cos(latitude);
      for(let x=0;x<width;x++) {
        const theta=((x+0.5)/width-0.5)*Math.PI*2,nx=horizontal*Math.cos(theta),nz=horizontal*Math.sin(theta);
        if(ny<0)color.copy(horizon).lerp(ground,smooth(-0.03,-0.7,ny));
        else {
          color.copy(horizon).lerp(zenith,Math.pow(ny,0.55));
          const n=cloudNoise(nx*7+11,ny*(kind==="construction"?18:9)+9,nz*7+4);
          const cover=(kind==="construction"?0.65+smooth(0.32,0.61,n)*0.35:smooth(0.58,0.73,n))*smooth(0.01,0.12,ny);
          cloud.copy(shade).lerp(bright,smooth(0.32,0.72,n));
          color.lerp(cloud,cover);
          if(kind!=="construction") {
            const dot=nx*sun.x+ny*sun.y+nz*sun.z;
            color.lerp(sunColor,Math.exp((dot-1)*75)*0.38);
            color.lerp(white,smooth(0.99986,0.99997,dot));
          }
        }
        color.convertLinearToSRGB();
        const i=(y*width+x)*4;bytes[i]=Math.round(color.r*255);bytes[i+1]=Math.round(color.g*255);bytes[i+2]=Math.round(color.b*255);bytes[i+3]=255;
      }
    }
    pixels.set(kind,bytes);
  }
  const texture=new THREE.DataTexture(pixels.get(kind),width,height,THREE.RGBAFormat);
  texture.colorSpace=THREE.SRGBColorSpace;texture.mapping=THREE.EquirectangularReflectionMapping;
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.wrapS=THREE.RepeatWrapping;
  texture.generateMipmaps=true;texture.needsUpdate=true;texture.name=`Rotorift_${kind}_sky`;
  return texture;
}

export function createMapAtmosphere(renderer,scene,kind) {
  const profile=MAP_WEATHER[kind]??MAP_WEATHER.park,sky=makeMapSky(kind);
  const pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromEquirectangular(sky);pmrem.dispose();
  scene.background=sky;scene.backgroundIntensity=1;scene.environment=environment.texture;
  scene.environmentIntensity=profile.environmentIntensity;
  scene.fog=new THREE.FogExp2(profile.horizon,profile.fogDensity);
  const hemisphere=new THREE.HemisphereLight(profile.skyLight,profile.groundLight,profile.hemisphereIntensity);scene.add(hemisphere);
  return { profile, dispose() {
    scene.remove(hemisphere);
    if(scene.background===sky)scene.background=null;
    if(scene.environment===environment.texture)scene.environment=null;
    environment.dispose();sky.dispose();
  }};
}
