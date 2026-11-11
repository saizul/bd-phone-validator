import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { extractNumbers, findNumbers, parse } from '../src';

describe('findNumbers', () => {
  it('finds numbers in any written form with exact positions', () => {
    const text = 'Rahim 01712-345678, office +880 1812 345678.\nOrder 20240117, bKash ০১৯১২৩৪৫৬৭৮';
    const found = findNumbers(text);
    expect(found.map((m) => m.info.e164)).toEqual(['+8801712345678', '+8801812345678', '+8801912345678']);
    expect(found.map((m) => m.raw)).toEqual(['01712-345678', '+880 1812 345678', '০১৯১২৩৪৫৬৭৮']);
    for (const m of found) {
      expect(text.slice(m.start, m.end)).toBe(m.raw);
      expect(m.info.valid).toBe(true);
    }
    expect(found.map((m) => [m.line, m.column])).toEqual([
      [1, 7],
      [1, 28],
      [2, 23],
    ]);
    expect(found[1]).toMatchObject({ start: 27, end: 43 });
  });

  it.each([
    ['+880 (1712) 345 678', '+8801712345678'],
    ['008801712345678', '+8801712345678'],
    ['0171 234 5678', '+8801712345678'],
    ['01712.345.678', '+8801712345678'],
    ['+88 01712 345678', '+8801712345678'],
    ['tel:+8801712345678', '+8801712345678'],
    ['(01712345678)', '+8801712345678'],
    ['phone:01712345678.', '+8801712345678'],
    ['ফোন০১৭১২৩৪৫৬৭৮।', '+8801712345678'],
  ])('recognises %s', (text, e164) => {
    expect(findNumbers(text).map((m) => m.info.e164)).toEqual([e164]);
  });

  it.each([
    'Order 20240117 shipped on 2024-01-17',
    'Total 1,234,567.00 BDT',
    'Invoice 01012345678',
    'ID 017123456789',
    'ID 0171234567',
    '1712345678',
    'Ref 17 12345678',
    '',
    'no digits here',
  ])('ignores %j', (text) => {
    expect(findNumbers(text)).toEqual([]);
  });

  it('separates adjacent numbers', () => {
    const cases = [
      '01712345678 01812345678',
      '01712345678-01812345678',
      '01712345678, 01812345678',
      '01712345678/01812345678',
      '01712345678\n01812345678',
      '01712-345678 01812-345678',
    ];
    for (const text of cases) {
      expect(findNumbers(text).map((m) => m.info.local)).toEqual(['01712345678', '01812345678']);
    }
  });

  it('keeps a valid number next to unrelated digits', () => {
    expect(findNumbers('2024 01712345678 99').map((m) => m.raw)).toEqual(['01712345678']);
    expect(findNumbers('12 01712 345678 500').map((m) => m.raw)).toEqual(['01712 345678']);
  });

  it('never joins digits across a line break', () => {
    expect(findNumbers('01712\n345678')).toEqual([]);
    expect(findNumbers('01712\r\n345678')).toEqual([]);
  });

  it('reports line and column with CRLF and multiple lines', () => {
    const found = findNumbers('a\r\nb 01712345678\r\n\r\n  01812345678');
    expect(found.map((m) => [m.line, m.column])).toEqual([
      [2, 3],
      [4, 3],
    ]);
  });

  it('accepts a lost leading zero only when asked', () => {
    expect(findNumbers('1712345678', { allowMissingLeadingZero: true }).map((m) => m.info.local)).toEqual([
      '01712345678',
    ]);
  });

  it('includes landlines and short codes with allow', () => {
    const text = 'Dial 999 or 02-22334455, hotline 16263, mobile 01712345678';
    expect(findNumbers(text).map((m) => m.raw)).toEqual(['01712345678']);
    const all = findNumbers(text, { allow: ['mobile', 'landline', 'shortcode'] });
    expect(all.map((m) => [m.raw, m.info.category])).toEqual([
      ['999', 'shortcode'],
      ['02-22334455', 'landline'],
      ['16263', 'shortcode'],
      ['01712345678', 'mobile'],
    ]);
  });

  it('honours limit', () => {
    const text = '01712345678 01812345678 01912345678';
    expect(findNumbers(text, { limit: 2 })).toHaveLength(2);
    expect(findNumbers(text, { limit: 0 })).toEqual([]);
  });

  it('returns nothing for non-string input', () => {
    expect(findNumbers(undefined as unknown as string)).toEqual([]);
    expect(findNumbers(123 as unknown as string)).toEqual([]);
  });

  it('handles a large text quickly', () => {
    const text = 'lorem 2024-01-17 ipsum 01712-345678 dolor 12 34 56 78 90 12 34 56 78 90\n'.repeat(2000);
    const found = findNumbers(text);
    expect(found).toHaveLength(2000);
    expect(found[1999]).toMatchObject({ line: 2000, column: 24 });
  });
});

describe('extractNumbers', () => {
  const text = 'Rahim: 01712-345678, office ০১৮১২৩৪৫৬৭৮, again +8801712345678';

  it('returns unique E.164 numbers in order of appearance', () => {
    expect(extractNumbers(text)).toEqual(['+8801712345678', '+8801812345678']);
  });

  it('supports styles and keeping duplicates', () => {
    expect(extractNumbers(text, { style: 'local' })).toEqual(['01712345678', '01812345678']);
    expect(extractNumbers(text, { style: 'national', unique: false })).toEqual([
      '01712-345678',
      '01812-345678',
      '01712-345678',
    ]);
    expect(extractNumbers(text, { style: 'msisdn', limit: 1 })).toEqual(['8801712345678']);
  });

  it('falls back to the local form for short codes', () => {
    expect(extractNumbers('Emergency 999', { allow: ['shortcode'] })).toEqual(['999']);
  });

  it('returns an empty list when nothing is found', () => {
    expect(extractNumbers('nothing to see')).toEqual([]);
  });
});

describe('findNumbers properties', () => {
  const mobile = fc
    .tuple(fc.constantFrom('013', '014', '015', '016', '017', '018', '019'), fc.stringMatching(/^[0-9]{8}$/))
    .map(([prefix, rest]) => prefix + rest);
  const filler = fc.constantFrom(' call ', ', ', '\n', ' - ref ', ' / ', ' at 10:30 on ', ' (home) ', ' টাকা ');

  it('finds every embedded number, in order', () => {
    fc.assert(
      fc.property(fc.array(mobile, { minLength: 1, maxLength: 5 }), fc.array(filler, { minLength: 6, maxLength: 6 }), (nums, gaps) => {
        const text = nums.map((n, i) => `${gaps[i]}${n}`).join('') + gaps[5];
        const found = findNumbers(text);
        expect(found.map((m) => m.info.local)).toEqual(nums);
        for (const m of found) expect(text.slice(m.start, m.end)).toBe(m.raw);
      }),
    );
  });

  it('every match is a valid number that does not overlap the previous one', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[0-9০-৯ +().\-\na-z]{0,60}$/), (text) => {
        let previousEnd = 0;
        for (const m of findNumbers(text, { allow: ['mobile', 'landline', 'shortcode'] })) {
          expect(m.start).toBeGreaterThanOrEqual(previousEnd);
          expect(m.end).toBeGreaterThan(m.start);
          expect(text.slice(m.start, m.end)).toBe(m.raw);
          expect(parse(m.raw, { allow: ['mobile', 'landline', 'shortcode'], allowMissingLeadingZero: false }).valid).toBe(true);
          previousEnd = m.end;
        }
      }),
    );
  });
});
