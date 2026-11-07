import { parse } from './parse';
import type { ErrorCode, NumberCategory, ParseOptions, PhoneInfo } from './types';

/** Options for bulk helpers. */
export interface BulkOptions extends ParseOptions {
  /** Treat repeated numbers as duplicates (compared by normalized form). @defaultValue true */
  dedupe?: boolean;
}

/** One processed input. */
export interface BulkEntry {
  /** Zero based position in the input. */
  readonly index: number;
  readonly info: PhoneInfo;
  /** Index of the first occurrence when this entry repeats an earlier number. */
  readonly duplicateOf?: number;
}

/** Summary counters. */
export interface BulkStats {
  readonly total: number;
  readonly valid: number;
  readonly invalid: number;
  readonly duplicates: number;
  readonly unique: number;
  readonly byOperator: Readonly<Record<string, number>>;
  readonly byCategory: Readonly<Partial<Record<NumberCategory, number>>>;
  readonly byError: Readonly<Partial<Record<ErrorCode, number>>>;
}

/** Result of {@link validateBulk}. */
export interface BulkResult {
  /** Every input in order. */
  readonly entries: readonly BulkEntry[];
  /** Valid, first-occurrence numbers in input order. */
  readonly unique: readonly PhoneInfo[];
  /** Invalid entries. */
  readonly invalid: readonly BulkEntry[];
  /** Valid entries that repeat an earlier number. */
  readonly duplicates: readonly BulkEntry[];
  readonly stats: BulkStats;
}

/** Key used for de-duplication: E.164 where available, otherwise the digits. */
export function dedupeKey(info: PhoneInfo): string {
  return info.e164 ?? info.local ?? info.digits;
}

/**
 * Validate many inputs, find duplicates and collect statistics.
 *
 * @example
 * const r = validateBulk(['01712345678', '+8801712345678', 'oops']);
 * r.stats; // { total: 3, valid: 2, invalid: 1, duplicates: 1, unique: 1, ... }
 */
export function validateBulk(inputs: Iterable<unknown>, options: BulkOptions = {}): BulkResult {
  const dedupe = options.dedupe ?? true;
  const seen = new Map<string, number>();
  const entries: BulkEntry[] = [];
  const unique: PhoneInfo[] = [];
  const invalid: BulkEntry[] = [];
  const duplicates: BulkEntry[] = [];
  const byOperator: Record<string, number> = {};
  const byCategory: Partial<Record<NumberCategory, number>> = {};
  const byError: Partial<Record<ErrorCode, number>> = {};

  let index = 0;
  for (const value of inputs) {
    const info = parse(value, options);
    let entry: BulkEntry = { index, info };
    if (!info.valid) {
      invalid.push(entry);
      const code = info.error?.code;
      if (code) byError[code] = (byError[code] ?? 0) + 1;
    } else {
      const key = dedupeKey(info);
      const first = seen.get(key);
      if (dedupe && first !== undefined) {
        entry = { index, info, duplicateOf: first };
        duplicates.push(entry);
      } else {
        seen.set(key, index);
        unique.push(info);
        if (info.category) byCategory[info.category] = (byCategory[info.category] ?? 0) + 1;
        if (info.operator) byOperator[info.operator.id] = (byOperator[info.operator.id] ?? 0) + 1;
      }
    }
    entries.push(entry);
    index++;
  }
  return {
    entries,
    unique,
    invalid,
    duplicates,
    stats: {
      total: entries.length,
      valid: unique.length + duplicates.length,
      invalid: invalid.length,
      duplicates: duplicates.length,
      unique: unique.length,
      byOperator,
      byCategory,
      byError,
    },
  };
}

/**
 * Clean a list: valid numbers only, normalized, with duplicates removed.
 *
 * @param to `'e164'` (default) or `'local'`
 */
export function cleanList(
  inputs: Iterable<unknown>,
  to: 'e164' | 'local' = 'e164',
  options: BulkOptions = {},
): string[] {
  return validateBulk(inputs, { ...options, dedupe: true }).unique.map((i) =>
    to === 'e164' ? (i.e164 ?? i.local ?? i.digits) : (i.local ?? i.digits),
  );
}
