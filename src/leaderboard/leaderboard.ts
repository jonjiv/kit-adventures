// The leaderboard: the quickest times for each level, shared with everyone
// through Supabase, or kept on this device when Supabase isn't set up.

import { SUPABASE_KEY, SUPABASE_URL } from './config';

export interface Score {
  name: string;
  ms: number;
}

/** How many times each level's board shows. */
export const BOARD_SIZE = 50;

export interface Leaderboard {
  /** True if everyone shares these scores, false if they're only on this device. */
  readonly global: boolean;
  /** The quickest times for a level, quickest first. */
  top(level: string): Promise<Score[]>;
  add(level: string, score: Score): Promise<void>;
}

/** Quickest first; equal times keep the one that was set first on top. */
export function rank(scores: Score[]): Score[] {
  return scores.map((s, i) => ({ s, i })).sort((a, b) => a.s.ms - b.s.ms || a.i - b.i).map(({ s }) => s);
}

const LOCAL_KEY = 'kit-adventures.scores';

/** Scores saved in this browser only. */
export class LocalLeaderboard implements Leaderboard {
  readonly global = false;

  async top(level: string): Promise<Score[]> {
    return this.load()[level] ?? [];
  }

  async add(level: string, score: Score): Promise<void> {
    const all = this.load();
    all[level] = rank([...(all[level] ?? []), score]).slice(0, BOARD_SIZE);
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(all));
    } catch {
      throw new Error('This browser would not save the score.');
    }
  }

  private load(): Record<string, Score[]> {
    try {
      const data: unknown = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '{}');
      return data && typeof data === 'object' ? (data as Record<string, Score[]>) : {};
    } catch {
      return {};
    }
  }
}

/** Scores in the "scores" table of a Supabase project, through its REST API. */
export class SupabaseLeaderboard implements Leaderboard {
  readonly global = true;
  private url: string;
  private key: string;

  constructor(url: string, key: string) {
    this.url = url.replace(/\/+$/, '') + '/rest/v1/scores';
    this.key = key;
  }

  async top(level: string): Promise<Score[]> {
    const query = new URLSearchParams({
      select: 'name,time_ms',
      level: `eq.${level}`,
      order: 'time_ms.asc,created_at.asc',
      limit: String(BOARD_SIZE),
    });
    const res = await fetch(`${this.url}?${query}`, { headers: { apikey: this.key } });
    if (!res.ok) throw new Error(`The leaderboard said ${res.status}.`);
    const rows = (await res.json()) as { name: string; time_ms: number }[];
    return rows.map((r) => ({ name: String(r.name), ms: Number(r.time_ms) }));
  }

  async add(level: string, score: Score): Promise<void> {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { apikey: this.key, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ level, name: score.name, time_ms: score.ms }),
    });
    if (!res.ok) throw new Error(`The leaderboard said ${res.status}.`);
  }
}

export function createLeaderboard(): Leaderboard {
  return SUPABASE_URL && SUPABASE_KEY ? new SupabaseLeaderboard(SUPABASE_URL, SUPABASE_KEY) : new LocalLeaderboard();
}
