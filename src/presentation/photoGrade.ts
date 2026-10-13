import * as THREE from "three";
import { NEUTRAL_PHOTO_ADJUSTMENTS, neutralPhotoAdjustments, validatePhotoAdjustments, type PhotoAdjustments } from "./photoAdjustments.ts";

/** The source is the finished default framebuffer, including the accepted
 * tone mapping, fog, background and antialiasing. Copying on GPU avoids both
 * a second lighting pipeline and synchronous CPU readback during a slider drag.
 * No colorspace/tone-mapping shader chunks run a second time. */
export const PHOTO_GRADE_FRAGMENT = /* glsl */`
  uniform sampler2D photo;
  uniform vec4 adjustments;
  uniform float vignette;
  varying vec2 photoUv;
  vec3 toLinear(vec3 c) {
    return mix(c / 12.92, pow(max((c + 0.055) / 1.055, 0.0), vec3(2.4)), step(vec3(0.04045), c));
  }
  vec3 toSrgb(vec3 c) {
    return mix(c * 12.92, 1.055 * pow(max(c, 0.0), vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
  }
  void main() {
    vec4 source = texture2D(photo, photoUv);
    if (source.a <= 0.0) { gl_FragColor = source; return; }
    // The default WebGL canvas is premultiplied. Grade its straight color,
    // then restore the same coverage, including antialiased cutout edges.
    vec3 c = source.rgb / source.a;
    c = toSrgb(toLinear(c) * exp2(adjustments.x) * exp2(vec3(0.16, 0.03, -0.16) * adjustments.z));
    c = (c - 0.5) * exp2(0.8 * adjustments.y) + 0.5;
    float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = clamp(mix(vec3(luma), c, 1.0 + adjustments.w), 0.0, 1.0);
    float radius = length((photoUv - 0.5) * 2.0) / sqrt(2.0);
    float edge = smoothstep(0.3, 1.0, radius);
    c = toSrgb(toLinear(c) * exp2(-1.1 * vignette * edge));
    gl_FragColor = vec4(c * source.a, source.a);
  }
`;

type GradeRenderer = Pick<THREE.WebGLRenderer, "copyFramebufferToTexture" | "render" | "getDrawingBufferSize" | "info">;
/** Independently owned per studio. Neutral has no allocation, copy or draw. */
export class PhotoGrade {
  private recipe: PhotoAdjustments = { ...NEUTRAL_PHOTO_ADJUSTMENTS };
  private resources?: { texture: THREE.FramebufferTexture; geometry: THREE.BufferGeometry; material: THREE.ShaderMaterial; scene: THREE.Scene; camera: THREE.Camera };
  private readonly size = new THREE.Vector2();
  private disposed = false;
  set(value?: PhotoAdjustments) {
    this.recipe = value ? validatePhotoAdjustments(value) : { ...NEUTRAL_PHOTO_ADJUSTMENTS };
    if (neutralPhotoAdjustments(this.recipe)) this.release();
  }
  apply(renderer: GradeRenderer) {
    if (this.disposed || neutralPhotoAdjustments(this.recipe)) return;
    renderer.getDrawingBufferSize(this.size);
    const width = this.size.x, height = this.size.y;
    if (width < 1 || height < 1) return;
    if (!this.resources) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute([-1,-1,0, 3,-1,0, -1,3,0], 3));
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute([0,0, 2,0, 0,2], 2));
      const texture = new THREE.FramebufferTexture(width, height);
      const material = new THREE.ShaderMaterial({
        uniforms: { photo: { value: texture }, adjustments: { value: new THREE.Vector4() }, vignette: { value: 0 } },
        vertexShader: "varying vec2 photoUv; void main() { photoUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
        fragmentShader: PHOTO_GRADE_FRAGMENT,
        depthTest: false, depthWrite: false, blending: THREE.NoBlending, toneMapped: false,
      });
      const scene = new THREE.Scene(), mesh = new THREE.Mesh(geometry, material); mesh.frustumCulled = false; scene.add(mesh);
      this.resources = { texture, geometry, material, scene, camera: new THREE.Camera() };
    }
    const r = this.resources;
    if (r.texture.image.width !== width || r.texture.image.height !== height) {
      r.texture.dispose(); r.texture = new THREE.FramebufferTexture(width, height); r.material.uniforms.photo.value = r.texture;
    }
    r.material.uniforms.adjustments.value.set(this.recipe.exposure, this.recipe.contrast, this.recipe.warmth, this.recipe.saturation);
    r.material.uniforms.vignette.value = this.recipe.vignette;
    renderer.copyFramebufferToTexture(r.texture);
    const autoReset = renderer.info.autoReset;
    try {
      // Keep scene + grade draw counts together in the existing diagnostics.
      renderer.info.autoReset = false;
      renderer.render(r.scene, r.camera);
    } finally { renderer.info.autoReset = autoReset; }
  }
  private release() {
    if (!this.resources) return;
    this.resources.texture.dispose(); this.resources.geometry.dispose(); this.resources.material.dispose();
    this.resources = undefined;
  }
  dispose() { if (!this.disposed) { this.release(); this.disposed = true; } }
}
