import * as THREE from 'three';

export function createLaunchPad(spawn, heightAt) {
  const [x,,z] = spawn, height = heightAt(x,z);
  const geometry = new THREE.CircleGeometry(.65,48);
  geometry.rotateX(-Math.PI/2);
  const positions = geometry.attributes.position;
  for (let i=0;i<positions.count;i++)
    positions.setY(i,heightAt(x+positions.getX(i),z+positions.getZ(i))-height);
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ color:0x232f2d, roughness:.85,
    // A millimetre-scale gap alone collapses in the depth buffer at distance.
    polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-4 });
  // Flight uses logarithmic depth, which explicitly writes fragment depth.
  // Bias that output as well, rather than relying only on polygon offset.
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <logdepthbuf_fragment>', `#include <logdepthbuf_fragment>
      #ifdef USE_LOGDEPTHBUF
        gl_FragDepth = max(0.0, gl_FragDepth - 0.00000024);
      #endif`);
  };
  material.customProgramCacheKey = () => 'rotorift-launch-pad-depth-v1';
  const pad = new THREE.Mesh(geometry,material);
  pad.name = 'Launch_pad';
  pad.position.set(x,height+.004,z);
  pad.renderOrder = 1;
  return pad;
}
