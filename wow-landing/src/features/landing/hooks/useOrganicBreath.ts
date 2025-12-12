import { useEffect, useRef, useState } from 'react';

type Node = {
  index: number;
};

type AnimationCallback = (index: number, scale: number, opacity: number) => void;

export function useOrganicBreath(nodes: Node[], cb: AnimationCallback) {
  const [startTime] = useState(() => Date.now());
  const start = useRef(startTime);

  useEffect(() => {
    if (!nodes || nodes.length === 0) return;

    let anim: number;
    function animate() {
      const t = (Date.now() - start.current) / 1000;
      nodes.forEach((node) => {
        const phase = t * 0.8 + node.index * 0.015;
        const scale = 0.85 + 0.3 * Math.sin(phase);
        const opacity = 0.6 + 0.4 * Math.abs(Math.sin(phase));
        cb(node.index, scale, opacity);
      });
      anim = requestAnimationFrame(animate);
    }
    
    animate();
    return () => cancelAnimationFrame(anim);
  }, [nodes, cb]);
}