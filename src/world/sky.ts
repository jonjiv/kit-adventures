import * as THREE from 'three';
import { IS_MOBILE } from '../engine/device';
import { TUNING } from '../player/tuning';
import type { ThemeStyle } from './themes';

const CLOUD_HEIGHT = 42;
const CLOUD_DRIFT = 1.2; // blocks per second

/** Gradient sky dome, fog, sun and fill light, and drifting blocky clouds. */
export class Sky {
  readonly group = new THREE.Group();
  readonly sun: THREE.DirectionalLight;
  private dome: THREE.Mesh;
  private clouds = new THREE.Group();
  private sunDir: THREE.Vector3;
  private cloudSpan: number;
  private center: THREE.Vector3;

  constructor(style: ThemeStyle, center: THREE.Vector3, span: number) {
    this.center = center.clone();
    this.cloudSpan = Math.max(160, span * 2.5);

    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(500, 32, 16),
      new THREE.ShaderMaterial({
        uniforms: {
          top: { value: new THREE.Color(style.skyTop) },
          horizon: { value: new THREE.Color(style.skyHorizon) },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 top;
          uniform vec3 horizon;
          varying vec3 vDir;
          void main() {
            float h = pow(clamp(vDir.y, 0.0, 1.0), 0.6);
            gl_FragColor = vec4(mix(horizon, top, h), 1.0);
            #include <colorspace_fragment>
          }`,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    );
    this.dome.renderOrder = -1;
    this.group.add(this.dome);

    const hemi = new THREE.HemisphereLight(style.hemiSky, style.hemiGround, style.hemiIntensity);
    this.group.add(hemi);

    this.sunDir = new THREE.Vector3(...style.sunDir).normalize();
    this.sun = new THREE.DirectionalLight(style.sunColor, style.sunIntensity);
    this.sun.castShadow = true;
    const shadowSize = IS_MOBILE ? TUNING.graphics.mobileShadowMapSize : TUNING.graphics.shadowMapSize;
    this.sun.shadow.mapSize.set(shadowSize, shadowSize);
    const cam = this.sun.shadow.camera;
    cam.left = cam.bottom = -40;
    cam.right = cam.top = 40;
    cam.near = 1;
    cam.far = 200;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.03;
    this.group.add(this.sun, this.sun.target);
    this.followShadow(center);

    if (style.clouds) this.makeClouds();
    this.group.add(this.clouds);
  }

  applyFog(scene: THREE.Scene, style: ThemeStyle): void {
    const view = IS_MOBILE ? TUNING.graphics.mobileViewDistance : 1;
    scene.fog = new THREE.Fog(style.fog, style.fogNear * view, style.fogFar * view);
    scene.background = new THREE.Color(style.skyHorizon);
  }

  /** Keeps the sharp shadow area centered on what the player is looking at. */
  followShadow(target: THREE.Vector3): void {
    this.sun.target.position.copy(target);
    this.sun.position.copy(target).addScaledVector(this.sunDir, 100);
  }

  private makeClouds(): void {
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x999999 });
    const puff = new THREE.IcosahedronGeometry(1, 1);
    for (let i = 0; i < 16; i++) {
      const cloud = new THREE.Group();
      const parts = 3 + Math.floor(Math.random() * 3);
      for (let p = 0; p < parts; p++) {
        const m = new THREE.Mesh(puff, mat);
        const s = 2.5 + Math.random() * 2.5;
        m.scale.set(s * 1.3, s * 0.75, s);
        m.position.set((p - parts / 2) * 3 + Math.random(), Math.random() * 1.5, (Math.random() - 0.5) * 3);
        cloud.add(m);
      }
      cloud.position.set(
        this.center.x + (Math.random() - 0.5) * this.cloudSpan,
        CLOUD_HEIGHT + Math.random() * 8,
        this.center.z + (Math.random() - 0.5) * this.cloudSpan,
      );
      this.clouds.add(cloud);
    }
  }

  update(dt: number, cameraPos: THREE.Vector3): void {
    this.dome.position.copy(cameraPos);
    const half = this.cloudSpan / 2;
    for (const cloud of this.clouds.children) {
      cloud.position.x += CLOUD_DRIFT * dt;
      if (cloud.position.x > this.center.x + half) cloud.position.x -= this.cloudSpan;
    }
  }
}
