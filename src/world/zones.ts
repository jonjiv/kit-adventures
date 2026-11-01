// Areas that change how the cat moves: updrafts (wind blowing up) and low
// gravity. No Three.js here so it runs in unit tests.

import { ZONES, type LevelFile, type Vec3, type ZoneKind } from './levelFormat';

export interface Zone {
  kind: ZoneKind;
  min: Vec3;
  max: Vec3;
}

export function levelZones(file: LevelFile): Zone[] {
  const out: Zone[] = [];
  for (const o of file.objects) {
    if (!ZONES.includes(o.type as ZoneKind) || !o.to) continue;
    const to = o.to;
    const min = o.pos.map((v, i) => Math.min(v, to[i])) as Vec3;
    const max = o.pos.map((v, i) => Math.max(v, to[i])) as Vec3;
    out.push({ kind: o.type as ZoneKind, min, max });
  }
  return out;
}

/** The zone the middle of the cat is in, or null. */
export function zoneAt(zones: readonly Zone[], feet: Vec3, height: number): Zone | null {
  const y = feet[1] + height / 2;
  for (const z of zones) {
    if (feet[0] > z.min[0] && feet[0] < z.max[0] && y > z.min[1] && y < z.max[1] && feet[2] > z.min[2] && feet[2] < z.max[2]) return z;
  }
  return null;
}
