import { describe, expect, it } from 'vitest';
import { format, normalize } from '../src';

describe('normalize', () => {
  it.each([
    ['01712345678', '+8801712345678'],
    ['+8801712345678', '+8801712345678'],
    ['8801712345678', '+8801712345678'],
    ['01712-345678', '+8801712345678'],
    ['০১৭১২৩৪৫৬৭৮', '+8801712345678'],
    ['01912345678', '+8801912345678'],
  ])('%s -> e164 %s', (input, expected) => {
    expect(normalize(input)).toBe(expected);
  });

  it.each([
    ['+8801712345678', '01712345678'],
    ['8801812345678', '01812345678'],
    ['০১৭১২৩৪৫৬৭৮', '01712345678'],
  ])('%s -> local %s', (input, expected) => {
    expect(normalize(input, 'local')).toBe(expected);
  });

  it('returns null for invalid input', () => {
    expect(normalize('123')).toBeNull();
    expect(normalize(null)).toBeNull();
    expect(normalize('01012345678', 'local')).toBeNull();
  });

  it('normalizes landlines when allowed', () => {
    expect(normalize('02-2233 4455', 'e164', { allow: ['landline'] })).toBe('+88022233 4455'.replace(' ', ''));
    expect(normalize('0222334455')).toBeNull();
  });
});

describe('format styles', () => {
  const n = '01712345678';
  it('national', () => expect(format(n)).toBe('01712-345678'));
  it('local', () => expect(format(n, 'local')).toBe('01712345678'));
  it('international', () => expect(format(n, 'international')).toBe('+880 1712-345678'));
  it('e164', () => expect(format(n, 'e164')).toBe('+8801712345678'));
  it('msisdn', () => expect(format(n, 'msisdn')).toBe('8801712345678'));

  it('formats landlines', () => {
    expect(format('0222334455', 'national', { allow: ['landline'] })).toBe('02-22334455');
    expect(format('0222334455', 'international', { allow: ['landline'] })).toBe('+880 2-22334455');
    expect(format('031710123', 'national', { allow: ['landline'] })).toBe('031-710123');
  });

  it('formats short codes only domestically', () => {
    const o = { allow: ['shortcode'] } as const;
    expect(format('16263', 'national', o)).toBe('16263');
    expect(format('16263', 'local', o)).toBe('16263');
    expect(format('16263', 'e164', o)).toBeNull();
    expect(format('16263', 'international', o)).toBeNull();
  });

  it('returns null for invalid input', () => {
    expect(format('nope')).toBeNull();
    expect(format(undefined, 'e164')).toBeNull();
  });
});
