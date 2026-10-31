import { AIR, blockId } from './blocks';
import { decodeRle, validateLevel, type LevelFile, type LevelObject, type Theme } from './levelFormat';
import { World } from './world';

export interface Level {
  name: string;
  theme: Theme;
  world: World;
  objects: LevelObject[];
  start: LevelObject | undefined;
}

/** Turns level JSON into a playable world. Throws a friendly error if the file is broken. */
export function levelFromJson(data: unknown): Level {
  const errors = validateLevel(data);
  if (errors.length > 0) throw new Error(errors.join(' '));
  const file = data as LevelFile;
  const [sx, sy, sz] = file.size;

  const toId = file.palette.map((name) => {
    const id = blockId(name);
    if (id === undefined) console.warn(`Unknown block "${name}" in level "${file.name}", using air.`);
    return id ?? AIR;
  });
  const cells = decodeRle(file.blocks, sx * sy * sz);
  for (let i = 0; i < cells.length; i++) cells[i] = toId[cells[i]];

  return {
    name: file.name,
    theme: file.theme,
    world: new World(sx, sy, sz, cells),
    objects: file.objects,
    start: file.objects.find((o) => o.type === 'start'),
  };
}

export async function loadLevel(url: string): Promise<Level> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status}).`);
  return levelFromJson(await res.json());
}
