import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { PhotoGrade } from "../../src/presentation/photoGrade.ts";
import { adjustedPhotoPixel, adjustedPremultipliedPhotoPixel, NEUTRAL_PHOTO_ADJUSTMENTS, validatePhotoAdjustments } from "../../src/presentation/photoAdjustments.ts";
import { ThreeStudio } from "../../src/presentation/ThreeStudio.ts";
const neutral = { ...NEUTRAL_PHOTO_ADJUSTMENTS };

test("neutral photo math is exact; exposure, saturation, warmth and contrast have bounded named effects", () => {
  const colors: [number,number,number,number][] = [[0,0,0,0], [.12,.38,.83,1], [.9,.2,.5,.2], [1,1,1,1]];
  for (const color of colors) assert.deepEqual(adjustedPhotoPixel(color, [0,0], neutral), color);
  const grey: [number,number,number,number] = [.4,.4,.4,1];
  assert.ok(adjustedPhotoPixel(grey, [.5,.5], { ...neutral, exposure: 1 })[0] > .54);
  assert.ok(adjustedPhotoPixel(grey, [.5,.5], { ...neutral, exposure: -1 })[0] < .3);
  const desaturated = adjustedPhotoPixel([.8,.2,.1,1], [.5,.5], { ...neutral, saturation: -1 });
  assert.ok(Math.abs(desaturated[0] - desaturated[1]) < 1e-12 && Math.abs(desaturated[1] - desaturated[2]) < 1e-12);
  const warm = adjustedPhotoPixel(grey, [.5,.5], { ...neutral, warmth: 1 });
  assert.ok(warm[0] > warm[1] && warm[1] > warm[2]);
  const contrast = adjustedPhotoPixel([.2,.5,.8,1], [.5,.5], { ...neutral, contrast: .5 });
  assert.ok(contrast[0] < .2 && Math.abs(contrast[1] - .5) < 1e-12 && contrast[2] > .8);
  for (const exposure of [-1,1]) for (const contrast of [-.5,.5]) for (const warmth of [-1,1]) for (const saturation of [-1,.6]) {
    for (const color of colors) {
      const result = adjustedPhotoPixel(color, [0,0], { ...neutral, exposure, contrast, warmth, saturation, vignette: 1 });
      assert.ok(result.every(n => Number.isFinite(n) && n >= 0 && n <= 1)); assert.equal(result[3], color[3]);
    }
  }
});

test("vignette changes color, never alpha; frame-relative falloff is smooth and leaves the centre alone", () => {
  const color: [number,number,number,number] = [.6,.4,.3,.24], recipe = { ...neutral, vignette: 1 };
  const centre = adjustedPhotoPixel(color, [.5,.5], recipe), edge = adjustedPhotoPixel(color, [0,0], recipe);
  assert.equal(centre[3], .24); assert.equal(edge[3], .24);
  for (let i=0;i<3;i++) { assert.ok(Math.abs(centre[i] - color[i]) < 1e-12); assert.ok(edge[i] < centre[i]); }
  assert.deepEqual(adjustedPhotoPixel([0,0,0,0], [0,0], recipe), [0,0,0,0]);
  assert.deepEqual(adjustedPhotoPixel(color, [0,0], recipe), adjustedPhotoPixel(color, [1,1], recipe));
  let previous = centre[0];
  for (let i=0;i<=100;i++) { const sample = adjustedPhotoPixel(color, [.5+i/200,.5+i/200], recipe)[0]; assert.ok(sample <= previous+1e-10); previous=sample; }
});

test("photo recipe refuses future, malformed, unknown and non-finite data instead of normalizing it away", () => {
  assert.deepEqual(validatePhotoAdjustments(neutral), neutral);
  for (const patch of [{ version: 2 }, { unexpected: 1 }, { exposure: NaN }, { saturation: Infinity }, { vignette: -1 }, { warmth: 1.1 }, { contrast: ".1" }, { exposure: undefined }]) assert.throws(() => validatePhotoAdjustments({ ...neutral, ...patch }));
});

function rendererHarness() {
  let width = 640, height = 480, fail = false;
  const copied: THREE.FramebufferTexture[] = [], scenes: THREE.Scene[] = [], disposals = new Map<object,number>();
  const watch = (resource: THREE.EventDispatcher) => {
    if (disposals.has(resource)) return;
    disposals.set(resource, 0); resource.addEventListener("dispose", () => disposals.set(resource, disposals.get(resource)! + 1));
  };
  const renderer = {
    info: { autoReset: true },
    getDrawingBufferSize: (size: THREE.Vector2) => size.set(width,height),
    copyFramebufferToTexture: (texture: THREE.FramebufferTexture) => { copied.push(texture); watch(texture); },
    render: (scene: THREE.Scene) => {
      assert.equal(renderer.info.autoReset, false); scenes.push(scene);
      const mesh = scene.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
      watch(mesh.geometry); watch(mesh.material);
      assert.equal(mesh.material.blending, THREE.NoBlending); assert.equal(mesh.material.toneMapped, false);
      assert.equal(mesh.material.depthWrite, false); assert.equal(mesh.material.depthTest, false);
      assert.equal(mesh.material.uniforms.photo.value, copied.at(-1));
      if (fail) throw new Error("synthetic render failure");
    },
  };
  return { renderer: renderer as unknown as THREE.WebGLRenderer, copied, scenes, disposals, size: (w:number,h:number) => { width=w;height=h; }, set fail(value:boolean) { fail=value; } };
}

