import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { LevelObject } from '../world/levelFormat';

/** A wooden sign with big words, facing the way the player comes from. Use "\n" for a new line. */
export function buildSign(obj: LevelObject): THREE.Group {
  const group = new THREE.Group();
  group.position.fromArray(obj.pos);
  group.rotation.y = ((obj.yaw ?? 0) * Math.PI) / 180;

  const wood = new THREE.MeshLambertMaterial({ color: 0xb07a44 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.4, 10), wood);
  post.position.y = 0.7;
  const board = new THREE.Mesh(new RoundedBoxGeometry(1.8, 1.0, 0.12, 3, 0.05), wood);
  board.position.y = 1.55;

  const canvas = document.createElement('canvas');
  canvas.width = 360;
  canvas.height = 200;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f6e6c4';
  ctx.beginPath();
  ctx.roundRect(6, 6, 348, 188, 18);
  ctx.fill();
  ctx.fillStyle = '#4a3020';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = (obj.text ?? '').split('\n');
  const size = lines.length > 1 ? 52 : 64;
  ctx.font = `bold ${size}px "Trebuchet MS", "Arial Rounded MT Bold", sans-serif`;
  lines.forEach((line, i) => ctx.fillText(line, 180, 100 + (i - (lines.length - 1) / 2) * size * 1.1, 330));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.68, 0.9), new THREE.MeshBasicMaterial({ map: tex }));
  face.position.set(0, 1.55, 0.065);

  group.add(post, board, face);
  post.castShadow = board.castShadow = true;
  return group;
}
