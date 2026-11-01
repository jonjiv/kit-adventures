import { beforeEach, describe, expect, it } from 'vitest';
import { LocalLeaderboard, rank } from '../src/leaderboard/leaderboard';
import { cleanName, isRude, MAX_NAME } from '../src/leaderboard/names';

describe('names', () => {
  it('trims, squeezes spaces, drops odd symbols and keeps 12 letters', () => {
    expect(cleanName('  Gideon   the  Great  ')).toBe('Gideon the G');
    expect(cleanName('<b>Kit</b>')).toBe('bKitb');
    expect(cleanName('Zoë!')).toBe('Zoë!');
    expect(cleanName('a'.repeat(30)).length).toBe(MAX_NAME);
    expect(cleanName('   ')).toBe('');
  });

  it('blocks rude words, even spelled sneakily', () => {
    for (const name of ['shit', 'SH1T', 's h i t', 'shiiit', 'xxfuckxx', 'Butt', 'big ass', 'b1tch']) {
      expect(isRude(name), name).toBe(true);
    }
  });

  it('lets nice names through, even ones with a rude word hiding inside', () => {
    for (const name of ['Gideon', 'Kit', 'Cassie', 'Scrappy', 'Peacock', 'Grape', 'Skill', 'Hello', 'Hannah', 'Mr Whiskers', 'Dash123']) {
      expect(isRude(name), name).toBe(false);
    }
  });
});

describe('leaderboard', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    globalThis.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: () => null,
      get length() {
        return store.size;
      },
    } as Storage;
  });

  it('ranks quickest first, and keeps the first of two equal times on top', () => {
    const ranked = rank([{ name: 'B', ms: 50000 }, { name: 'A', ms: 40000 }, { name: 'C', ms: 50000 }]);
    expect(ranked.map((s) => s.name)).toEqual(['A', 'B', 'C']);
  });

  it('keeps each level separate on this device', async () => {
    const board = new LocalLeaderboard();
    await board.add('garden', { name: 'Slow', ms: 90000 });
    await board.add('garden', { name: 'Fast', ms: 60000 });
    await board.add('moon', { name: 'Moony', ms: 70000 });
    expect((await board.top('garden')).map((s) => s.name)).toEqual(['Fast', 'Slow']);
    expect((await board.top('moon')).map((s) => s.name)).toEqual(['Moony']);
    expect(await board.top('city')).toEqual([]);
    expect(board.global).toBe(false);
  });
});
