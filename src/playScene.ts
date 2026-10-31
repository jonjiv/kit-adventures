// One level being played: the world, the cat, the camera and effects.

import * as THREE from 'three';
import { FollowCamera } from './engine/followCamera';
import type { Input } from './engine/input';
import { Particles } from './engine/particles';
import { DEFAULT_LOOK } from './player/catLook';
import { CatModel } from './player/catModel';
import { facingFromYaw, PlayerController } from './player/playerController';
import type { Level } from './world/level';
import { buildLevelMesh } from './world/levelMesh';
import { MaterialLibrary } from './world/materials';
import { Sky } from './world/sky';
import { THEME_STYLES } from './world/themes';

const SPARKLE_COLORS = [0xfff27a, 0xffffff, 0xff9ad8, 0x8ae8ff];
const DUST_COLORS = [0xffffff, 0xf2e8d8];

export class PlayScene {
  readonly scene = new THREE.Scene();
  private level: Level;
  private input: Input;
  private materials = new MaterialLibrary();
  private sky: Sky;
  readonly player: PlayerController;
  private cat: CatModel;
  readonly camera: FollowCamera;
  private particles = new Particles();
  private shadow: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  private time = 0;
  private catPos = new THREE.Vector3();

  constructor(level: Level, camera: THREE.PerspectiveCamera, input: Input) {
    this.level = level;
    this.input = input;
    const { file } = level;

    this.scene.add(buildLevelMesh(file, this.materials));
    const style = THEME_STYLES[file.theme];
    const center = new THREE.Vector3(file.size[0] / 2, 0, file.size[2] / 2);
    this.sky = new Sky(style, center, Math.max(file.size[0], file.size[2]));
    this.sky.applyFog(this.scene, style);
    this.scene.add(this.sky.group, this.particles.group);

    const yaw = level.start.yaw ?? 0;
    this.player = new PlayerController(level.collision, level.start.pos, facingFromYaw(yaw));
    this.cat = new CatModel(DEFAULT_LOOK);
    this.scene.add(this.cat.root);

    // A soft round shadow straight under the cat, so it's easy to see where a jump will land.
    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.36, 24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      }),
    );
    this.scene.add(this.shadow);

    this.camera = new FollowCamera(camera, level.collision);
    this.catPos.fromArray(this.player.pos);
    this.camera.snap(this.catPos, (yaw * Math.PI) / 180);
  }

  fixedUpdate(dt: number): void {
    const axes = this.input.moveAxes();
    const dir = this.camera.moveIntent(axes);
    this.player.step(
      { x: dir.x, z: dir.z, jumpPressed: this.input.wasPressed('Space'), jumpHeld: this.input.isDown('Space') },
      dt,
    );

    const feet = new THREE.Vector3().fromArray(this.player.pos);
    for (const e of this.player.events) {
      if (e === 'jump') this.cat.trigger('jump');
      if (e === 'doubleJump') {
        this.cat.trigger('doubleJump');
        this.particles.burst(feet.clone().setY(feet.y + 0.3), {
          count: 14, colors: SPARKLE_COLORS, speed: 3, life: 0.5, size: 0.07, gravity: 2,
        });
      }
      if (e === 'land') {
        this.cat.trigger('land', this.player.landSpeed);
        if (this.player.landSpeed > 6) {
          this.particles.burst(feet.clone().setY(feet.y + 0.05), {
            count: 10, colors: DUST_COLORS, speed: 2.2, life: 0.35, size: 0.06, flat: true,
          });
        }
      }
      if (e === 'respawn') {
        this.catPos.fromArray(this.player.pos);
        this.camera.snap(this.catPos, this.player.facing - Math.PI);
      }
    }
  }

  render(alpha: number, dt: number): void {
    this.time += dt;
    const p = this.player;
    this.catPos.set(
      THREE.MathUtils.lerp(p.prevPos[0], p.pos[0], alpha),
      THREE.MathUtils.lerp(p.prevPos[1], p.pos[1], alpha),
      THREE.MathUtils.lerp(p.prevPos[2], p.pos[2], alpha),
    );
    const turn = Math.atan2(Math.sin(p.facing - p.prevFacing), Math.cos(p.facing - p.prevFacing));
    this.cat.root.position.copy(this.catPos);
    this.cat.root.rotation.y = p.prevFacing + turn * alpha;
    this.cat.update(dt, { speed: Math.hypot(p.vel[0], p.vel[2]), onGround: p.onGround, vy: p.vel[1] });

    const ground = this.level.collision.groundBelow(this.catPos.x, this.catPos.z, this.catPos.y + 0.05, 0.15);
    this.shadow.visible = ground !== null;
    if (ground !== null) {
      const height = this.catPos.y - ground;
      const fade = THREE.MathUtils.clamp(1 - height / 8, 0.25, 1);
      this.shadow.position.set(this.catPos.x, ground + 0.01, this.catPos.z);
      this.shadow.scale.setScalar(0.7 + 0.3 * fade);
      this.shadow.material.opacity = 0.4 * fade;
    }

    this.camera.update(dt, this.input, this.catPos);
    this.sky.update(dt, this.camera.position);
    this.sky.followShadow(this.catPos);
    this.materials.update(this.time);
    this.particles.update(dt);
  }
}
