// Block types. A block's id is its index in BLOCKS; level files refer to blocks by name.

/** Which material a block is drawn with. */
export type RenderGroup = 'opaque' | 'cutout' | 'water' | 'glow';

export interface BlockDef {
  id: number;
  name: string;
  label: string;
  render: RenderGroup | 'none';
  /** The cat collides with it. */
  solid: boolean;
  /** Drawn a bit lower than a full block, with no faces between neighbors. */
  liquid: boolean;
  /** Atlas tile for each side. */
  tex: { top: number; side: number; bottom: number };
}

/** Tiles in the generated texture atlas (see textures.ts). */
export const Tile = {
  GrassTop: 0,
  GrassSide: 1,
  Dirt: 2,
  Wood: 3,
  Stone: 4,
  Brick: 5,
  Glass: 6,
  Carpet: 7,
  Roof: 8,
  Water: 9,
  Lava: 10,
  Leaves: 11,
} as const;

export const ATLAS_TILE = 16;
export const ATLAS_COLS = 8;
export const ATLAS_ROWS = 2;

const all = (t: number) => ({ top: t, side: t, bottom: t });

type Def = Omit<BlockDef, 'id'>;
const DEFS: Def[] = [
  { name: 'air', label: 'Air', render: 'none', solid: false, liquid: false, tex: all(0) },
  {
    name: 'grass', label: 'Grass', render: 'opaque', solid: true, liquid: false,
    tex: { top: Tile.GrassTop, side: Tile.GrassSide, bottom: Tile.Dirt },
  },
  { name: 'dirt', label: 'Dirt', render: 'opaque', solid: true, liquid: false, tex: all(Tile.Dirt) },
  { name: 'wood', label: 'Wood', render: 'opaque', solid: true, liquid: false, tex: all(Tile.Wood) },
  { name: 'stone', label: 'Stone', render: 'opaque', solid: true, liquid: false, tex: all(Tile.Stone) },
  { name: 'brick', label: 'Brick', render: 'opaque', solid: true, liquid: false, tex: all(Tile.Brick) },
  { name: 'glass', label: 'Glass', render: 'cutout', solid: true, liquid: false, tex: all(Tile.Glass) },
  { name: 'carpet', label: 'Carpet', render: 'opaque', solid: true, liquid: false, tex: all(Tile.Carpet) },
  { name: 'roof', label: 'Roof tile', render: 'opaque', solid: true, liquid: false, tex: all(Tile.Roof) },
  { name: 'water', label: 'Water', render: 'water', solid: false, liquid: true, tex: all(Tile.Water) },
  { name: 'lava', label: 'Lava', render: 'glow', solid: false, liquid: true, tex: all(Tile.Lava) },
  { name: 'leaves', label: 'Leaves', render: 'opaque', solid: true, liquid: false, tex: all(Tile.Leaves) },
];

export const BLOCKS: readonly BlockDef[] = DEFS.map((d, id) => ({ ...d, id }));

export const AIR = 0;

const idByName = new Map(BLOCKS.map((b) => [b.name, b.id]));

/** Block id for a name, or undefined if there is no such block. */
export function blockId(name: string): number | undefined {
  return idByName.get(name);
}

export function isSolid(id: number): boolean {
  return BLOCKS[id]?.solid ?? false;
}

/** Hides the faces of blocks behind it. */
export function isOpaque(id: number): boolean {
  return BLOCKS[id]?.render === 'opaque';
}
