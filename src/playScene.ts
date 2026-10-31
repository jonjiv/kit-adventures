// One level being played: the world, the cat, the camera, checkpoints and effects.

import * as THREE from 'three';
import { FollowCamera } from './engine/followCamera';
import type { Input } from './engine/input';
import { Particles } from './engine/particles';
import { Checkpoint } from './entities/checkpoint';
import { buildSign } from './entities/sign';
import { DEFAULT_LOOK } from './player/catLook';
import { CatModel } from './player/catModel';
import { facingFromYaw, PlayerController } from './player/playerController';
import { TOUCH_PLAYER, TUNING } from './player/tuning';
import type { Level } from './world/level';
import { buildLevelMesh } from './world/levelMesh';
import { MaterialLibrary } from './world/materials';
import { Sky } from './world/sky';
import { THEME_STYLES } from './world/themes';

const SPARKLE_COLORS = [0xfff27a, 0xffffff, 0xff9ad8, 0x8ae8ff];
const DUST_COLORS = [0xffffff, 0xf2e8d8];
const RAINBOW = [0xff5a5a, 0xffa040, 0xffe040, 0x60d860, 0x50a0ff, 0xb070f0];

export class PlayScene {
  readonly scene = new THREE.Scene();
  readonly player: PlayerController;
  readonly camera: FollowCamera;
  private level: Level;
  private input: Input;
  private materials = new MaterialLibrary();
  private sky: Sky;
  private cat: CatModel;
  private particles = new Particles();
  private checkpoints: Checkpoint[];
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

    this.checkpoints = file.objects.filter((o) => o.type === 'checkpoint').map((o) => new Checkpoint(o));
    for (const c of this.checkpoints) this.scene.add(c.group);
    for (const o of file.objects) if (o.type === 'sign') this.scene.add(buildSign(o));

    const yaw = level.start.yaw ?? 0;
    this.player = new PlayerController(
      level.collision, level.start.pos, facingFromYaw(yaw), TUNING.player, file.killY ?? TUNING.player.killHeight,
    );
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
    const { input, player: p } = this;
    const dir = this.camera.moveIntent(input.moveAxes());
    p.useTuning(input.touch.active ? TOUCH_PLAYER : TUNING.player);
    p.step({
      x: dir.x, z: dir.z,
      jumpPressed: input.jumpPressed(), jumpHeld: input.jumpHeld(), dashPressed: input.dashPressed(),
    }, dt);

    const feet = new THREE.Vector3().fromArray(p.pos);
    const burst = (dy: number, colors: number[], count: number, speed: number, size: number) =>
      this.particles.burst(feet.clone().setY(feet.y + dy), { count, colors, speed, life: 0.45, size, gravity: 2 });
    for (const e of p.events) {
      switch (e) {
        case 'jump':
        case 'climb':
          this.cat.trigger(e);
          break;
        case 'doubleJump':
          this.cat.trigger('doubleJump');
          burst(0.3, SPARKLE_COLORS, 14, 3, 0.07);
          break;
        case 'wallJump':
          this.cat.trigger('wallJump');
          burst(0.4, SPARKLE_COLORS, 10, 2.5, 0.06);
          break;
        case 'dash':
          this.cat.trigger('dash');
          burst(0.3, DUST_COLORS, 8, 1.5, 0.06);
          break;
        case 'wallStep':
          if (p.wallNormal) {
            const n = p.wallNormal;
            const h = TUNING.player.width / 2;
            const at = feet.clone().add(new THREE.Vector3(-n[0] * h, 0.25 + Math.random() * 0.3, -n[2] * h));
            this.particles.pawPrint(at, n, 0x5a3a3a);
          }
          break;
        case 'land':
          this.cat.trigger('land', p.landSpeed);
          if (p.landSpeed > 6) {
            this.particles.burst(feet.clone().setY(feet.y + 0.05), {
              count: 10, colors: DUST_COLORS, speed: 2.2, life: 0.35, size: 0.06, flat: true,
            });
          }
          break;
        case 'respawn':
          this.catPos.fromArray(p.pos);
          this.camera.snap(this.catPos, p.facing - Math.PI);
          break;
      }
    }
    // A rainbow streak behind the dash.
    if (p.state === 'dash') {
      this.particles.burst(feet.clone().setY(feet.y + 0.35), { count: 2, colors: RAINBOW, speed: 0.3, life: 0.3, size: 0.07 });
    }

    for (const c of this.checkpoints) {
      if (!c.active && c.touches(p.pos)) {
        for (const other of this.checkpoints) other.deactivate();
        c.activate();
        p.setSpawn(c.pos, facingFromYaw(c.yaw));
        this.particles.burst(new THREE.Vector3(c.pos[0], c.pos[1] + 1.6, c.pos[2]), {
          count: 18, colors: RAINBOW, speed: 3.5, life: 0.7, size: 0.08, gravity: 3,
        });
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
    const facing = p.prevFacing + turn * alpha;
    this.cat.root.position.copy(this.catPos);
    this.cat.root.rotation.y = facing;

    // Which side the wall is on, so the cat leans into wall runs.
    let wallSide = 0;
    if (p.state === 'wallRun' && p.wallNormal) {
      const rightX = -Math.cos(facing), rightZ = Math.sin(facing);
      wallSide = -(p.wallNormal[0] * rightX + p.wallNormal[2] * rightZ) > 0 ? 1 : -1;
    }
    const speed = Math.hypot(p.vel[0], p.vel[2]);
    this.cat.update(dt, { speed, vy: p.vel[1], state: p.state, wallSide });

    const ground = this.level.collision.groundBelow(this.catPos.x, this.catPos.z, this.catPos.y + 0.05, 0.15);
    this.shadow.visible = ground !== null && p.state !== 'ledge';
    if (ground !== null) {
      const height = this.catPos.y - ground;
      const fade = THREE.MathUtils.clamp(1 - height / 8, 0.25, 1);
      this.shadow.position.set(this.catPos.x, ground + 0.01, this.catPos.z);
      this.shadow.scale.setScalar(0.7 + 0.3 * fade);
      this.shadow.material.opacity = 0.4 * fade;
    }

    for (const c of this.checkpoints) c.update(dt);
    // On touch, the camera swings back behind the cat when the player isn't steering it.
    const touch = this.input.touch;
    const follow = touch.active && touch.secondsSinceLook > TUNING.touch.followDelay ? { facing, speed } : undefined;
    this.camera.update(dt, this.input, this.catPos, follow);
    this.sky.update(dt, this.camera.position);
    this.sky.followShadow(this.catPos);
    this.materials.update(this.time);
    this.particles.update(dt);
  }

  dispose(): void {
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          (m as THREE.MeshBasicMaterial).map?.dispose();
          m.dispose();
        }
      }
    });
    this.materials.dispose();
  }
}
