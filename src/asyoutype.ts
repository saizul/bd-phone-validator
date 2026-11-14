import { hasBanglaDigits, toBanglaDigits, toEnglishDigits } from './digits';
import { AREA_CODES, findAreaCode, operatorForPrefix, SHORT_CODE_PATTERN, SHORT_CODES } from './operators';
import { parse } from './parse';
import type { NumberCategory, Operator } from './types';

/**
 * Output layout for {@link formatAsYouType}.
 *
 * - `auto` (default): international (`+880 1712-345678`) when the user started with `+`,
 *   `880` or `00880`, national (`01712-345678`) otherwise.
 * - `national` / `international`: always that layout once the country code is known.
 */
export type AsYouTypeStyle = 'auto' | 'national' | 'international';

/** Options for {@link formatAsYouType} and {@link AsYouType}. */
export interface AsYouTypeOptions {
  /** @defaultValue `'auto'` */
  style?: AsYouTypeStyle;
  /**
   * Digits used in `formatted`: `auto` keeps Bangla digits when the input contains any.
   * @defaultValue `'auto'`
   */
  digits?: 'auto' | 'en' | 'bn';
  /**
   * Treat input starting with `1` as a mobile number without its leading zero
   * (`1712...` -> `01712-...`) once it can no longer be a hotline.
   * @defaultValue `true`
   */
  allowMissingLeadingZero?: boolean;
  /**
   * Caret position inside `input` (for example `el.selectionStart`). When given, the result
   * carries the matching caret position inside `formatted`.
   */
  cursor?: number;
}

/** Progressive state of a partially typed number. */
export interface AsYouTypeResult {
  /** Display string, for example `01712-34` or `+880 1712-34`. */
  readonly formatted: string;
  /**
   * English digits typed so far in national form with the trunk zero (`0171234`), or the raw
   * digits while the kind of number is still undecided (`+88`, `16`).
   */
  readonly national: string;
  /** Category, once it is known. */
  readonly category?: NumberCategory;
  /** Mobile operator, as soon as the three digit prefix is typed. */
  readonly operator?: Operator;
  /** Landline area code, as soon as it is recognized. */
  readonly areaCode?: string;
  /** True when the digits so far form a valid, complete number. */
  readonly complete: boolean;
  /** False when no further typing can make the number valid (unknown prefix, too long). */
  readonly possible: boolean;
  /** Digits still missing for a mobile number (`0` when complete). */
  readonly remaining?: number;
  /** E.164 form, only when `complete` and the category has one. */
  readonly e164?: string;
  /** Caret position in `formatted`, only when `options.cursor` was given. */
  readonly cursor?: number;
}

const INVISIBLE = new RegExp('[\\u200B-\\u200D\\u2060\\uFEFF]', 'g');
const MOBILE_LENGTH = 11;
const LANDLINE_MAX = 11;
const AREA_CODE_LIST = Object.keys(AREA_CODES);

interface Draft {
  formatted: string;
  national: string;
  category?: NumberCategory;
  operator?: Operator;
  areaCode?: string;
  complete: boolean;
  possible: boolean;
  remaining?: number;
  e164?: string;
}

const raw = (national: string, possible: boolean, prefix = ''): Draft => ({
  formatted: prefix + national,
  national,
  complete: false,
  possible,
});

function isShortCodePrefix(d: string): boolean {
  return SHORT_CODES.some((code) => code.startsWith(d)) || /^1(?:6\d{0,3})?$/.test(d);
}

function groupMobile(national: string, international: boolean): string {
  if (international) {
    const n = national.slice(1);
    return '+880' + (n ? ' ' + (n.length <= 4 ? n : `${n.slice(0, 4)}-${n.slice(4)}`) : '');
  }
  return national.length <= 5 ? national : `${national.slice(0, 5)}-${national.slice(5)}`;
}

function formatMobile(national: string, international: boolean): Draft {
  const len = national.length;
  const operator = len >= 3 ? operatorForPrefix(national.slice(0, 3)) : undefined;
  const tooLong = len > MOBILE_LENGTH;
  const possible = !tooLong && (len < 3 || operator !== undefined);
  const formatted = tooLong
    ? international
      ? `+880 ${national.slice(1)}`
      : national
    : groupMobile(national, international);
  const complete = possible && len === MOBILE_LENGTH;
  return {
    formatted,
    national,
    category: 'mobile',
    operator,
    complete,
    possible,
    remaining: Math.max(0, MOBILE_LENGTH - len),
    e164: complete ? '+880' + national.slice(1) : undefined,
  };
}

function formatLandline(national: string, international: boolean): Draft {
  const prefix = international ? '+880 ' : '';
  const shown = international ? national.slice(1) : national;
  if (national[1] === '0') return raw(shown, false, prefix);
  const areaCode = findAreaCode(national);
  if (!areaCode) {
    const couldBe = AREA_CODE_LIST.some((code) => code.startsWith(national));
    return raw(shown, couldBe, prefix);
  }
  const rest = national.slice(areaCode.length);
  const area = international ? areaCode.slice(1) : areaCode;
  const tooLong = national.length > LANDLINE_MAX;
  const complete = !tooLong && parse(national, { allow: ['landline'] }).valid;
  return {
    formatted: prefix + area + (rest ? `-${rest}` : ''),
    national,
    category: 'landline',
    areaCode,
    complete,
    possible: !tooLong,
    e164: complete ? '+880' + national.slice(1) : undefined,
  };
}

function formatNational(national: string, international: boolean): Draft {
  if (national === '0') {
    return { formatted: international ? '+880' : '0', national, complete: false, possible: true };
  }
  return national.startsWith('01') ? formatMobile(national, international) : formatLandline(national, international);
}

