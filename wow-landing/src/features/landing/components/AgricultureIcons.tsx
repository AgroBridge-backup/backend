import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function AgricultureIcons() {
  const groupRef = useRef<THREE.Group>(null);

  const icons = [
    { position: new THREE.Vector3(20, 20, -100), type: 'fruit' },
    { position: new THREE.Vector3(-30, -10, -200), type: 'plant' },
    { position: new THREE.Vector3(40, -20, -300), type: 'fruit' },
    { position: new THREE.Vector3(-20, 30, -400), type: 'plant' },
  ];

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.05;
    }
  });

  return (
    <group ref={groupRef}>
      {icons.map((icon, i) => {
        if (icon.type === 'fruit') {
          return (
            <mesh key={i} position={icon.position}>
              <icosahedronGeometry args={[5, 0]} />
              <meshStandardMaterial color="#6B8E23" roughness={0.5} metalness={0.2} />
            </mesh>
          );
        } else {
          return (
            <mesh key={i} position={icon.position} rotation={[0, 0, Math.PI / 4]}>
              <coneGeometry args={[4, 8, 3]} />
              <meshStandardMaterial color="#00D9FF" roughness={0.6} metalness={0.5} />
            </mesh>
          );
        }
      })}
    </group>
  );
}