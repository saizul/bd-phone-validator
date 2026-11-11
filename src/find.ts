import { dedupeKey } from './bulk';
import { formatInfo } from './format';
import { parse } from './parse';
import type { FormatStyle, ParseOptions, PhoneInfo } from './types';

/** Options for {@link findNumbers}. */
export interface FindOptions extends ParseOptions {
  /**
   * Accept numbers whose leading zero was lost. Off by default here, because in
   * free text a bare ten digit run is more often an id than a phone number.
   * @defaultValue `false`
   */
  allowMissingLeadingZero?: boolean;
  /** Stop after this many matches. @defaultValue no limit */
  limit?: number;
}

/** A phone number located inside a larger text. */
export interface PhoneMatch {
  /** Index of the first character of the match (UTF-16 code units, as used by `String.slice`). */
  readonly start: number;
  /** Index just past the last character of the match. */
  readonly end: number;
  /** One based line number of the match. */
  readonly line: number;
  /** One based column of the match within its line. */
  readonly column: number;
  /** The matched text exactly as written, `text.slice(start, end)`. */
  readonly raw: string;
  /** The parsed number (always `valid: true`). */
  readonly info: PhoneInfo;
}

/** Options for {@link extractNumbers}. */
export interface ExtractOptions extends FindOptions {
  /** Output style. Short codes fall back to their local form. @defaultValue `'e164'` */
  style?: FormatStyle;
  /** Return each number once, in order of first appearance. @defaultValue `true` */
  unique?: boolean;
}

// A run of digit groups joined by separators that may appear inside one number. Never spans lines.
const CANDIDATE = /(?<![\d০-৯])\+?[\d০-৯](?:[\d০-৯ \t\u00A0().-]*[\d০-৯])?(?![\d০-৯])/g;
// One digit group inside a candidate, with its optional leading plus.
const GROUP = /\+?[\d০-৯]+/g;
/** The longest sensible spelling, `+880 (17) 12 34 56 78`, has seven groups. */
const MAX_GROUPS = 7;

interface Group {
  readonly start: number;
  readonly end: number;
}

function groupsOf(candidate: string, offset: number): Group[] {
  const groups: Group[] = [];
  for (const m of candidate.matchAll(GROUP)) {
    const start = offset + (m.index as number);
    groups.push({ start, end: start + m[0].length });
  }
  return groups;
}

/**
 * Find every Bangladeshi phone number in a piece of free text, such as a chat
 * export, an email body or a scraped page. Numbers may be written in any form
 * {@link parse} accepts (separators, `+880`, Bangla digits). Digit runs that
 * are not valid numbers (dates, amounts, order ids) are skipped.
 *
 * Mobile numbers only by default; pass `allow` to include landlines or short codes.
 *
 * @example
 * findNumbers('Call 01712-345678 or +880 1812 345678.').map((m) => m.info.e164);
 * // ['+8801712345678', '+8801812345678']
 */
export function findNumbers(text: string, options: FindOptions = {}): PhoneMatch[] {
  const matches: PhoneMatch[] = [];
  if (typeof text !== 'string' || text === '') return matches;
  const limit = options.limit ?? Infinity;
  if (!(limit > 0)) return matches;
  const parseOptions: ParseOptions = { ...options, allowMissingLeadingZero: options.allowMissingLeadingZero ?? false };

  // Line bookkeeping is incremental because matches are produced in order.
  let line = 1;
  let lineStart = 0;
  let scanned = 0;
  const locate = (index: number): { line: number; column: number } => {
    for (; scanned < index; scanned++) {
      if (text.charCodeAt(scanned) === 10) {
        line++;
        lineStart = scanned + 1;
      }
    }
    return { line, column: index - lineStart + 1 };
  };

  for (const candidate of text.matchAll(CANDIDATE)) {
    const groups = groupsOf(candidate[0], candidate.index as number);
    let i = 0;
    while (i < groups.length) {
      const first = groups[i] as Group;
      let found = false;
      // Longest span first, so '+880 1712 345678' is one number and not a fragment of one.
      for (let j = Math.min(groups.length, i + MAX_GROUPS) - 1; j >= i; j--) {
        const raw = text.slice(first.start, (groups[j] as Group).end);
        const info = parse(raw, parseOptions);
        if (!info.valid) continue;
        matches.push({ start: first.start, end: first.start + raw.length, ...locate(first.start), raw, info });
        if (matches.length >= limit) return matches;
        i = j + 1;
        found = true;
        break;
      }
      if (!found) i++;
    }
  }
  return matches;
}

/**
 * Pull the phone numbers out of free text as a clean list.
 *
 * @example
 * extractNumbers('Rahim: 01712-345678, office ০১৮১২৩৪৫৬৭৮, again 01712345678');
 * // ['+8801712345678', '+8801812345678']
 * extractNumbers('Call 01712-345678', { style: 'local' }); // ['01712345678']
 */
export function extractNumbers(text: string, options: ExtractOptions = {}): string[] {
  const style = options.style ?? 'e164';
  const unique = options.unique ?? true;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const { info } of findNumbers(text, options)) {
    if (unique) {
      const key = dedupeKey(info);
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(formatInfo(info, style) ?? (info.local as string));
  }
  return out;
}
