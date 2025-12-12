import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useFibonacciNodes } from '../hooks/useFibonacciNodes';

const dummy = new THREE.Object3D();

export function NodosFibonacci() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const lineRef = useRef<THREE.LineSegments>(null);

  const nodes = useFibonacciNodes(256);

  const [nodeData] = useState(() =>
    nodes.map(() => ({
      breathPhase: Math.random() * Math.PI * 2,
      breathSpeed: 0.1 + Math.random() * 0.2,
    })));

  // --- Lógica de Conexiones ---
  const connections = useMemo(() => {
    const points = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const pos1 = new THREE.Vector3(nodes[i].x, nodes[i].y, nodes[i].z);
        const pos2 = new THREE.Vector3(nodes[j].x, nodes[j].y, nodes[j].z);
        if (pos1.distanceTo(pos2) < 50) { // Umbral de distancia para conectar
          points.push(pos1, pos2);
        }
      }
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [nodes]);
  // --- Fin Lógica de Conexiones ---

  useEffect(() => {
    if (meshRef.current) {
      nodes.forEach((node, i) => {
        dummy.position.set(node.x, node.y, node.z);
        dummy.updateMatrix();
        meshRef.current!.setMatrixAt(i, dummy.matrix);
      });
      meshRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [nodes]);

  useFrame((state) => {
    if (!meshRef.current || !lineRef.current) return;

    const t = state.clock.getElapsedTime();
    
    // Animación de respiración de nodos
    nodes.forEach((node, i) => {
      const data = nodeData[i]!;
      meshRef.current!.getMatrixAt(i, dummy.matrix);
      const position = new THREE.Vector3().setFromMatrixPosition(dummy.matrix);
      const phase = t * 0.5 + data.breathPhase;
      const scale = 0.8 + 0.2 * Math.sin(phase);
      dummy.scale.set(scale, scale, scale);
      dummy.position.copy(position);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;

    // Animación de pulsación de conexiones
    (lineRef.current.material as THREE.LineBasicMaterial).opacity = 0.1 + (Math.sin(t * 0.5) * 0.5 + 0.5) * 0.2;
  });

  return (
    <group>
      <instancedMesh ref={meshRef} args={[undefined, undefined, 256]}>
        <sphereGeometry args={[8, 24, 24]} />
        <meshStandardMaterial 
          color="#436AB3"
          emissive="#00D9FF"
          emissiveIntensity={0.5}
          metalness={0.9}
          roughness={0.1}
        />
      </instancedMesh>
      {/* Renderizado de Conexiones */}
      <lineSegments ref={lineRef} geometry={connections}>
        <lineBasicMaterial color="#00D9FF" transparent opacity={0.1} />
      </lineSegments>
    </group>
  );
}
