import { parse } from './parse';
import type { FormatStyle, ParseOptions, PhoneInfo } from './types';

/**
 * Format an already parsed number. Returns `null` for invalid numbers and for
 * styles a category cannot express (short codes have no international form).
 */
export function formatInfo(info: PhoneInfo, style: FormatStyle = 'national'): string | null {
  if (!info.valid || !info.local) return null;
  const local = info.local;
  if (info.category === 'shortcode') {
    return style === 'local' || style === 'national' ? local : null;
  }
  const e164 = info.e164 as string;
  const nationalPart = info.category === 'landline' ? splitLandline(local, info.areaCode as string) : splitMobile(local);
  switch (style) {
    case 'local':
      return local;
    case 'national':
      return nationalPart;
    case 'e164':
      return e164;
    case 'msisdn':
      return e164.slice(1);
    case 'international':
      return '+880 ' + nationalPart.slice(1);
  }
}

function splitMobile(local: string): string {
  return `${local.slice(0, 5)}-${local.slice(5)}`;
}

function splitLandline(local: string, areaCode: string): string {
  return `${areaCode}-${local.slice(areaCode.length)}`;
}

/**
 * Format a number in a chosen style. Returns `null` when the input is invalid.
 *
 * | style | example |
 * | --- | --- |
 * | `national` (default) | `01712-345678` |
 * | `local` | `01712345678` |
 * | `international` | `+880 1712-345678` |
 * | `e164` | `+8801712345678` |
 * | `msisdn` | `8801712345678` |
 */
export function format(input: unknown, style: FormatStyle = 'national', options: ParseOptions = {}): string | null {
  return formatInfo(parse(input, options), style);
}

/**
 * Normalize to E.164 (default) or the local 11 digit form. Returns `null` when
 * the input is not valid.
 *
 * @example
 * normalize('০১৭১২-৩৪৫৬৭৮'); // '+8801712345678'
 * normalize('+8801712345678', 'local'); // '01712345678'
 */
export function normalize(
  input: unknown,
  to: 'e164' | 'local' = 'e164',
  options: ParseOptions = {},
): string | null {
  return format(input, to, options);
}
