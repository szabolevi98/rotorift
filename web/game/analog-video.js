import * as THREE from "three";

const fract = value => value - Math.floor(value);
const hash = value => fract(Math.sin(value * 127.1 + 311.7) * 43758.5453);

// Deterministic time-based bursts, independent of monitor refresh rate. This
// is a visual receiver effect, not a radio-range or obstacle-loss simulation.
export function analogSignal(seconds, reducedMotion = false) {
  const time = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const slot = Math.floor(time / 6.5), phase = time - slot * 6.5;
  const start = 1.5 + hash(slot + 1) * 3;
  const duration = .10 + hash(slot + 7) * .08;
  const progress = (phase - start) / duration;
  const burst = !reducedMotion && progress > 0 && progress < 1 ? Math.sin(progress * Math.PI) : 0;
  return {
    burst, bandY: .12 + hash(slot + 13) * .76,
    bandHeight: .018 + hash(slot + 19) * .025,
    shear: burst ? (hash(slot + 23) > .5 ? 1 : -1) * .018 * burst : 0,
    noiseFrame: reducedMotion ? 0 : Math.floor(time * 30) % 30000,
  };
}

export function analogResolution(width, height) {
  const scale = Math.min(1, 576 / Math.max(1, height), 1024 / Math.max(1, width));
  return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))];
}

export class AnalogVideo {
  constructor(renderer) {
    this.renderer = renderer;
    this.time = 0;
    this.motionPreference = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");
    this.target = new THREE.WebGLRenderTarget(1, 1, {
      type: renderer.extensions.has("EXT_color_buffer_float") ? THREE.HalfFloatType : THREE.UnsignedByteType,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      depthBuffer: true, stencilBuffer: false,
    });
    this.target.texture.name = "FPV analog video buffer";
    this.material = new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false,
      uniforms: {
        video: {value: this.target.texture}, resolution: {value: new THREE.Vector2(1,1)},
        noiseFrame: {value: 0}, burst: {value: 0}, bandY: {value: .5},
        bandHeight: {value: .02}, shear: {value: 0},
      },
      vertexShader: `varying vec2 vUv;
        void main() { vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
      fragmentShader: `
        uniform sampler2D video;
        uniform vec2 resolution;
        uniform float noiseFrame, burst, bandY, bandHeight, shear;
        varying vec2 vUv;
        float noise(vec2 p) { return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
        void main() {
          vec2 pixel=1./resolution;
          float line=floor(vUv.y*resolution.y);
          float band=1.-smoothstep(bandHeight*.35,bandHeight,abs(vUv.y-bandY));
          float rowNoise=noise(vec2(line,noiseFrame));
          vec2 uv=vUv;
          // Horizontal sync slip affects a narrow group of video lines only.
          uv.x+=band*(shear+(rowNoise-.5)*burst*.012);
          uv=clamp(uv,pixel*.5,1.-pixel*.5);
          vec3 color=texture2D(video,uv).rgb;
          // Chroma has less horizontal bandwidth than the luminance signal.
          vec3 bleed=(texture2D(video,clamp(uv+vec2(pixel.x*1.4,0.),pixel*.5,1.-pixel*.5)).rgb+
                      texture2D(video,clamp(uv-vec2(pixel.x*1.4,0.),pixel*.5,1.-pixel*.5)).rgb)*.5;
          float luma=dot(color,vec3(.299,.587,.114));
          float bleedLuma=dot(bleed,vec3(.299,.587,.114));
          color=vec3(luma)+(bleed-vec3(bleedLuma))*.88;
          gl_FragColor=vec4(max(color,vec3(0.)),1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          float grain=noise(vec2(floor(vUv.x*resolution.x)+noiseFrame*17.,line+noiseFrame*3.));
          float scan=.985+.015*cos(vUv.y*resolution.y*3.14159265);
          vec3 display=gl_FragColor.rgb*scan+(grain-.5)*.045;
          // Sparse black/white dropout flecks and one short snow band.
          float dropout=step(.91,rowNoise)*band*burst;
          display=mix(display,vec3(grain),band*burst*.38);
          display=mix(display,vec3(step(.5,grain)),dropout*.48);
          float vignette=1.-.10*pow(length((vUv-.5)*1.4142),2.);
          gl_FragColor=vec4(clamp(display*vignette,0.,1.),1.);
        }`,
    });
    // One full-screen triangle; no second scene render, CPU image readback,
    // canvas copy, animated SVG filter or full-resolution blur chain.
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute([-1,-1,0, 3,-1,0, -1,3,0],3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute([0,0, 2,0, 0,2],2));
    this.screen = new THREE.Scene();
    const mesh = new THREE.Mesh(geometry,this.material); mesh.frustumCulled=false;
    this.screen.add(mesh); this.camera=new THREE.Camera(); this.geometry=geometry;
  }
  reset() { this.time=0; }
  render(scene, camera, dt) {
    this.time += Math.max(0,Math.min(.1,Number.isFinite(dt)?dt:0));
    const renderer=this.renderer, canvas=renderer.domElement;
    const [width,height]=analogResolution(canvas.width,canvas.height);
    if(this.target.width!==width||this.target.height!==height)this.target.setSize(width,height);
    this.material.uniforms.resolution.value.set(width,height);
    for(const [key,value] of Object.entries(analogSignal(this.time,this.motionPreference?.matches)))
      this.material.uniforms[key].value=value;
    const previousTarget=renderer.getRenderTarget(), autoReset=renderer.info.autoReset;
    if(autoReset)renderer.info.reset();
    renderer.info.autoReset=false;
    try {
      renderer.setRenderTarget(this.target); renderer.render(scene,camera);
      renderer.setRenderTarget(previousTarget); renderer.render(this.screen,this.camera);
    } finally {
      renderer.setRenderTarget(previousTarget); renderer.info.autoReset=autoReset;
    }
  }
  dispose() { this.target.dispose(); this.material.dispose(); this.geometry.dispose(); }
}
