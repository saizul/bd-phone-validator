import { describe, expect, it } from 'vitest';
import { cleanList, validateBulk } from '../src';

const sample = [
  '01712345678',
  '+8801712345678', // duplicate of first
  '01812-345678',
  'not a number',
  '',
  '01012345678',
  '০১৯১২৩৪৫৬৭৮',
  '8801912345678', // duplicate of the Bangla one
  '01512345678',
];

describe('validateBulk', () => {
  const r = validateBulk(sample);

  it('computes stats', () => {
    expect(r.stats).toMatchObject({ total: 9, valid: 6, invalid: 3, duplicates: 2, unique: 4 });
    expect(r.stats.byOperator).toEqual({ grameenphone: 1, robi: 1, banglalink: 1, teletalk: 1 });
    expect(r.stats.byCategory).toEqual({ mobile: 4 });
    expect(r.stats.byError).toEqual({ invalid_characters: 1, empty: 1, invalid_operator_prefix: 1 });
  });

  it('keeps order and marks duplicates', () => {
    expect(r.entries).toHaveLength(9);
    expect(r.duplicates.map((d) => [d.index, d.duplicateOf])).toEqual([
      [1, 0],
      [7, 6],
    ]);
    expect(r.invalid.map((e) => e.index)).toEqual([3, 4, 5]);
    expect(r.unique.map((u) => u.e164)).toEqual([
      '+8801712345678',
      '+8801812345678',
      '+8801912345678',
      '+8801512345678',
    ]);
  });

  it('can skip de-duplication', () => {
    const all = validateBulk(sample, { dedupe: false });
    expect(all.stats.duplicates).toBe(0);
    expect(all.stats.unique).toBe(6);
  });

  it('accepts any iterable and non-string items', () => {
    const res = validateBulk(new Set(['01712345678', '01812345678']));
    expect(res.stats.valid).toBe(2);
    const odd = validateBulk([null, 12, '01712345678']);
    expect(odd.stats.byError).toEqual({ not_a_string: 2 });
  });

  it('handles empty input', () => {
    expect(validateBulk([]).stats.total).toBe(0);
  });

  it('respects allowed categories', () => {
    const res = validateBulk(['01712345678', '0222334455', '999'], { allow: ['mobile', 'landline', 'shortcode'] });
    expect(res.stats.byCategory).toEqual({ mobile: 1, landline: 1, shortcode: 1 });
  });
});

describe('cleanList', () => {
  it('returns unique normalized valid numbers', () => {
    expect(cleanList(sample)).toEqual(['+8801712345678', '+8801812345678', '+8801912345678', '+8801512345678']);
    expect(cleanList(sample, 'local')).toEqual(['01712345678', '01812345678', '01912345678', '01512345678']);
  });
});
