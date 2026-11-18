import { describe, expect, it } from 'vitest';
import { isSameNumber } from '../src';

describe('isSameNumber', () => {
  it.each([
    ['01712345678', '+8801712345678'],
    ['01712-345678', '+880 1712 345678'],
    ['০১৭১২৩৪৫৬৭৮', '1712345678'],
    ['8801712345678', '00880-1712-345678'],
    ['(017) 1234-5678', '01712345678'],
  ])('%s equals %s', (a, b) => {
    expect(isSameNumber(a, b)).toBe(true);
    expect(isSameNumber(b, a)).toBe(true);
  });

  it('detects different numbers', () => {
    expect(isSameNumber('01712345678', '01812345678')).toBe(false);
    expect(isSameNumber('01712345678', '01712345679')).toBe(false);
  });

  it('never matches invalid input', () => {
    expect(isSameNumber('12345', '12345')).toBe(false);
    expect(isSameNumber('01712345678', 'oops')).toBe(false);
    expect(isSameNumber(null, null)).toBe(false);
    expect(isSameNumber(undefined, '01712345678')).toBe(false);
  });

  it('compares landlines and short codes by default', () => {
    expect(isSameNumber('02-22334455', '+880 2 2233 4455')).toBe(true);
    expect(isSameNumber('999', '৯৯৯')).toBe(true);
    expect(isSameNumber('999', '16263')).toBe(false);
  });

  it('honours allow and allowMissingLeadingZero', () => {
    expect(isSameNumber('02-22334455', '+880222334455', { allow: ['mobile'] })).toBe(false);
    expect(isSameNumber('1712345678', '01712345678', { allowMissingLeadingZero: false })).toBe(false);
  });
});
