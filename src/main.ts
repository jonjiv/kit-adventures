import './style.css';
import * as THREE from 'three';
import { Input } from './engine/input';
import { FixedStepper, runLoop } from './engine/loop';
import { createRenderer } from './engine/renderer';
import { PlayScene } from './playScene';
import { TUNING } from './player/tuning';
import { FpsMeter } from './ui/fps';
import { PlayHint } from './ui/playHint';
import { loadLevel } from './world/level';

async function start(app: HTMLElement) {
  const camera = new THREE.PerspectiveCamera(TUNING.camera.fov, 1, 0.1, 1000);
  const renderer = createRenderer(app, camera);
  const input = new Input(renderer.domElement);

  const level = await loadLevel(`${import.meta.env.BASE_URL}levels/test.json`);
  const play = new PlayScene(level, camera, input);

  // Handy for poking at the game from the browser console while developing.
  if (import.meta.env.DEV) Object.assign(window, { kit: { play, camera } });

  const fps = new FpsMeter(app);
  const hint = new PlayHint(app, input);

  runLoop(
    new FixedStepper(TUNING.physicsHz, TUNING.maxFrameTime),
    (step) => {
      play.fixedUpdate(step);
      input.endStep();
    },
    (alpha, dt) => {
      play.render(alpha, dt);
      hint.update(dt);
      renderer.render(play.scene, camera);
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
