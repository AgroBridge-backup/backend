import React, { useRef } from 'react';
import * as THREE from 'three';
import backgroundVertexShader from '../shaders/backgroundVertex.glsl?raw';
import backgroundFragmentShader from '../shaders/backgroundFragment.glsl?raw';

export function Background() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = {
    uTopColor: { value: new THREE.Color('#181E2A') }, // Deep Space
    uBottomColor: { value: new THREE.Color('#0a0e1a') }, // Darker Deep Space
    uOffset: { value: 0 },
    uExponent: { value: 0.6 },
  };

  return (
    <mesh scale={1000}>
      <sphereGeometry args={[1, 32, 32]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={backgroundVertexShader}
        fragmentShader={backgroundFragmentShader}
        uniforms={uniforms}
        side={THREE.BackSide}
      />
    </mesh>
  );
}
