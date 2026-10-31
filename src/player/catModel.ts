// The cat, built from rounded shapes in code, with simple procedural animation:
// idle breathing and blinking, a running gallop, jump poses, a front flip on
// the double jump, and a squash when landing.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { CatLook } from './catLook';
import { TUNING } from './tuning';

const mat = (color: number) => new THREE.MeshLambertMaterial({ color });

function lighten(color: number, amount: number): number {
  return new THREE.Color(color).lerp(new THREE.Color(0xffffff), amount).getHex();
}

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  return m;
}

const sphere = (r: number, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);

export interface CatMotion {
  /** Horizontal speed in meters per second. */
  speed: number;
  onGround: boolean;
  /** Up/down speed. */
  vy: number;
}

const BODY_Y = 0.4;
const FLIP_TIME = 0.42;
const SQUASH_TIME = 0.2;
const STRETCH_TIME = 0.18;

export class CatModel {
  readonly root = new THREE.Group();
  private squash = new THREE.Group();
  private spin = new THREE.Group();
  private torso!: THREE.Mesh;
  private head!: THREE.Group;
  private eyes!: THREE.Group;
  private legs: THREE.Group[] = [];
  private tail: THREE.Group[] = [];
  private materials: THREE.Material[] = [];

  private time = 0;
  private phase = 0;
  private blinkIn = 2;
  private blinkLeft = 0;
  private flipLeft = 0;
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
    this.build(look);
  }

  private material(color: number): THREE.Material {
    const m = mat(color);
    this.materials.push(m);
    return m;
  }

  private build(look: CatLook): void {
    const fur = this.material(look.fur);
    const pat = this.material(look.patternColor);
    const light = this.material(lighten(look.fur, 0.55));
    const pink = this.material(0xf49ab0);
    const dark = this.material(0x1a1418);
    const white = this.material(0xffffff);
    const eyeMat = this.material(look.eyes);

    // Everything hangs from `body`, which is shifted down so its children use
    // heights measured from the cat's feet, while `spin` pivots at the belly.
    const body = new THREE.Group();
    body.position.y = -BODY_Y;
    this.spin.add(body);

    this.torso = mesh(new RoundedBoxGeometry(0.38, 0.32, 0.62, 3, 0.15), fur, 0, 0.44, 0);
    body.add(this.torso);

    if (look.pattern === 'stripes') {
      const band = new RoundedBoxGeometry(0.39, 0.33, 0.62, 3, 0.15).scale(1, 1, 0.1);
      for (const z of [-0.18, 0, 0.16]) body.add(mesh(band, pat, 0, 0.445, z));
    } else if (look.pattern === 'spots') {
      const spot = sphere(0.07, 10, 8);
      const spots: [number, number, number, 'x' | 'y'][] = [
        [0.185, 0.46, 0.12, 'x'], [-0.185, 0.47, -0.1, 'x'], [0.185, 0.42, -0.2, 'x'],
        [0.06, 0.6, -0.14, 'y'], [-0.08, 0.6, 0.1, 'y'],
      ];
      for (const [x, y, z, flatAxis] of spots) {
        const s = mesh(spot, pat, x, y, z);
        s.scale.set(flatAxis === 'x' ? 0.3 : 1, flatAxis === 'y' ? 0.3 : 1, 1);
        body.add(s);
      }
    }

    // Head, pivoting at the neck.
    this.head = new THREE.Group();
    this.head.position.set(0, 0.66, 0.3);
    body.add(this.head);
    const skull = mesh(sphere(0.21), fur, 0, 0.02, 0.06);
    skull.scale.set(1.05, 0.92, 0.95);
    this.head.add(skull);
    const muzzle = mesh(sphere(0.09), light, 0, -0.06, 0.22);
    muzzle.scale.set(1.25, 0.8, 0.8);
    this.head.add(muzzle, mesh(sphere(0.03, 10, 8), pink, 0, -0.015, 0.285));

    for (const side of [-1, 1]) {
      const ear = mesh(new THREE.ConeGeometry(0.08, 0.17, 8), fur, side * 0.11, 0.2, 0.02);
      ear.rotation.z = -side * 0.3;
      const inner = mesh(new THREE.ConeGeometry(0.045, 0.1, 8), pink, 0, -0.02, 0.03);
      ear.add(inner);
      this.head.add(ear);
      for (let i = 0; i < 2; i++) {
        const whisker = mesh(new THREE.BoxGeometry(0.17, 0.007, 0.007), white, side * 0.15, -0.055 + i * 0.025, 0.23);
        whisker.rotation.z = side * (i === 0 ? -0.12 : 0.12);
        this.head.add(whisker);
      }
    }
    if (look.pattern === 'stripes') {
      const stripe = new RoundedBoxGeometry(0.035, 0.03, 0.13, 2, 0.012);
      for (const x of [-0.055, 0, 0.055]) this.head.add(mesh(stripe, pat, x, 0.205 - Math.abs(x) * 0.25, 0.05));
    }

    this.eyes = new THREE.Group();
    this.eyes.position.set(0, 0.045, 0.205);
    this.head.add(this.eyes);
    for (const side of [-1, 1]) {
      const eye = mesh(sphere(0.07, 14, 10), eyeMat, side * 0.092, 0, 0);
      eye.scale.set(1, 1.15, 0.6);
      const pupil = mesh(sphere(0.04, 10, 8), dark, 0, 0, 0.045);
      pupil.scale.set(0.5, 1.35, 0.5);
      const glint = mesh(sphere(0.017, 6, 6), white, 0.02, 0.028, 0.068);
      eye.add(pupil, glint);
      this.eyes.add(eye);
    }

    // Legs, pivoting at the shoulders and hips: front left, front right, back left, back right.
    const legGeo = new THREE.CapsuleGeometry(0.065, 0.2, 4, 10);
    const pawGeo = sphere(0.075, 12, 8);
    const pawMat = look.pattern === 'socks' ? pat : light;
    for (const [x, z] of [[0.11, 0.2], [-0.11, 0.2], [0.11, -0.2], [-0.11, -0.2]]) {
      const leg = new THREE.Group();
      leg.position.set(x, 0.36, z);
      leg.add(mesh(legGeo, fur, 0, -0.17, 0));
      const paw = mesh(pawGeo, pawMat, 0, -0.3, 0.02);
      paw.scale.set(1, 0.7, 1.25);
      leg.add(paw);
      body.add(leg);
      this.legs.push(leg);
    }

    // Tail: a chain of segments, each hanging off the one before.
    const segGeo = new THREE.CapsuleGeometry(0.045, 0.08, 4, 8);
    let parent: THREE.Object3D = body;
    for (let i = 0; i < 6; i++) {
      const seg = new THREE.Group();
      if (i === 0) seg.position.set(0, 0.52, -0.3);
      else seg.position.y = 0.12;
      const striped = look.pattern === 'stripes' && i % 2 === 1;
      seg.add(mesh(segGeo, striped ? pat : fur, 0, 0.06, 0));
      parent.add(seg);
      this.tail.push(seg);
      parent = seg;
    }

    this.root.traverse((o) => { o.castShadow = false; });
  }

  /** React to something the cat just did. */
  trigger(event: 'jump' | 'doubleJump' | 'land', landSpeed = 0): void {
    if (event === 'jump') this.stretchLeft = STRETCH_TIME;
    if (event === 'doubleJump') {
      this.flipLeft = FLIP_TIME;
      this.stretchLeft = STRETCH_TIME;
    }
    if (event === 'land') {
      this.squashLeft = SQUASH_TIME;
      this.squashStrength = THREE.MathUtils.clamp(landSpeed / 16, 0.25, 1);
      this.flipLeft = 0;
    }
  }

  update(dt: number, m: CatMotion): void {
    this.time += dt;
    const ease = (rate: number) => 1 - Math.exp(-rate * dt);
    const toward = (obj: THREE.Object3D, axis: 'x' | 'y' | 'z', target: number, rate = 14) => {
      obj.rotation[axis] += (target - obj.rotation[axis]) * ease(rate);
    };
    const run = THREE.MathUtils.clamp(m.speed / TUNING.player.runSpeed, 0, 1);

    // Legs and body bob.
    let bob = 0;
    if (m.onGround) {
      this.phase += dt * (3 + 12 * run);
      const amp = 0.95 * run;
      const offsets = [0, 0.5, Math.PI, Math.PI + 0.5];
      this.legs.forEach((leg, i) => toward(leg, 'x', Math.sin(this.phase + offsets[i]) * amp, 25));
      bob = Math.abs(Math.sin(this.phase)) * 0.04 * run;
      this.torso.scale.y = 1 + Math.sin(this.time * 2.2) * 0.02 * (1 - run);
    } else {
      const rising = m.vy > 0;
      this.legs.forEach((leg, i) => toward(leg, 'x', i < 2 ? (rising ? -0.9 : -0.45) : (rising ? 0.8 : -0.15), 12));
    }
    this.spin.position.y = BODY_Y + bob;

    // Head looks around a little when idle.
    toward(this.head, 'y', Math.sin(this.time * 0.6) * 0.25 * (1 - run) * (m.onGround ? 1 : 0), 4);
    toward(this.head, 'x', m.onGround ? 0 : (m.vy > 0 ? -0.2 : 0.25), 8);

    // Tail: up and swaying when relaxed, streaming back when running or jumping.
    const streaming = m.onGround ? run : 1;
    toward(this.tail[0], 'x', THREE.MathUtils.lerp(-0.7, -1.35, streaming), 8);
    this.tail.forEach((seg, i) => {
      if (i > 0) toward(seg, 'x', THREE.MathUtils.lerp(0.22, 0.05, streaming) + Math.sin(this.time * 6 - i) * 0.08 * streaming, 10);
      // Each segment adds to the ones before it, so only the base swings much.
      const sway = i === 0 ? 0.3 : 0.06;
      seg.rotation.z = Math.sin(this.time * 2.4 - i * 0.6) * sway * (1 - 0.5 * streaming);
    });

    // Blink every few seconds.
    this.blinkIn -= dt;
    if (this.blinkIn <= 0) {
      this.blinkLeft = 0.13;
      this.blinkIn = 2.5 + Math.random() * 3;
    }
    this.blinkLeft = Math.max(0, this.blinkLeft - dt);
    this.eyes.scale.y = this.blinkLeft > 0 ? 0.12 : 1;

    // Front flip on the double jump.
    if (this.flipLeft > 0) {
      this.flipLeft = Math.max(0, this.flipLeft - dt);
      const t = 1 - this.flipLeft / FLIP_TIME;
      this.spin.rotation.x = THREE.MathUtils.smootherstep(t, 0, 1) * Math.PI * 2;
    } else {
      this.spin.rotation.x = 0;
    }

    // Squash on landing, stretch on take-off.
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
    this.squash.scale.set(sxz, sy, sxz);
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