/** Strip a typed country code; returns the national number or a partial/impossible draft. */
function stripCountryCode(d: string, hasPlus: boolean): { national: string } | Draft {
  const lead = hasPlus ? '880' : d.startsWith('00') ? '00880' : '880';
  const shownPrefix = hasPlus ? '+' : '';
  if (d.length <= lead.length && lead.startsWith(d)) return raw(d, true, shownPrefix);
  if (!d.startsWith(lead)) return raw(d, false, shownPrefix);
  let rest = d.slice(lead.length);
  if (rest.startsWith('0')) rest = rest.slice(1); // extra trunk zero: +880 01712...
  return { national: '0' + rest };
}

function countDigits(s: string): number {
  return (toEnglishDigits(s).match(/\d/g) ?? []).length;
}

function mapCursor(input: string, cursor: number, formatted: string, digitsIn: number): number {
  const before = countDigits(input.slice(0, Math.max(0, cursor)));
  if (before === 0) return cursor > 0 && formatted.startsWith('+') ? 1 : 0;
  // Edits happen at the front only (country code, trunk zero), so shift by the difference.
  const digitsOut = countDigits(formatted);
  const target = Math.min(digitsOut, Math.max(1, before + (digitsOut - digitsIn)));
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/[0-9০-৯]/.test(formatted[i])) seen++;
    if (seen === target) return i + 1;
  }
  return formatted.length;
}

/**
 * Format a partially typed Bangladeshi number for display inside an input field.
 *
 * Stateless: pass the whole field value on every keystroke. Accepts the same forms as
 * {@link parse} (`+880`, `880`, `00880`, separators, Bangla digits, lost leading zero) and
 * reports the operator as soon as the prefix is typed. Never throws.
 *
 * @example
 * formatAsYouType('0171').formatted;          // '0171'
 * formatAsYouType('017123').formatted;        // '01712-3'
 * formatAsYouType('+8801712345').formatted;   // '+880 1712-345'
 * formatAsYouType('01912').operator?.name;    // 'Banglalink'
 * formatAsYouType('০১৭১২৩').formatted;        // '০১৭১২-৩'
 */
export function formatAsYouType(input: unknown, options: AsYouTypeOptions = {}): AsYouTypeResult {
  const text = typeof input === 'string' ? input : '';
  const style = options.style ?? 'auto';
  const digitsMode = options.digits ?? 'auto';
  const bangla = digitsMode === 'bn' || (digitsMode === 'auto' && hasBanglaDigits(text));

  const en = toEnglishDigits(text).replace(INVISIBLE, '').replace(/^\s*tel:/i, '');
  const hasPlus = /^\s*\+/.test(en);
  const junk = /[^\d\s().+-]/.test(en) || /.\+/.test(en.trim());
  const d = en.replace(/\D/g, '');

  let draft: Draft;
  if (d === '') {
    draft = raw('', !junk, hasPlus ? '+' : '');
  } else if (hasPlus || d.startsWith('00') || d.startsWith('8')) {
    const stripped = stripCountryCode(d, hasPlus);
    draft = 'formatted' in stripped ? stripped : formatNational(stripped.national, style !== 'national');
  } else if (d.startsWith('0')) {
    draft = formatNational(d, style === 'international');
  } else if (SHORT_CODE_PATTERN.test(d)) {
    draft = { formatted: d, national: d, category: 'shortcode', complete: true, possible: true };
  } else if (d.length <= 5 && isShortCodePrefix(d)) {
    draft = raw(d, true);
  } else if (d.startsWith('1') && (options.allowMissingLeadingZero ?? true)) {
    draft = formatNational('0' + d, style === 'international');
  } else {
    draft = raw(d, false);
  }

  if (junk) draft = { ...draft, complete: false, possible: false, e164: undefined };
  const formatted = bangla ? toBanglaDigits(draft.formatted) : draft.formatted;
  const result: AsYouTypeResult = { ...draft, formatted };
  if (options.cursor === undefined) return stripUndefined(result);
  return stripUndefined({ ...result, cursor: mapCursor(text, options.cursor, formatted, d.length) });
}

function stripUndefined<T extends object>(obj: T): T {
  const out = {} as Record<string, unknown>;
  for (const [key, value] of Object.entries(obj)) if (value !== undefined) out[key] = value;
  return out as T;
}

/**
 * Stateful wrapper around {@link formatAsYouType} for key-by-key input handling.
 *
 * @example
 * const typer = new AsYouType();
 * typer.input('0171');   // '0171'
 * typer.input('23');     // '01712-3'
 * typer.backspace();     // '01712'
 * typer.result.operator?.name; // 'Grameenphone'
 */
export class AsYouType {
  private value = '';

  constructor(private readonly options: Omit<AsYouTypeOptions, 'cursor'> = {}) {}

  /** Append typed text (one key or a pasted chunk) and return the formatted value. */
  input(text: string): string {
    this.value += text;
    return this.result.formatted;
  }

  /** Remove the last typed digit (and any separators after it) and return the formatted value. */
  backspace(): string {
    const chars = Array.from(this.value);
    while (chars.length && !/[0-9০-৯]/.test(chars[chars.length - 1])) chars.pop();
    chars.pop();
    this.value = chars.join('');
    return this.result.formatted;
  }

  /** Forget everything typed so far. */
  reset(): void {
    this.value = '';
  }

  /** Everything typed so far, exactly as received. */
  get raw(): string {
    return this.value;
  }

  /** Full progressive state for the current value. */
  get result(): AsYouTypeResult {
    return formatAsYouType(this.value, this.options);
  }
}
