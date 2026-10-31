// The cat, built from rounded shapes in code, with cute big-head proportions
// and simple procedural animation: idle breathing, blinking and ear twitches,
// a gallop, jump poses, a front flip on the double jump, a twirl on wall jumps,
// leaning wall runs, ledge hangs, climbs, dash pounces, and landing squash.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { CatLook } from './catLook';
import type { PlayerState } from './playerController';
import { TUNING } from './tuning';

function lighten(color: number, amount: number): number {
  return new THREE.Color(color).lerp(new THREE.Color(0xffffff), amount).getHex();
}

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  return m;
}

const sphere = (r: number, w = 18, h = 14) => new THREE.SphereGeometry(r, w, h);

export interface CatMotion {
  /** Horizontal speed in meters per second. */
  speed: number;
  /** Up/down speed. */
  vy: number;
  state: PlayerState;
  /** Which side a wall is on during a wall run: -1 left, 1 right, 0 none. */
  wallSide: number;
}

export type CatTrigger = 'jump' | 'doubleJump' | 'wallJump' | 'land' | 'dash' | 'climb';

const BODY_Y = 0.36;
const FLIP_TIME = 0.42;
const TWIRL_TIME = 0.4;
const SQUASH_TIME = 0.2;
const STRETCH_TIME = 0.18;

export class CatModel {
  readonly root = new THREE.Group();
  private squash = new THREE.Group();
  private spin = new THREE.Group();
  private torso!: THREE.Mesh;
  private head!: THREE.Group;
  private eyes!: THREE.Group;
  private ears: THREE.Mesh[] = [];
  private legs: THREE.Group[] = [];
  private tail: THREE.Group[] = [];
  private materials: THREE.Material[] = [];

  private time = 0;
  private phase = 0;
  private blinkIn = 2;
  private blinkLeft = 0;
  private twitchIn = 3;
  private twitchLeft = 0;
  private twitchEar = 0;
  private flipLeft = 0;
  private twirlLeft = 0;
  private squashLeft = 0;
  private squashStrength = 0;
  private stretchLeft = 0;

  constructor(look: CatLook) {
    this.root.add(this.squash);
    this.squash.add(this.spin);
    this.spin.position.y = BODY_Y;
    this.build(look);
  }

  setLook(look: CatLook): void {
    this.spin.clear();
    this.disposeParts();
    this.legs = [];
    this.tail = [];
    this.ears = [];
    this.build(look);
  }

  private material(color: number, opacity = 1): THREE.Material {
    const m = new THREE.MeshLambertMaterial({ color, transparent: opacity < 1, opacity });
    this.materials.push(m);
    return m;
  }

