import { toEnglishDigits, hasBanglaDigits } from './digits';
import { messageFor } from './messages';
import { findAreaCode, operatorForPrefix, SHORT_CODE_PATTERN } from './operators';
import type {
  ErrorCode,
  NumberCategory,
  Operator,
  ParseOptions,
  PhoneInfo,
  WarningCode,
} from './types';

const INVISIBLE = new RegExp('[\\u200B-\\u200D\\u2060\\uFEFF]', 'g');
const NBSP = new RegExp('\\u00A0', 'g');
const DEFAULT_ALLOW: readonly NumberCategory[] = ['mobile'];

/** Parse and classify a phone number without throwing.
 *
 * Accepts local (`01712345678`), international (`+8801712345678`,
 * `8801712345678`, `008801712345678`), separated (`01712-345678`) and Bangla
 * digit input. Anything that is not a string yields `valid: false`.
 *
 * @example
 * parse('+880 1712-345678').operator?.name; // 'Grameenphone'
 */
export function parse(input: unknown, options: ParseOptions = {}): PhoneInfo {
  const locale = options.locale ?? 'en';
  const allow = options.allow ?? DEFAULT_ALLOW;
  const warnings: WarningCode[] = [];
  const raw = typeof input === 'string' ? input : '';

  const fail = (code: ErrorCode, digits = '', extra: Partial<PhoneInfo> = {}): PhoneInfo => ({
    valid: false,
    input: raw,
    digits,
    ...extra,
    error: { code, message: messageFor(code, locale) },
    warnings,
  });

  if (typeof input !== 'string') return fail('not_a_string');

  if (hasBanglaDigits(input)) warnings.push('bangla_digits');
  let s = toEnglishDigits(input)
    .replace(INVISIBLE, '')
    .replace(NBSP, ' ')
    .trim()
    .replace(/^tel:/i, '')
    .trim();
  if (s === '') return fail('empty');
  if (!/^\+?[\d\s().-]+$/.test(s)) return fail('invalid_characters');

  const hasPlus = s.startsWith('+');
  s = s.replace(/\D/g, '');
  if (s === '') return fail('empty');
  let d = s;

  // Short codes and hotlines are dialled as-is, never with a country code.
  if (!hasPlus && SHORT_CODE_PATTERN.test(d)) {
    return finish(
      { valid: allow.includes('shortcode'), input, digits: d, category: 'shortcode', local: d, warnings },
      allow,
      locale,
    );
  }

  if (d.startsWith('00880')) {
    d = d.slice(2);
    warnings.push('international_prefix');
  } else if (d.startsWith('00')) {
    return fail('invalid_country_code', d);
  }

  let national: string;
  if (d.startsWith('880')) {
    let rest = d.slice(3);
    if (rest.startsWith('0')) {
      rest = rest.slice(1);
      warnings.push('extra_trunk_zero');
    }
    national = '0' + rest;
  } else if (hasPlus) {
    return fail('invalid_country_code', d);
  } else if (d.startsWith('0')) {
    national = d;
  } else if (d.startsWith('1') && (options.allowMissingLeadingZero ?? true)) {
    national = '0' + d;
    warnings.push('missing_leading_zero');
  } else {
    return fail('invalid_format', d);
  }

  if (national.startsWith('01')) return parseMobile(national, input, allow, locale, warnings, fail);
  return parseLandline(national, input, allow, locale, warnings, fail);
}

type Fail = (code: ErrorCode, digits?: string, extra?: Partial<PhoneInfo>) => PhoneInfo;

function parseMobile(
  national: string,
  input: string,
  allow: readonly NumberCategory[],
  locale: NonNullable<ParseOptions['locale']>,
  warnings: WarningCode[],
  fail: Fail,
): PhoneInfo {
  if (national.length < 11) return fail('too_short', national);
  if (national.length > 11) return fail('too_long', national);
  const operator: Operator | undefined = operatorForPrefix(national.slice(0, 3));
  if (!operator) return fail('invalid_operator_prefix', national);
  return finish(
    {
      valid: true,
      input,
      digits: national,
      category: 'mobile',
      local: national,
      e164: '+880' + national.slice(1),
      operator,
      warnings,
    },
    allow,
    locale,
  );
}

function parseLandline(
  national: string,
  input: string,
  allow: readonly NumberCategory[],
  locale: NonNullable<ParseOptions['locale']>,
  warnings: WarningCode[],
  fail: Fail,
): PhoneInfo {
  const areaCode = findAreaCode(national);
  if (!areaCode) return fail('unknown_area_code', national);
  if (national.length < 9) return fail('too_short', national);
  if (national.length > 11) return fail('too_long', national);
  return finish(
    {
      valid: true,
      input,
      digits: national,
      category: 'landline',
      local: national,
      e164: '+880' + national.slice(1),
      areaCode,
      warnings,
    },
    allow,
    locale,
  );
}

/** Apply the `allow` filter to an otherwise valid parse result. */
function finish(
  info: PhoneInfo,
  allow: readonly NumberCategory[],
  locale: NonNullable<ParseOptions['locale']>,
): PhoneInfo {
  if (info.category && !allow.includes(info.category)) {
    return {
      ...info,
      valid: false,
      error: { code: 'category_not_allowed', message: messageFor('category_not_allowed', locale) },
    };
  }
  return { ...info, valid: true };
}

/** True when the input is an acceptable Bangladeshi number (mobile by default). */
export function isValid(input: unknown, options: ParseOptions = {}): boolean {
  return parse(input, options).valid;
}

/** Operator for a valid mobile number, otherwise `null`. */
export function getOperator(input: unknown, options: ParseOptions = {}): Operator | null {
  const info = parse(input, { ...options, allow: ['mobile', 'landline', 'shortcode'] });
  return info.operator ?? null;
}

/** Category (`mobile`, `landline`, `shortcode`) of a number, or `null` if unrecognized. */
export function getCategory(input: unknown, options: ParseOptions = {}): NumberCategory | null {
  const info = parse(input, { ...options, allow: ['mobile', 'landline', 'shortcode'] });
  return info.category ?? null;
}
