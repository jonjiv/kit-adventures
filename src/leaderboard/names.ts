// Names on the leaderboard: tidied up, kept short, and checked for rude words.

/** The longest name that fits on the leaderboard. */
export const MAX_NAME = 12;

// Words that are never part of a nice word, so they're blocked anywhere in a name
// (even hidden inside, like "xxshitxx").
const ANYWHERE = [
  'fuck', 'fuk', 'fck', 'shit', 'bitch', 'cunt', 'pussy', 'penis', 'vagina', 'porn', 'sex',
  'nigg', 'slut', 'whore', 'bastard', 'wank', 'twat', 'nazi', 'hitler', 'retard', 'dildo',
  'asshole', 'jackass', 'damn', 'piss', 'bollock', 'douche', 'horny', 'naked', 'suicide',
];
// Words that also turn up inside nice names ("Cassie", "Scrappy", "Peacock",
// "Grape", "Skill"), so they're only blocked as a whole word.
const WHOLE_WORD = [
  'ass', 'arse', 'anal', 'butt', 'hell', 'crap', 'cock', 'dick', 'fag', 'tit', 'tits', 'boob', 'boobs',
  'rape', 'nude', 'kill', 'kys', 'die', 'poop', 'poo', 'pee', 'fart', 'hoe', 'ho', 'cum', 'wtf', 'stfu',
];

const LOOKALIKES: Record<string, string> = { '0': 'o', '1': 'i', '!': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', '$': 's', '7': 't', '8': 'b' };

/** Trims spaces, keeps letters, numbers, spaces and a few marks, and cuts it to 12 letters. */
export function cleanName(raw: string): string {
  return raw.normalize('NFC').replace(/[^\p{L}\p{N} _\-.!']/gu, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME).trim();
}

/** True if the name has a rude word in it, even spelled with numbers (sh1t) or spaces (s h i t). */
export function isRude(name: string): boolean {
  const plain = name.toLowerCase().replace(/[01!34@5$78]/g, (c) => LOOKALIKES[c]);
  const words = plain.split(/[^a-z]+/).filter(Boolean);
  const squashed = words.join('');
  // Also catch doubled-up letters, like "shiiit".
  const single = squashed.replace(/(.)\1+/g, '$1');
  if (ANYWHERE.some((w) => squashed.includes(w) || single.includes(w))) return true;
  return words.some((w) => WHOLE_WORD.includes(w) || WHOLE_WORD.includes(w.replace(/(.)\1+/g, '$1')));
}