  private build(look: CatLook): void {
    const fur = this.material(look.fur);
    const pat = this.material(look.patternColor);
    const light = this.material(lighten(look.fur, 0.6));
    const pink = this.material(0xf48aa8);
    const blush = this.material(0xff8fb0, 0.55);
    const dark = this.material(0x1c1420);
    const white = this.material(0xffffff);
    const eyeMat = this.material(look.eyes);

    // Everything hangs from `body`, shifted down so its children use heights
    // measured from the cat's feet, while `spin` pivots at the belly.
    const body = new THREE.Group();
    body.position.y = -BODY_Y;
    this.spin.add(body);

    // A short, round body with a pale chest.
    this.torso = mesh(new RoundedBoxGeometry(0.4, 0.32, 0.5, 4, 0.16), fur, 0, 0.38, -0.02);
    body.add(this.torso);
    const chest = mesh(sphere(0.13), light, 0, 0.37, 0.18);
    chest.scale.set(1.15, 1, 0.55);
    body.add(chest);

    if (look.pattern === 'stripes') {
      const band = new RoundedBoxGeometry(0.41, 0.33, 0.5, 4, 0.16).scale(1, 1, 0.09);
      for (const z of [-0.17, -0.04]) body.add(mesh(band, pat, 0, 0.385, z));
    } else if (look.pattern === 'spots') {
      const spot = sphere(0.065, 10, 8);
      const spots: [number, number, number, 'x' | 'y'][] = [
        [0.198, 0.4, 0.05, 'x'], [-0.198, 0.41, -0.12, 'x'], [0.198, 0.36, -0.17, 'x'],
        [0.07, 0.535, -0.12, 'y'], [-0.08, 0.535, 0.04, 'y'],
      ];
      for (const [x, y, z, flatAxis] of spots) {
        const s = mesh(spot, pat, x, y, z);
        s.scale.set(flatAxis === 'x' ? 0.3 : 1, flatAxis === 'y' ? 0.3 : 1, 1);
        body.add(s);
      }
    }

    // A big round head (cute animals have big heads), pivoting at the neck.
    this.head = new THREE.Group();
    this.head.position.set(0, 0.6, 0.2);
    body.add(this.head);
    const skull = mesh(sphere(0.27, 22, 16), fur, 0, 0.04, 0.04);
    skull.scale.set(1.08, 0.94, 0.95);
    this.head.add(skull);
    for (const side of [-1, 1]) this.head.add(mesh(sphere(0.09), fur, side * 0.17, -0.1, 0.08)); // chubby cheeks
    const muzzle = mesh(sphere(0.085), light, 0, -0.085, 0.26);
    muzzle.scale.set(1.4, 0.8, 0.8);
    this.head.add(muzzle);
    const nose = mesh(sphere(0.03, 12, 8), pink, 0, -0.045, 0.325);
    nose.scale.set(1.35, 0.8, 0.8);
    this.head.add(nose);
    // A little "w" mouth: two tiny smiles side by side.
    const smile = new THREE.TorusGeometry(0.019, 0.0065, 6, 12, Math.PI);
    for (const side of [-1, 1]) {
      const m = mesh(smile, dark, side * 0.019, -0.078, 0.322);
      m.rotation.z = Math.PI;
      this.head.add(m);
    }

    for (const side of [-1, 1]) {
      const ear = mesh(new THREE.ConeGeometry(0.115, 0.2, 14), fur, side * 0.15, 0.27, -0.02);
      ear.rotation.z = -side * 0.38;
      ear.add(mesh(new THREE.ConeGeometry(0.07, 0.13, 12), pink, 0, -0.02, 0.045));
      this.head.add(ear);
      this.ears.push(ear);

      const cheek = mesh(sphere(0.05, 12, 8), blush, side * 0.17, -0.055, 0.225);
      cheek.scale.set(1, 0.55, 0.4);
      cheek.rotation.y = side * 0.6;
      this.head.add(cheek);

      for (let i = 0; i < 2; i++) {
        const whisker = mesh(new THREE.BoxGeometry(0.17, 0.007, 0.007), white, side * 0.22, -0.075 + i * 0.026, 0.22);
        whisker.rotation.z = side * (i === 0 ? -0.12 : 0.12);
        this.head.add(whisker);
      }
    }
    if (look.pattern === 'stripes') {
      const stripe = new RoundedBoxGeometry(0.04, 0.03, 0.14, 2, 0.012);
      for (const x of [-0.065, 0, 0.065]) this.head.add(mesh(stripe, pat, x, 0.29 - Math.abs(x) * 0.4, 0.02));
    }

    // Big sparkly eyes, set low and wide: mostly dark with a colored rim and two shines.
    this.eyes = new THREE.Group();
    this.eyes.position.set(0, 0.02, 0.245);
    this.head.add(this.eyes);
    for (const side of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.set(side * 0.108, 0, 0);
      eye.rotation.y = side * 0.28;
      const iris = mesh(sphere(0.085, 16, 12), eyeMat);
      iris.scale.set(0.9, 1.1, 0.5);
      const pupil = mesh(sphere(0.062, 14, 10), dark, 0, 0.005, 0.016);
      pupil.scale.set(0.82, 1.05, 0.5);
      eye.add(iris, pupil,
        mesh(sphere(0.024, 8, 8), white, 0.024, 0.036, 0.046),
        mesh(sphere(0.012, 6, 6), white, -0.026, -0.028, 0.046));
      this.eyes.add(eye);
    }

    // Short, chubby legs pivoting at the shoulders and hips: front left, front right, back left, back right.
    const legGeo = new THREE.CapsuleGeometry(0.075, 0.1, 4, 12);
    const pawGeo = sphere(0.088, 14, 10);
    const pawMat = look.pattern === 'socks' ? pat : light;
    for (const [x, z] of [[0.12, 0.13], [-0.12, 0.13], [0.12, -0.17], [-0.12, -0.17]]) {
      const leg = new THREE.Group();
      leg.position.set(x, 0.26, z);
      leg.add(mesh(legGeo, fur, 0, -0.12, 0));
      const paw = mesh(pawGeo, pawMat, 0, -0.205, 0.02);
      paw.scale.set(1, 0.65, 1.2);
      leg.add(paw);
      body.add(leg);
      this.legs.push(leg);
    }

    // A fluffy tail that gets thicker toward the tip.
    let parent: THREE.Object3D = body;
    for (let i = 0; i < 6; i++) {
      const seg = new THREE.Group();
      if (i === 0) seg.position.set(0, 0.45, -0.25);
      else seg.position.y = 0.11;
      const striped = look.pattern === 'stripes' && i % 2 === 1;
      seg.add(mesh(new THREE.CapsuleGeometry(0.048 + i * 0.005, 0.07, 4, 10), striped ? pat : fur, 0, 0.055, 0));
      if (i === 5) seg.add(mesh(sphere(0.085), look.pattern === 'plain' ? fur : pat, 0, 0.13, 0));
      parent.add(seg);
      this.tail.push(seg);
      parent = seg;
    }
  }

