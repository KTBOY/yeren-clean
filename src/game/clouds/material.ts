import * as THREE from 'three'
import { WORLD_UNIFORMS } from '../materials'

/**
 * One shared lit material for every near & mid cloud. Roughness 1 / metalness 0 gives a soft,
 * non-plastic response under the scene's DirectionalLight sun + HemisphereLight sky. A world-normal
 * gradient paints bright sunlit tops and grey-blue volumetric bases; a sun-tinted fresnel rim
 * simulates forward scatter and softens the silhouette against the sky. Opaque (no transparent
 * pass) so it composites correctly with the far-plane sky dome. Weather drives the shared uniforms.
 */
export function cloudMaterial(): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, fog: false })
  mat.onBeforeCompile = shader => {
    shader.uniforms.uCloudTop = WORLD_UNIFORMS.uCloudTop
    shader.uniforms.uCloudBottom = WORLD_UNIFORMS.uCloudBottom
    shader.uniforms.uCloudSun = WORLD_UNIFORMS.uCloudSun
    shader.uniforms.uCloudRim = WORLD_UNIFORMS.uCloudRim
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCloudWorldNormal;')
      .replace('#include <beginnormal_vertex>', /* glsl */ `#include <beginnormal_vertex>
        vec3 cwN = objectNormal;
        #ifdef USE_INSTANCING
          cwN = mat3(instanceMatrix) * cwN;
        #endif
        vCloudWorldNormal = normalize(mat3(modelMatrix) * cwN);`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uCloudTop;\nuniform vec3 uCloudBottom;\nuniform vec3 uCloudSun;\nuniform float uCloudRim;\nvarying vec3 vCloudWorldNormal;')
      .replace('#include <color_fragment>', /* glsl */ `#include <color_fragment>
        float cwGrad = smoothstep(-0.55, 0.75, normalize(vCloudWorldNormal).y);
        diffuseColor.rgb *= mix(uCloudBottom, uCloudTop, cwGrad);`)
      .replace('#include <opaque_fragment>', /* glsl */ `
        float cwFres = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.0);
        outgoingLight += uCloudSun * cwFres * uCloudRim;
        #include <opaque_fragment>`)
  }
  mat.customProgramCacheKey = () => 'cw-cloud'
  return mat
}