test("GPU grade owns one texture and triangle; neutral bypass, resized export, reset and disposal have bounded lifetimes", () => {
  const h = rendererHarness(), grade = new PhotoGrade();
  grade.apply(h.renderer); assert.equal(h.copied.length,0);
  grade.set({ ...neutral, saturation:.2 }); grade.apply(h.renderer);
  const first = h.copied[0], scene = h.scenes[0];
  assert.equal(first.image.width,640); assert.equal(first.image.height,480);
  grade.apply(h.renderer); assert.equal(h.copied[1],first); assert.equal(h.scenes[1],scene);
  h.size(1600,1200); grade.apply(h.renderer);
  assert.equal(h.disposals.get(first),1); assert.notEqual(h.copied[2],first); assert.equal(h.copied[2].image.width,1600);
  assert.equal(h.scenes[2],scene);
  grade.set(neutral); grade.apply(h.renderer); assert.equal(h.copied.length,3);
  assert.ok([...h.disposals.values()].every(n => n===1));
  grade.set({ ...neutral, exposure:.2 }); grade.apply(h.renderer); assert.notEqual(h.scenes.at(-1),scene);
  h.fail=true; assert.throws(() => grade.apply(h.renderer), /synthetic/); assert.equal(h.renderer.info.autoReset,true);
  grade.dispose(); grade.dispose(); assert.ok([...h.disposals.values()].every(n=>n===1));
});

test("independent studios do not share mutable grade textures or recipes", () => {
  const h1=rendererHarness(), h2=rendererHarness(), g1=new PhotoGrade(), g2=new PhotoGrade();
  const recipe={ ...neutral, exposure:.5 }; g1.set(recipe); g2.set({ ...neutral, warmth:.5 }); recipe.exposure=-1;
  g1.apply(h1.renderer); g2.apply(h2.renderer);
  assert.notEqual(h1.copied[0],h2.copied[0]);
  assert.equal((h1.scenes[0].children[0] as THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>).material.uniforms.adjustments.value.x,.5);
  g1.dispose(); assert.ok([...h1.disposals.values()].every(n=>n===1)); assert.ok([...h2.disposals.values()].every(n=>n===0)); g2.dispose();
});

test("production render and capture share the grade path and capture restores renderer and projection on failure", () => {
  const camera = new THREE.PerspectiveCamera(44,4/3,.1,80), scene=new THREE.Scene(), calls: string[]=[];
  let size=new THREE.Vector2(640,480), ratio=1.5;
  const renderer = { render() { calls.push("scene"); }, getContext:()=>({isContextLost:()=>false}),
    getSize:(v:THREE.Vector2)=>v.copy(size), getPixelRatio:()=>ratio,
    setPixelRatio:(v:number)=>{ratio=v;}, setSize:(w:number,h:number)=>{size.set(w,h);},
  };
  const studio = Object.assign(Object.create(ThreeStudio.prototype), {
    options:{photography:true}, disposed:false, renderer, scene,camera, cameraTarget:new THREE.Vector3(),
    bendHandle:{group:{visible:false}},touchCue:{visible:false},canvas:{getBoundingClientRect:()=>({height:480})},
    photoGrade:{apply(){calls.push(`grade:${size.x}x${size.y}`);}},
  });
  const original=Object.getOwnPropertyDescriptor(globalThis,"document"), projection=camera.projectionMatrix.clone();
  Object.defineProperty(globalThis,"document",{configurable:true,value:{createElement:()=>({getContext:()=>({drawImage(){calls.push("copy");throw new Error("capture failure");}})})}});
  try {
    studio.renderNow(); assert.deepEqual(calls,["scene","grade:640x480"]); calls.length=0;
    assert.throws(()=>studio.capturePhotoFrame(1600,1200),/capture failure/);
    assert.deepEqual(calls,["scene","grade:1600x1200","copy","scene","grade:640x480"]);
    assert.equal(ratio,1.5); assert.deepEqual(size,new THREE.Vector2(640,480));assert.equal(camera.aspect,4/3);assert.deepEqual(camera.projectionMatrix,projection);
  } finally { if(original)Object.defineProperty(globalThis,"document",original);else Reflect.deleteProperty(globalThis,"document"); }
});


test("premultiplied cutout edges keep coverage and do not grow dark rims or a vignette rectangle", () => {
 const recipe={...neutral,exposure:.4,contrast:.15,warmth:.3,saturation:.2,vignette:.5};
 const opaque=adjustedPhotoPixel([.6,.4,.2,1],[.1,.2],recipe);
 for(const alpha of [1,.75,.3,.01]) {
  const source: [number,number,number,number]=[.6*alpha,.4*alpha,.2*alpha,alpha];
  const result=adjustedPremultipliedPhotoPixel(source,[.1,.2],recipe);
  assert.equal(result[3],alpha);
  for(let c=0;c<3;c++) assert.ok(Math.abs(result[c]/alpha-opaque[c])<1e-10);
 }
 assert.deepEqual(adjustedPremultipliedPhotoPixel([0,0,0,0],[0,0],recipe),[0,0,0,0]);
});
