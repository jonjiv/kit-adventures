// The cat's looks. The cat maker (Phase 6) will let the player pick these.

export type Pattern = 'plain' | 'stripes' | 'spots' | 'socks';

export const FUR_COLORS = {
  orange: 0xf08a30,
  black: 0x2e2a30,
  white: 0xf4f0ea,
  gray: 0x8a8c94,
  brown: 0x7a5032,
  cream: 0xf0d8a8,
  blue: 0x6a8cc8,
  pink: 0xf0a0c0,
} as const;

export const EYE_COLORS = {
  green: 0x58c850,
  blue: 0x48a0f0,
  gold: 0xf0b828,
  purple: 0xa070e0,
} as const;

export interface CatLook {
  fur: number;
  pattern: Pattern;
  /** Color of the stripes, spots or socks. */
  patternColor: number;
  eyes: number;
}

export const DEFAULT_LOOK: CatLook = {
  fur: FUR_COLORS.orange,
  pattern: 'stripes',
  patternColor: 0xc05a1c,
  eyes: EYE_COLORS.green,
};
