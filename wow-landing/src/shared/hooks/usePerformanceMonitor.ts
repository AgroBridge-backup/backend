import { useEffect } from 'react';

// A simple performance monitor hook for logging FPS.
export function usePerformanceMonitor() {
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let frameCount = 0;
    let lastTime = performance.now();

    const monitor = () => {
      frameCount++;
      const time = performance.now();
      if (time - lastTime >= 1000) {
        // console.log(`FPS: ${frameCount}`); // Commented out for cleaner console
        frameCount = 0;
        lastTime = time;
      }
      requestAnimationFrame(monitor);
    };

    const animId = requestAnimationFrame(monitor);
    return () => cancelAnimationFrame(animId);
  }, []);
}