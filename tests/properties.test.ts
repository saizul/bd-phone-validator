import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  cleanList,
  format,
  getOperator,
  isValid,
  mask,
  normalize,
  parse,
  redact,
  toBanglaDigits,
  toEnglishDigits,
  validateBulk,
} from '../src';
import type { FormatStyle } from '../src';

const digit = fc.integer({ min: 0, max: 9 }).map(String);
const digits = (n: number) => fc.array(digit, { minLength: n, maxLength: n }).map((a) => a.join(''));
/** A syntactically valid local mobile number: 01[3-9] + 8 digits. */
const mobile = fc
  .tuple(fc.integer({ min: 3, max: 9 }), digits(8))
  .map(([op, rest]) => `01${op}${rest}`);
const seps = fc.constantFrom('', ' ', '-', '.', '  ');
const styles: FormatStyle[] = ['e164', 'international', 'national', 'local', 'msisdn'];

describe('properties', () => {
  it('every generated mobile number is valid and normalizes to +880', () => {
    fc.assert(
      fc.property(mobile, (n) => {
        expect(isValid(n)).toBe(true);
        expect(normalize(n)).toBe('+880' + n.slice(1));
        expect(normalize(n, 'local')).toBe(n);
      }),
    );
  });

  it('all spellings of one number agree', () => {
    fc.assert(
      fc.property(mobile, seps, seps, fc.constantFrom('', '+880', '880', '00880', '0'), (n, s1, s2, prefix) => {
        const body = n.slice(1);
        const variant = prefix === '0' ? `0${s1}${body.slice(0, 4)}${s2}${body.slice(4)}` : `${prefix}${s1}${body.slice(0, 4)}${s2}${body.slice(4)}`;
        if (prefix === '') return; // leading zero lost: covered elsewhere
        expect(normalize(variant)).toBe('+880' + body);
      }),
    );
  });

  it('Bangla digit spelling is equivalent to English', () => {
    fc.assert(
      fc.property(mobile, (n) => {
        expect(normalize(toBanglaDigits(n))).toBe(normalize(n));
        expect(normalize(toBanglaDigits('+880' + n.slice(1)))).toBe(normalize(n));
      }),
    );
  });

  it('digit conversion round-trips', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(toEnglishDigits(toBanglaDigits(s))).toBe(toEnglishDigits(s));
      }),
    );
    fc.assert(
      fc.property(fc.stringMatching(/^[0-9]{0,20}$/), (s) => {
        expect(toEnglishDigits(toBanglaDigits(s))).toBe(s);
      }),
    );
  });

  it('normalize is idempotent', () => {
    fc.assert(
      fc.property(mobile, (n) => {
        const once = normalize(n) as string;
        expect(normalize(once)).toBe(once);
        const local = normalize(n, 'local') as string;
        expect(normalize(local, 'local')).toBe(local);
      }),
    );
  });

  it('every format style re-parses to the same number', () => {
    fc.assert(
      fc.property(mobile, fc.constantFrom(...styles), (n, style) => {
        const out = format(n, style) as string;
        expect(normalize(out)).toBe(normalize(n));
      }),
    );
  });

  it('operator always matches the prefix table', () => {
    const table: Record<string, string> = {
      '3': 'grameenphone', '4': 'banglalink', '5': 'teletalk', '6': 'robi', '7': 'grameenphone', '8': 'robi', '9': 'banglalink',
    };
    fc.assert(
      fc.property(mobile, (n) => {
        expect(getOperator(n)?.id).toBe(table[n[2] as string]);
      }),
    );
  });

  it('prefixes 010, 011 and 012 are never valid', () => {
    fc.assert(
      fc.property(fc.constantFrom('010', '011', '012'), digits(8), (p, rest) => {
        const info = parse(p + rest);
        expect(info.valid).toBe(false);
        expect(info.error?.code).toBe('invalid_operator_prefix');
      }),
    );
  });

  it('wrong lengths are rejected with the right reason', () => {
    fc.assert(
      fc.property(fc.integer({ min: 3, max: 9 }), fc.integer({ min: 0, max: 7 }), (op, extra) => {
        const short = parse('01' + op + '1'.repeat(extra), { allowMissingLeadingZero: false });
        expect(short.error?.code).toBe('too_short');
        const long = parse('01' + op + '1'.repeat(9 + extra));
        expect(long.error?.code).toBe('too_long');
      }),
    );
  });

  it('never throws on arbitrary input', () => {
    fc.assert(
      fc.property(fc.anything(), (v) => {
        const info = parse(v);
        expect(typeof info.valid).toBe('boolean');
        if (!info.valid) expect(info.error).toBeDefined();
        mask(v);
      }),
      { numRuns: 500 },
    );
    // regression: objects without a prototype cannot be converted with String()
    expect(() => mask(Object.create(null))).not.toThrow();
    expect(() => parse(Object.create(null))).not.toThrow();
    fc.assert(
      fc.property(fc.string({ maxLength: 40 }), (s) => {
        parse(s);
        redact(s);
        expect(typeof format(s)).not.toBe('undefined');
      }),
      { numRuns: 500 },
    );
  });

  it('valid results always carry consistent fields', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 20 }), (s) => {
        const info = parse(s);
        if (info.valid) {
          expect(info.local).toMatch(/^01[3-9]\d{8}$/);
          expect(info.e164).toBe('+880' + (info.local as string).slice(1));
          expect(info.operator).toBeDefined();
        }
      }),
      { numRuns: 1000 },
    );
  });

  it('mask keeps length and hides the middle', () => {
    fc.assert(
      fc.property(mobile, fc.integer({ min: 0, max: 5 }), fc.integer({ min: 0, max: 5 }), (n, a, b) => {
        const m = mask(n, { keepStart: a, keepEnd: b });
        expect(m).toHaveLength(n.length);
        expect(m.slice(0, a)).toBe(n.slice(0, a));
        if (b > 0) expect(m.slice(-b)).toBe(n.slice(-b));
        expect(m.slice(a, n.length - b)).toMatch(/^\*+$|^$/);
      }),
    );
  });

  it('redact removes every valid number embedded in text', () => {
    fc.assert(
      fc.property(mobile, fc.constantFrom('Call ', 'tel: ', 'Contact - '), fc.constantFrom('', '.', ' ok', ', thanks'), (n, pre, post) => {
        const out = redact(`${pre}${n}${post}`, { replacement: '#' });
        expect(out).toBe(`${pre}#${post}`);
      }),
    );
  });

  it('bulk: unique results have unique keys and counts add up', () => {
    fc.assert(
      fc.property(fc.array(fc.oneof(mobile, fc.string({ maxLength: 12 })), { maxLength: 60 }), (items) => {
        const r = validateBulk(items);
        const keys = r.unique.map((u) => u.e164);
        expect(new Set(keys).size).toBe(keys.length);
        expect(r.stats.total).toBe(items.length);
        expect(r.stats.valid + r.stats.invalid).toBe(items.length);
        expect(r.stats.unique + r.stats.duplicates).toBe(r.stats.valid);
        expect(cleanList(items)).toEqual(keys);
      }),
    );
  });

  it('bulk de-duplication treats spellings of a number as one', () => {
    fc.assert(
      fc.property(mobile, (n) => {
        const r = validateBulk([n, '+880' + n.slice(1), toBanglaDigits(n), `${n.slice(0, 5)}-${n.slice(5)}`]);
        expect(r.stats.unique).toBe(1);
        expect(r.stats.duplicates).toBe(3);
      }),
    );
  });

  it('lost leading zero is recovered only for 1[3-9] numbers', () => {
    fc.assert(
      fc.property(mobile, (n) => {
        expect(normalize(n.slice(1))).toBe(normalize(n));
        expect(parse(n.slice(1)).warnings).toContain('missing_leading_zero');
      }),
    );
  });
});
