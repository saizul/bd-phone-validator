import { dedupeKey } from './bulk';
import { parse } from './parse';
import type { NumberCategory, ParseOptions } from './types';

/** Options for {@link isSameNumber}; the same as the parsing options. */
export type CompareOptions = ParseOptions;

const ALL_CATEGORIES: readonly NumberCategory[] = ['mobile', 'landline', 'shortcode'];

/**
 * True when two inputs are the same Bangladeshi number, whatever form each one is written in
 * (local, `+880`, `880`, `00880`, Bangla digits, separators, lost leading zero).
 *
 * Both inputs must be valid; an invalid input never matches anything, not even itself.
 * Mobile numbers, landlines and short codes are all compared unless `options.allow` narrows it.
 *
 * @example
 * isSameNumber('01712-345678', '+880 1712 345678'); // true
 * isSameNumber('০১৭১২৩৪৫৬৭৮', '1712345678');         // true
 * isSameNumber('01712345678', '01812345678');      // false
 */
export function isSameNumber(a: unknown, b: unknown, options: CompareOptions = {}): boolean {
  const opts: ParseOptions = { allow: ALL_CATEGORIES, ...options };
  const left = parse(a, opts);
  if (!left.valid) return false;
  const right = parse(b, opts);
  return right.valid && dedupeKey(left) === dedupeKey(right);
}
