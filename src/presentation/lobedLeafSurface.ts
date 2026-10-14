import * as THREE from "three";

/** Subordinate reverse colors follow the selected foliage tone. They are derived
 * presentation, not an additional scene option or saved botanical property. */
export function lobedLeafReverseColor(leafColor: number): THREE.Color {
  return new THREE.Color(leafColor).lerp(new THREE.Color(0xb8c0a0), 0.26);
}

export function lobedLeafReverseVeinColor(leafColor: number, veinColor: number): number {
  return lobedLeafReverseColor(leafColor).lerp(new THREE.Color(veinColor), 0.26).getHex();
}

/** One double-sided lamina: the original front shader is unchanged. Using
 * gl_FrontFacing avoids coplanar front/rear meshes (and their transparent sort
 * ambiguity), while Three's existing normal flip lights the reverse correctly.
 * Opacity, emissive preview tint and alpha continue through the standard shader.
 */
export function installLobedLeafReverse(material: THREE.MeshStandardMaterial, leafColor: number) {
  const reverseColor = { value: lobedLeafReverseColor(leafColor) };
  material.onBeforeCompile = shader => {
    shader.uniforms.lobedReverseColor = reverseColor;
    shader.fragmentShader = `uniform vec3 lobedReverseColor;\n${shader.fragmentShader}`
      .replace("#include <color_fragment>", `#include <color_fragment>
        if (!gl_FrontFacing) {
          diffuseColor.rgb = lobedReverseColor;
          #if defined( USE_COLOR_ALPHA ) || defined( USE_COLOR )
            diffuseColor.rgb *= mix(vec3(1.0), vColor.rgb, 0.4);
          #endif
        }`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
        if (!gl_FrontFacing) roughnessFactor = max(roughnessFactor, 0.86);`);
  };
  material.customProgramCacheKey = () => "living-line-lobed-reverse-v1";
  return (nextLeafColor: number) => { reverseColor.value.copy(lobedLeafReverseColor(nextLeafColor)); };
}