  /** React to something the cat just did. */
  trigger(event: CatTrigger, landSpeed = 0): void {
    switch (event) {
      case 'jump':
        this.stretchLeft = STRETCH_TIME;
        break;
      case 'doubleJump':
        this.flipLeft = FLIP_TIME;
        this.stretchLeft = STRETCH_TIME;
        break;
      case 'wallJump':
        this.twirlLeft = TWIRL_TIME;
        this.stretchLeft = STRETCH_TIME;
        break;
      case 'land':
        this.squashLeft = SQUASH_TIME;
        this.squashStrength = THREE.MathUtils.clamp(landSpeed / 16, 0.25, 1);
        this.flipLeft = 0;
        break;
      case 'dash':
      case 'climb':
        this.flipLeft = 0;
        break;
    }
  }

  update(dt: number, m: CatMotion): void {
    this.time += dt;
    const ease = (rate: number) => 1 - Math.exp(-rate * dt);
    const toward = (obj: THREE.Object3D, axis: 'x' | 'y' | 'z', target: number, rate = 14) => {
      obj.rotation[axis] += (target - obj.rotation[axis]) * ease(rate);
    };
    const run = THREE.MathUtils.clamp(m.speed / TUNING.player.runSpeed, 0, 1);
    const grounded = m.state === 'ground';

    // Legs, body tilt and bob for each kind of movement.
    let bob = 0, pitch = 0, roll = 0;
    let stretch: [number, number, number] = [1, 1, 1];
    let tailStream = 1;
    if (grounded || m.state === 'wallRun' || m.state === 'climb') {
      const fast = grounded ? run : 1;
      this.phase += dt * (3 + 13 * fast);
      const amp = m.state === 'climb' ? 1.3 : 1.0 * fast;
      const offsets = [0, 0.5, Math.PI, Math.PI + 0.5];
      this.legs.forEach((leg, i) => toward(leg, 'x', Math.sin(this.phase + offsets[i]) * amp, 25));
      bob = Math.abs(Math.sin(this.phase)) * 0.045 * fast;
      this.torso.scale.y = 1 + Math.sin(this.time * 2.2) * 0.025 * (1 - fast);
      tailStream = grounded ? run : 1;
      if (m.state === 'wallRun') roll = m.wallSide * 0.5;
      if (m.state === 'climb') pitch = -0.6;
    } else if (m.state === 'ledge') {
      pitch = -1.0;
      this.legs.forEach((leg, i) => toward(leg, 'x', i < 2 ? -2.7 : 0.25 + Math.sin(this.time * 9 + i) * 0.15, 12));
      tailStream = 0.3;
    } else if (m.state === 'dash') {
      pitch = 0.12;
      stretch = [0.88, 0.85, 1.3];
      this.legs.forEach((leg, i) => toward(leg, 'x', i < 2 ? -1.3 : 1.3, 30));
    } else {
      const rising = m.vy > 0;
      this.legs.forEach((leg, i) => toward(leg, 'x', i < 2 ? (rising ? -0.9 : -0.45) : (rising ? 0.8 : -0.15), 12));
    }
    this.spin.position.y = BODY_Y + bob;
    toward(this.spin, 'z', roll, 10);

    // Head: looks around a little when idle; looks up at ledges.
    const idle = grounded ? 1 - run : 0;
    toward(this.head, 'y', Math.sin(this.time * 0.6) * 0.3 * idle, 4);
    const headTilt = m.state === 'ledge' ? 0.6 : grounded ? Math.sin(this.time * 0.9) * 0.05 * idle : m.vy > 0 ? -0.15 : 0.2;
    toward(this.head, 'x', headTilt, 8);
    toward(this.head, 'z', Math.sin(this.time * 0.45) * 0.12 * idle, 3); // cute head tilt

    // Tail: up and curly when relaxed, streaming back when moving.
    toward(this.tail[0], 'x', THREE.MathUtils.lerp(-0.6, -1.35, tailStream), 8);
    this.tail.forEach((seg, i) => {
      if (i > 0) toward(seg, 'x', THREE.MathUtils.lerp(0.28, 0.05, tailStream) + Math.sin(this.time * 6 - i) * 0.08 * tailStream, 10);
      // Each segment adds to the ones before it, so only the base swings much.
      const sway = i === 0 ? 0.3 : 0.06;
      seg.rotation.z = Math.sin(this.time * 2.4 - i * 0.6) * sway * (1 - 0.5 * tailStream);
    });

    // Blinks and ear twitches every few seconds.
    this.blinkIn -= dt;
    if (this.blinkIn <= 0) {
      this.blinkLeft = 0.13;
      this.blinkIn = 2.5 + Math.random() * 3;
    }
    this.blinkLeft = Math.max(0, this.blinkLeft - dt);
    this.eyes.scale.y = this.blinkLeft > 0 ? 0.12 : 1;
    this.twitchIn -= dt;
    if (this.twitchIn <= 0) {
      this.twitchLeft = 0.18;
      this.twitchEar = Math.random() < 0.5 ? 0 : 1;
      this.twitchIn = 2 + Math.random() * 4;
    }
    this.twitchLeft = Math.max(0, this.twitchLeft - dt);
    this.ears.forEach((ear, i) => {
      ear.rotation.x = i === this.twitchEar && this.twitchLeft > 0 ? -0.5 * Math.sin((this.twitchLeft / 0.18) * Math.PI) : 0;
    });

    // Front flip on the double jump; otherwise lean into the pose.
    if (this.flipLeft > 0) {
      this.flipLeft = Math.max(0, this.flipLeft - dt);
      this.spin.rotation.x = THREE.MathUtils.smootherstep(1 - this.flipLeft / FLIP_TIME, 0, 1) * Math.PI * 2;
    } else {
      if (this.spin.rotation.x > Math.PI) this.spin.rotation.x -= Math.PI * 2;
      toward(this.spin, 'x', pitch, 14);
    }
    // Twirl on wall jumps.
    if (this.twirlLeft > 0) {
      this.twirlLeft = Math.max(0, this.twirlLeft - dt);
      this.spin.rotation.y = THREE.MathUtils.smootherstep(1 - this.twirlLeft / TWIRL_TIME, 0, 1) * Math.PI * 2;
    } else {
      this.spin.rotation.y = 0;
    }

    // Squash on landing, stretch on take-off and dashes.
    let sy = 1;
    if (this.squashLeft > 0) {
      this.squashLeft = Math.max(0, this.squashLeft - dt);
      sy -= Math.sin((1 - this.squashLeft / SQUASH_TIME) * Math.PI) * 0.28 * this.squashStrength;
    }
    if (this.stretchLeft > 0) {
      this.stretchLeft = Math.max(0, this.stretchLeft - dt);
      sy += Math.sin((1 - this.stretchLeft / STRETCH_TIME) * Math.PI) * 0.15;
    }
    const sxz = 1 / Math.sqrt(sy);
    const s = this.squash.scale;
    const k = ease(20);
    s.set(
      s.x + (sxz * stretch[0] - s.x) * k,
      s.y + (sy * stretch[1] - s.y) * k,
      s.z + (sxz * stretch[2] - s.z) * k,
    );
  }

  private disposeParts(): void {
    this.root.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
    this.materials.forEach((m) => m.dispose());
    this.materials = [];
  }

  dispose(): void {
    this.disposeParts();
  }
}
