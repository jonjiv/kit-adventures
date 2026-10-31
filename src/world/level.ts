import { levelColliders } from './colliders';
import { CollisionWorld } from './collision';
import { validateLevel, type LevelFile, type LevelObject } from './levelFormat';

export interface Level {
  file: LevelFile;
  collision: CollisionWorld;
  start: LevelObject;
}

/** Turns level JSON into a playable level. Throws a friendly error if the file is broken. */
export function levelFromJson(data: unknown): Level {
  const errors = validateLevel(data);
  if (errors.length > 0) throw new Error(errors.join(' '));
  const file = data as LevelFile;
  const start = file.objects.find((o) => o.type === 'start');
  if (!start) throw new Error('The level needs a start point.');
  return { file, collision: new CollisionWorld(levelColliders(file)), start };
}

export async function loadLevel(url: string): Promise<Level> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status}).`);
  return levelFromJson(await res.json());
}
