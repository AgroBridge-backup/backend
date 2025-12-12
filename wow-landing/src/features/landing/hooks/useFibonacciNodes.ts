import { useMemo } from 'react';

const PHI = 1.618033988749895;
const GOLDEN_ANGLE = 137.5 * (Math.PI / 180);

export function useFibonacciNodes(count = 256) {
  return useMemo(() => {
    const nodes = [];
    for (let i = 0; i < count; i++) {
      const radius = Math.pow(PHI, i / 24);
      const theta = i * GOLDEN_ANGLE;
      const depthZ = -500 + ((1000 * i) / count); // -500 a 500 range
      
      nodes.push({
        x: radius * Math.cos(theta),
        y: radius * Math.sin(theta),
        z: depthZ,
        index: i
      });
    }
    return nodes;
  }, [count]);
}