import { describe, expect, it } from 'vitest';
import { hasBanglaDigits, toBanglaDigits, toEnglishDigits } from '../src';

describe('digit helpers', () => {
  it.each([
    ['০১৭১২৩৪৫৬৭৮', '01712345678'],
    ['০১৭১২-৩৪৫৬৭৮', '01712-345678'],
    ['+৮৮০১৭১২৩৪৫৬৭৮', '+8801712345678'],
    ['mixed ০১ and 23', 'mixed 01 and 23'],
    ['', ''],
    ['abc', 'abc'],
    ['০১২৩৪৫৬৭৮৯', '0123456789'],
  ])('toEnglishDigits(%s)', (input, expected) => {
    expect(toEnglishDigits(input)).toBe(expected);
  });

  it.each([
    ['01712345678', '০১৭১২৩৪৫৬৭৮'],
    ['+8801712345678', '+৮৮০১৭১২৩৪৫৬৭৮'],
    ['0123456789', '০১২৩৪৫৬৭৮৯'],
    ['no digits', 'no digits'],
    ['', ''],
  ])('toBanglaDigits(%s)', (input, expected) => {
    expect(toBanglaDigits(input)).toBe(expected);
  });

  it('detects Bangla digits', () => {
    expect(hasBanglaDigits('০১')).toBe(true);
    expect(hasBanglaDigits('01')).toBe(false);
    expect(hasBanglaDigits('')).toBe(false);
  });

  it('keeps astral characters intact', () => {
    expect(toEnglishDigits('😀০')).toBe('😀0');
    expect(toBanglaDigits('😀0')).toBe('😀০');
  });
});
