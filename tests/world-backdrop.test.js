import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWorldBackdrop,BACKDROP_PROFILES} from '../web/game/world-backdrop.js';

for(const [kind,size] of [['park',800],['circuit',800],['construction',600],['city',600],['playground',84]]) {
  test(`${kind}: distant scenery stays outside flight bounds, is deterministic, cheap and releases its resources`,()=>{
    const scene=new THREE.Scene(),map={id:kind,kind,size};
    const a=createWorldBackdrop(scene,map),b=createWorldBackdrop(scene,map);
    try {
      assert.equal(a.root.children.length,b.root.children.length);
      assert.ok(a.root.children.length<=6,'bounded extra draw batches');
      let triangles=0,geometries=0,materials=new Set();
      const p=new THREE.Vector3(),matrix=new THREE.Matrix4();
      a.root.children.forEach((mesh,i)=>{
        assert.equal(mesh.castShadow,false);assert.equal(mesh.receiveShadow,false);
        assert.ok(mesh.geometry.attributes.position.array.every(Number.isFinite));
        assert.deepEqual(mesh.geometry.attributes.position.array,b.root.children[i].geometry.attributes.position.array);
        triangles+=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3*(mesh.count??1);
        mesh.geometry.addEventListener('dispose',()=>geometries++);materials.add(mesh.material);
        if(mesh.isInstancedMesh)for(let i=0;i<mesh.count;i++) {
          mesh.getMatrixAt(i,matrix);p.setFromMatrixPosition(matrix);
          const e=matrix.elements,radius=Math.max(Math.abs(e[0])+Math.abs(e[8]),Math.abs(e[2])+Math.abs(e[10]))/2;
          assert.ok(Math.max(Math.abs(p.x),Math.abs(p.z))-radius>size/2+15,'all decoration clears the playable square');
        }
      });
      const terrain=a.root.children[0];
      for(let i=0;i<terrain.geometry.attributes.position.count;i++) {
        const x=terrain.geometry.attributes.position.getX(i),z=terrain.geometry.attributes.position.getZ(i);
        assert.ok(Math.hypot(x,z)>=a.root.userData.innerRadius-.01);
      }
      assert.ok(terrain.geometry.attributes.normal.getY(200)>0,'terrain faces upward');
      assert.ok(triangles<36000,`background triangle budget: ${triangles}`);
      let disposedMaterials=0;materials.forEach(m=>m.addEventListener('dispose',()=>disposedMaterials++));
      a.dispose();assert.equal(geometries,a.root.children.length);assert.equal(disposedMaterials,materials.size);
      assert.ok(!scene.children.includes(a.root));
    }finally{b.dispose();a.root.removeFromParent();}
    assert.equal(scene.children.length,0);
  });
}
test('each map has its own background silhouette and palette',()=>{
  assert.equal(new Set(Object.values(BACKDROP_PROFILES).map(p=>p.seed)).size,5);
});

test('backdrop terrain reuses the ground shading and borrows its texture without disposing it',()=>{
  const scene=new THREE.Scene(),worldRoot=new THREE.Group(),texture=new THREE.Texture();
  const source=new THREE.MeshStandardMaterial({color:0x9a886b,roughness:.95,map:texture,vertexColors:true});
  let parentHookCalls=0;source.onBeforeCompile=()=>{parentHookCalls++;};
  const geometry=new THREE.BoxGeometry(1,1,1),ground=new THREE.Mesh(geometry,source);
  ground.name='bare-landscape-600';worldRoot.add(ground);
  const backdrop=createWorldBackdrop(scene,{id:'betonudvar',kind:'construction',size:600},worldRoot);
  try {
    const terrain=backdrop.root.children[0],material=terrain.material;
    assert.ok(material.isMeshStandardMaterial);assert.notEqual(material,source);
    assert.equal(material.map,texture);assert.equal(material.roughness,source.roughness);
    assert.ok(material.color.equals(source.color));assert.equal(terrain.receiveShadow,false);
    const shader={vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <fog_fragment>'};
    material.onBeforeCompile(shader);assert.equal(parentHookCalls,1,'preserve the ground texture hook');
    assert.ok(shader.fragmentShader.includes('mix(1.0,0.55,smoothstep('),'only the distant ranges soften the fog');
    let textureDisposals=0,sourceDisposals=0;
    texture.addEventListener('dispose',()=>textureDisposals++);source.addEventListener('dispose',()=>sourceDisposals++);
    backdrop.dispose();assert.equal(textureDisposals,0);assert.equal(sourceDisposals,0);
    assert.equal(worldRoot.children.length,1,'the original world remains owned by its environment');
  } finally {source.dispose();texture.dispose();geometry.dispose();}
});
