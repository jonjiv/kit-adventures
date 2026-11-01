import './style.css';
import * as THREE from 'three';
import { Sounds } from './audio/sounds';
import { Input } from './engine/input';
import { FixedStepper, runLoop } from './engine/loop';
import { createRenderer } from './engine/renderer';
import { createLeaderboard } from './leaderboard/leaderboard';
import { PlayScene } from './playScene';
import { TUNING } from './player/tuning';
import { FinishPanel } from './ui/finishPanel';
import { FpsMeter } from './ui/fps';
import { LeaderboardPanel } from './ui/leaderboardPanel';
import { MuteButton } from './ui/muteButton';
import { PlayHint } from './ui/playHint';
import { RaceHud } from './ui/raceHud';
import { loadLevel } from './world/level';

const LEVELS = [
  { id: 'tutorial', name: 'Tutorial', file: 'tutorial.json' },
  { id: 'garden', name: 'Garden Path', file: 'garden.json' },
  { id: 'city', name: 'City Rooftops', file: 'city.json' },
  { id: 'moon', name: 'Moon Base', file: 'moon.json' },
];

async function start(app: HTMLElement) {
  const camera = new THREE.PerspectiveCamera(TUNING.camera.fov, 1, TUNING.camera.near, TUNING.camera.far);
  const renderer = createRenderer(app, camera);
  const input = new Input(renderer.domElement, app);
  const sounds = new Sounds();
  const board = createLeaderboard();

  let play: PlayScene;
  let current = LEVELS[0];
  let loading = false;
  const open = async (id: string) => {
    const choice = LEVELS.find((l) => l.id === id) ?? LEVELS[0];
    loading = true;
    const level = await loadLevel(`${import.meta.env.BASE_URL}levels/${choice.file}`);
    play?.dispose();
    play = new PlayScene(level, camera, input, sounds);
    play.onFinish = (ms) => {
      // Free the mouse (or hide the touch controls) so the name can be typed.
      input.stopPlaying();
      finish.show(choice, ms);
    };
    current = choice;
    hint.setCurrent(choice.id);
    loading = false;
    // Handy for poking at the game from the browser console while developing.
    if (import.meta.env.DEV) Object.assign(window, { kit: { play, camera, open, sounds, board } });
  };
  /** Starts a level from the beginning, with a new countdown. */
  const race = (id: string) => {
    void open(id);
    input.startPlaying();
  };

  const hint = new PlayHint(app, input, LEVELS, {
    pick: (id) => {
      sounds.play('click');
      race(id);
    },
    // A finished race starts over; otherwise carry on where the cat is.
    resume: () => (play.race.phase === 'finished' ? race(current.id) : input.startPlaying()),
    leaderboard: () => {
      sounds.play('click');
      leaderboard.show(current.id, null, false);
    },
  });
  const finish = new FinishPanel(app, board, (level, score) => leaderboard.show(level.id, score, true));
  const leaderboard = new LeaderboardPanel(app, board, LEVELS, (playAgain) => {
    sounds.play('click');
    if (playAgain) race(current.id);
  });
  const hud = new RaceHud(app);
  new MuteButton(app, sounds);
  const fps = new FpsMeter(app);
  await open(LEVELS[0].id);

  runLoop(
    new FixedStepper(TUNING.physicsHz, TUNING.maxFrameTime),
    (step) => {
      // The world waits while the start panel (pause) is showing. After the
      // finish it keeps going a moment so the cat can land.
      if (!loading && (input.playing || play.race.phase === 'finished')) play.fixedUpdate(step);
      input.endStep();
    },
    (alpha, dt) => {
      play.render(alpha, dt);
      const covered = finish.open || leaderboard.open;
      hint.update(dt, covered);
      hud.update(play.race, !covered && (input.playing || play.race.phase !== 'countdown'));
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
