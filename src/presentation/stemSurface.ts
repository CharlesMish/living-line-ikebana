import * as THREE from "three";
import type { Branch } from "../core/types.ts";

/** Material-frame coordinates derived from the existing rings and rest lengths.
 * No positions, normals, indices, branch radii, or ray proxies change. */
export function attachStemSurface(geometry: THREE.BufferGeometry, branch: Branch) {
  const count = geometry.getAttribute("position").count;
  const rings = branch.points.length;
  // Visible tubes use ten facets plus two eleven-vertex caps.
  if (count !== rings * 10 + 22) return;
  const values = new Float32Array(count * 3);
  let distance = 0;
  for (let ring = 0; ring < rings; ring++) {
    if (ring) distance += branch.restLengths[ring - 1];
    for (let facet = 0; facet < 10; facet++) {
      const index = ring * 10 + facet;
      values[index * 3] = Math.cos(facet / 10 * Math.PI * 2); values[index * 3 + 1] = Math.sin(facet / 10 * Math.PI * 2); values[index * 3 + 2] = distance;
    }
  }
  for (let index = rings * 10; index < count; index++) {
    values[index * 3] = 1; values[index * 3 + 1] = 0; values[index * 3 + 2] = index < rings * 10 + 11 ? 0 : distance;
  }
  geometry.setAttribute("stemSurface", new THREE.BufferAttribute(values, 3));
}

/** Shading only: faint longitudinal fibers, anchored to the material frame.
 * Default-off. Lighting, roughness and silhouettes remain the accepted draw. */
export function installStemSurface(material: THREE.MeshStandardMaterial, enabled: boolean) {
  const strength = { value: enabled ? 0.075 : 0 };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.stemFiberStrength = strength;
    shader.vertexShader = `attribute vec3 stemSurface; varying vec3 vStemSurface;\n${shader.vertexShader}`
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvStemSurface = stemSurface;");
    shader.fragmentShader = `uniform float stemFiberStrength; varying vec3 vStemSurface;\n${shader.fragmentShader}`
      .replace("#include <color_fragment>", `#include <color_fragment>
        float angle = atan(vStemSurface.y, vStemSurface.x);
        float fibers = 0.5 + 0.5 * sin(angle * 8.0 + 0.24 * sin(vStemSurface.z * 9.0));
        float variation = 0.5 + 0.5 * sin(vStemSurface.z * 18.0 + angle);
        diffuseColor.rgb *= 1.0 - stemFiberStrength * fibers * (0.65 + 0.35 * variation);`);
  };
  material.customProgramCacheKey = () => "photo-fibers-v1";
  material.needsUpdate = true;
  return (value: boolean) => { strength.value = value ? 0.075 : 0; };
}
