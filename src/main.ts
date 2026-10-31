import './style.css';
import * as THREE from 'three';
import { FlyCamera } from './engine/flyCamera';
import { Input } from './engine/input';
import { FixedStepper, runLoop } from './engine/loop';
import { createRenderer } from './engine/renderer';
import { TUNING } from './player/tuning';
import { ExploreHint } from './ui/exploreHint';
import { FpsMeter } from './ui/fps';
import { loadLevel } from './world/level';
import { Sky } from './world/sky';
import { createAtlasTexture } from './world/textures';
import { THEME_STYLES } from './world/themes';
import { WorldRenderer } from './world/worldRenderer';

async function start(app: HTMLElement) {
  const camera = new THREE.PerspectiveCamera(TUNING.camera.fov, 1, 0.1, 1000);
  const renderer = createRenderer(app, camera);
  const scene = new THREE.Scene();

  const level = await loadLevel(`${import.meta.env.BASE_URL}levels/test.json`);
  const { world } = level;
  const worldRenderer = new WorldRenderer(world, createAtlasTexture());
  scene.add(worldRenderer.group);

  const style = THEME_STYLES[level.theme];
  const center = new THREE.Vector3(world.sx / 2, 3, world.sz / 2);
  const sky = new Sky(style, center, Math.max(world.sx, world.sz));
  sky.applyFog(scene, style);
  scene.add(sky.group);

  const input = new Input(renderer.domElement);
  const fly = new FlyCamera(camera);
  const startPos = level.start?.pos ?? [world.sx / 2, world.sy, world.sz / 2];
  camera.position.set(startPos[0] + 0.5, startPos[1] + 4, startPos[2] + 0.5);
  fly.lookAt(center);

  const fps = new FpsMeter(app);
  const hint = new ExploreHint(app, input);

  runLoop(
    new FixedStepper(TUNING.physicsHz, TUNING.maxFrameTime),
    () => input.endStep(),
    (_alpha, dt) => {
      fly.update(dt, input);
      sky.update(dt, camera.position);
      hint.update();
      renderer.render(scene, camera);
      fps.frame(dt);
    },
  );
}

const app = document.getElementById('app')!;
start(app).catch((err: unknown) => {
  console.error(err);
  const box = document.createElement('div');
  box.className = 'error-box';
  box.innerHTML = '<b>Oops! The game could not start.</b>';
  const detail = document.createElement('small');
  detail.textContent = err instanceof Error ? err.message : String(err);
  box.appendChild(detail);
  app.appendChild(box);
});
