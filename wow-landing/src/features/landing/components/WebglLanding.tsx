import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom, DepthOfField, Vignette } from "@react-three/postprocessing";
import { Html } from "@react-three/drei";
import { NodosFibonacci } from "./NodosFibonacci";
import { DataParticles } from "./DataParticles";
import { AgricultureIcons } from "./AgricultureIcons";
import { GlassMorphUI } from "@shared/components/layout/GlassMorphUI";
import { LoadingScreen } from "@shared/components/layout/LoadingScreen";
import { usePerformanceMonitor } from "@shared/hooks/usePerformanceMonitor";

export function WebglLanding() {
  usePerformanceMonitor();

  return (
    <div id="webgl-root" style={{ width: "100vw", height: "100vh", background: "#0a0e1a" }}>
      <Canvas
        camera={{ position: [0, 0, 1200], fov: 75 }}
        gl={{ powerPreference: "high-performance", antialias: true }}
              >
                <ambientLight intensity={0.5} />
                <directionalLight position={[10, 10, 5]} intensity={1} />
                <Suspense fallback={<LoadingScreen />}>
                  {/* Cinematic Effects */}
                  <EffectComposer>
                    <Bloom luminanceThreshold={0.8} intensity={1.5} radius={0.4} />
                    <DepthOfField focusDistance={0} fov={0.02} aperture={0.025} bokehScale={2} />
                    <Vignette eskil={false} offset={0.1} darkness={0.5} />
                  </EffectComposer>
                  
                  {/* Scene Components */}
                  <NodosFibonacci />
                  <DataParticles />
                  <AgricultureIcons />
                </Suspense>
      
                {/* UI and overlays */}
                <Html 
                  fullscreen          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            pointerEvents: 'none',
          }}
        >
          <GlassMorphUI />
        </Html>
      </Canvas>
    </div>
  );
}