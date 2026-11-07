import { formatInfo } from './format';
import { parse } from './parse';
import type { FormatStyle, ParseOptions } from './types';

/** Options for {@link mask} and {@link redact}. */
export interface MaskOptions extends ParseOptions {
  /** Digits kept at the start of the national number (trunk zero included). @defaultValue 3 */
  keepStart?: number;
  /** Digits kept at the end. @defaultValue 2 */
  keepEnd?: number;
  /** Replacement character. @defaultValue `'*'` */
  maskChar?: string;
  /** Output style for valid numbers. @defaultValue `'local'` */
  style?: FormatStyle;
}

function maskDigits(text: string, keepStart: number, keepEnd: number, ch: string, skipLeading = 0): string {
  const positions: number[] = [];
  const chars = Array.from(text);
  chars.forEach((c, i) => {
    if (/[0-9০-৯]/.test(c)) positions.push(i);
  });
  const usable = positions.slice(skipLeading);
  const maskable = usable.slice(Math.max(0, keepStart), Math.max(0, usable.length - Math.max(0, keepEnd)));
  for (const i of maskable) chars[i] = ch;
  return chars.join('');
}

/**
 * Hide the middle of a phone number, for logs and UI. Valid numbers are masked
 * after formatting; invalid input is masked on a best-effort basis so it is
 * still safe to print.
 *
 * @example
 * mask('+8801712345678'); // '017******78'
 * mask('01712-345678', { keepStart: 5, keepEnd: 0 }); // '01712******'
 */
export function mask(input: unknown, options: MaskOptions = {}): string {
  const keepStart = options.keepStart ?? 3;
  const keepEnd = options.keepEnd ?? 2;
  const ch = options.maskChar ?? '*';
  const style = options.style ?? 'local';
  const info = parse(input, { ...options, allow: ['mobile', 'landline', 'shortcode'] });
  const formatted = formatInfo(info, style);
  if (info.valid && formatted !== null) {
    const international = style === 'e164' || style === 'international' || style === 'msisdn';
    // country code digits are public; trunk zero is implied in international forms
    return maskDigits(formatted, international ? keepStart - 1 : keepStart, keepEnd, ch, international ? 3 : 0);
  }
  const text = typeof input === 'string' ? input : String(input ?? '');
  return maskDigits(text, keepStart, keepEnd, ch);
}

/** Options for {@link redact}. */
export interface RedactOptions extends MaskOptions {
  /** Replace numbers with this fixed string instead of masking them. */
  replacement?: string;
}

const CANDIDATE =
  /(?<![\d০-৯])\+?[\d০-৯][\d০-৯\s().-]{2,}[\d০-৯](?![\d০-৯])/g;

/**
 * Find phone numbers inside free text and mask (or replace) the valid ones.
 * Text that merely looks like digits, such as dates or order numbers, is left alone.
 *
 * @example
 * redact('Call 01712-345678 today'); // 'Call 017******78 today'
 */
export function redact(text: string, options: RedactOptions = {}): string {
  const all = { ...options, allow: ['mobile', 'landline', 'shortcode'] as const };
  const replaceOne = (value: string): string =>
    options.replacement !== undefined ? options.replacement : mask(value, all);
  return text.replace(CANDIDATE, (match) => {
    if (parse(match, all).valid) return replaceOne(match);
    // Look for a valid number inside a run of space separated groups.
    const words = match.split(/(\s+)/);
    for (let len = words.length; len > 0; len--) {
      for (let start = 0; start + len <= words.length; start++) {
        const first = words[start] ?? '';
        const last = words[start + len - 1] ?? '';
        if (/^\s*$/.test(first) || /^\s*$/.test(last)) continue;
        const candidate = words.slice(start, start + len).join('');
        if (parse(candidate, all).valid) {
          return words.slice(0, start).join('') + replaceOne(candidate) + words.slice(start + len).join('');
        }
      }
    }
    return match;
  });
}
