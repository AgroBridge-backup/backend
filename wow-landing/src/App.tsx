import { lazyLoad } from '@shared/utils/lazyLoad';
import './index.css';

// Lazy load WebglLanding (uses Three.js - heavy 3D library ~400KB)
const WebglLanding = lazyLoad(
  () => import('@features/landing/components/WebglLanding'),
  'WebglLanding'
);

function App() {
  return <WebglLanding />;
}

export default App;