import React, { useState, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const PHI = 1.618033988749895;
const GOLDEN_ANGLE = 137.5 * (Math.PI / 180);

export function DataParticles({ count = 500 }: { count?: number }) {
  const pointsRef = useRef<THREE.Points>(null);

  const [particles] = useState(() => {
    const temp = [];
    for (let i = 0; i < count; i++) {
      const progress = Math.random();
      const spiralIndex = i % 256;
      temp.push({ progress, spiralIndex, speed: 0.001 + Math.random() * 0.005 });
    }
    return temp;
  });

  useFrame(() => {
    if (pointsRef.current) {
      const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;
      
      particles.forEach((particle, i) => {
        particle.progress += particle.speed;
        if (particle.progress > 1) {
          particle.progress = 0;
        }

        const i_flow = particle.spiralIndex + particle.progress * 20;
        const radius = Math.pow(PHI, i_flow / 24) * (1 + (Math.random() - 0.5) * 0.2);
        const theta = i_flow * GOLDEN_ANGLE;
        const depthZ = -500 + ((1000 * i_flow) / 256);

        positions[i * 3] = radius * Math.cos(theta);
        positions[i * 3 + 1] = radius * Math.sin(theta);
        positions[i * 3 + 2] = depthZ;
      });

      pointsRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particles.length}
          array={new Float32Array(particles.length * 3)}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.5}
        color="#00D9FF"
        transparent
        opacity={0.7}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}