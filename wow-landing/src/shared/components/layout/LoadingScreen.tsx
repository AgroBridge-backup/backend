import React from 'react';
import { Html } from '@react-three/drei';

export function LoadingScreen() {
  return (
    <Html center>
      <div style={{
        color: 'white',
        fontSize: '2rem',
        fontFamily: 'sans-serif',
      }}>
        Loading Experience...
      </div>
    </Html>
  );
}