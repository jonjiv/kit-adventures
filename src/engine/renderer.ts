import * as THREE from 'three';
import { TUNING } from '../player/tuning';
import { IS_MOBILE } from './device';

export function createRenderer(container: HTMLElement, camera: THREE.PerspectiveCamera): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  const g = TUNING.graphics;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, IS_MOBILE ? g.mobileMaxPixelRatio : g.maxPixelRatio));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const resize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();
  return renderer;
}
