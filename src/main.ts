import './style.css';
import * as THREE from 'three';
import { Sounds } from './audio/sounds';
import { Input } from './engine/input';
import { FixedStepper, runLoop } from './engine/loop';
import { createRenderer } from './engine/renderer';
import { PlayScene } from './playScene';
import { TUNING } from './player/tuning';
import { FpsMeter } from './ui/fps';
import { MuteButton } from './ui/muteButton';
import { PlayHint } from './ui/playHint';
import { loadLevel } from './world/level';

const LEVELS = [
  { id: 'garden', name: 'Garden Path', file: 'garden.json' },
  { id: 'gym', name: 'Parkour Gym', file: 'gym.json' },
  { id: 'city', name: 'City Rooftops', file: 'city.json' },
  { id: 'moon', name: 'Moon Base', file: 'moon.json' },
];

async function start(app: HTMLElement) {
  const camera = new THREE.PerspectiveCamera(TUNING.camera.fov, 1, TUNING.camera.near, TUNING.camera.far);
  const renderer = createRenderer(app, camera);
  const input = new Input(renderer.domElement, app);
  const sounds = new Sounds();

  let play: PlayScene;
  let loading = false;
  const open = async (id: string) => {
    const choice = LEVELS.find((l) => l.id === id) ?? LEVELS[0];
    loading = true;
    const level = await loadLevel(`${import.meta.env.BASE_URL}levels/${choice.file}`);
    play?.dispose();
    play = new PlayScene(level, camera, input, sounds);
    hint.setCurrent(choice.id);
    loading = false;
    // Handy for poking at the game from the browser console while developing.
    if (import.meta.env.DEV) Object.assign(window, { kit: { play, camera, open, sounds } });
  };

  const hint = new PlayHint(app, input, LEVELS, (id) => {
    sounds.play('click');
    void open(id);
  });
  new MuteButton(app, sounds);
  const fps = new FpsMeter(app);
  await open(LEVELS[0].id);

  runLoop(
    new FixedStepper(TUNING.physicsHz, TUNING.maxFrameTime),
    (step) => {
      // The world waits while the start panel (pause) is showing.
      if (!loading && input.playing) play.fixedUpdate(step);
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
