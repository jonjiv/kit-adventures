import type { Theme } from './levelFormat';

export interface ThemeStyle {
  label: string;
  skyTop: number;
  skyHorizon: number;
  fog: number;
  fogNear: number;
  fogFar: number;
  sunColor: number;
  sunIntensity: number;
  /** Direction the sunlight comes from. */
  sunDir: [number, number, number];
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  clouds: boolean;
  /** Twinkly stars and the Earth in the sky (space levels). */
  space?: boolean;
}

export const THEME_STYLES: Record<Theme, ThemeStyle> = {
  // Warm, cozy indoor light, like sun through big windows.
  house: {
    label: 'House',
    skyTop: 0xffd9a8, skyHorizon: 0xfff4e2, fog: 0xfff0dc, fogNear: 45, fogFar: 120,
    sunColor: 0xfff0d8, sunIntensity: 1.6, sunDir: [0.35, 1, 0.45],
    hemiSky: 0xfffaf0, hemiGround: 0xb89070, hemiIntensity: 1.3, clouds: false,
  },
  // Bright, sunny blue sky.
  backyard: {
    label: 'Backyard',
    skyTop: 0x3d9cff, skyHorizon: 0xc4eaff, fog: 0xc9ecff, fogNear: 50, fogFar: 140,
    sunColor: 0xfff6e0, sunIntensity: 1.8, sunDir: [0.5, 1, 0.3],
    hemiSky: 0xdff2ff, hemiGround: 0x7a9a5a, hemiIntensity: 1.1, clouds: true,
  },
  // Sunset over the rooftops.
  city: {
    label: 'City',
    skyTop: 0x5a4aa8, skyHorizon: 0xffb08a, fog: 0xf4b49c, fogNear: 50, fogFar: 150,
    sunColor: 0xffd0a0, sunIntensity: 1.7, sunDir: [-0.6, 0.8, 0.4],
    hemiSky: 0xffd8e8, hemiGround: 0x5a5070, hemiIntensity: 1.1, clouds: true,
  },
  // Black space with stars and the Earth, and bright white sunlight.
  moon: {
    label: 'Moon',
    skyTop: 0x020414, skyHorizon: 0x1a2050, fog: 0x141a40, fogNear: 60, fogFar: 170,
    sunColor: 0xffffff, sunIntensity: 2, sunDir: [0.4, 0.9, -0.5],
    hemiSky: 0xb8c8ff, hemiGround: 0x404050, hemiIntensity: 0.9, clouds: false, space: true,
  },
};
