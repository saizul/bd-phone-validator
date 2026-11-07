import { describe, expect, it } from 'vitest';
import { getCategory, getOperator, isValid, parse } from '../src';

describe('accepted mobile formats', () => {
  const same = [
    '01712345678',
    '+8801712345678',
    '8801712345678',
    '008801712345678',
    '01712-345678',
    '01712 345678',
    '0171 234 5678',
    '017-1234-5678',
    '+880 1712-345678',
    '+880-1712-345678',
    '+880 (1712) 345678',
    '+88001712345678',
    '(0171) 2345678',
    '01712.345.678',
    '  01712345678  ',
    '\t01712345678\n',
    'tel:+8801712345678',
    '1712345678',
    '১৭১২৩৪৫৬৭৮',
    '০১৭১২৩৪৫৬৭৮',
    '০১৭১২-৩৪৫৬৭৮',
    '+৮৮০১৭১২৩৪৫৬৭৮',
    '৮৮০১৭১২৩৪৫৬৭৮',
    '01712 345678',
    '0171​2345678',
  ];
  it.each(same)('%j normalizes to +8801712345678', (input) => {
    const info = parse(input);
    expect(info.valid).toBe(true);
    expect(info.e164).toBe('+8801712345678');
    expect(info.local).toBe('01712345678');
    expect(info.category).toBe('mobile');
    expect(info.operator?.id).toBe('grameenphone');
  });
});

describe('operators', () => {
  it.each([
    ['01312345678', 'grameenphone'],
    ['01412345678', 'banglalink'],
    ['01512345678', 'teletalk'],
    ['01612345678', 'robi'],
    ['01712345678', 'grameenphone'],
    ['01812345678', 'robi'],
    ['01912345678', 'banglalink'],
  ])('%s -> %s', (num, id) => {
    expect(getOperator(num)?.id).toBe(id);
    expect(isValid(num)).toBe(true);
  });

  it('exposes display names and former brand', () => {
    const robi = getOperator('01612345678');
    expect(robi).toMatchObject({ name: 'Robi', nameBn: 'রবি', prefix: '016', formerName: 'Airtel' });
    expect(getOperator('01812345678')?.formerName).toBeUndefined();
    expect(getOperator('01712345678')?.nameBn).toBe('গ্রামীণফোন');
    expect(getOperator('01912345678')?.name).toBe('Banglalink');
    expect(getOperator('01512345678')?.name).toBe('Teletalk');
  });

  it('returns null when there is no operator', () => {
    expect(getOperator('nope')).toBeNull();
    expect(getOperator('0212345678')).toBeNull();
    expect(getOperator(42)).toBeNull();
  });
});

describe('rejections with reasons', () => {
  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['---', 'empty'],
    ['abc', 'invalid_characters'],
    ['0171234567x', 'invalid_characters'],
    ['0171234+5678', 'invalid_characters'],
    ['01712345', 'too_short'],
    ['0171234567', 'too_short'],
    ['017123456789', 'too_long'],
    ['+88017123456789', 'too_long'],
    ['01012345678', 'invalid_operator_prefix'],
    ['01112345678', 'invalid_operator_prefix'],
    ['01212345678', 'invalid_operator_prefix'],
    ['+8801012345678', 'invalid_operator_prefix'],
    ['+919876543210', 'invalid_country_code'],
    ['+14155552671', 'invalid_country_code'],
    ['0044 7911 123456', 'invalid_country_code'],
    ['8123456789', 'invalid_format'],
    ['5551234', 'invalid_format'],
    ['0990123456', 'unknown_area_code'],
    ['+8801', 'too_short'],
  ])('%j -> %s', (input, code) => {
    const info = parse(input);
    expect(info.valid).toBe(false);
    expect(info.error?.code).toBe(code);
    expect(info.error?.message.length).toBeGreaterThan(0);
  });

  it.each([null, undefined, 1712345678, {}, [], true, Symbol('x')])('non-string %s', (v) => {
    const info = parse(v);
    expect(info.valid).toBe(false);
    expect(info.error?.code).toBe('not_a_string');
  });

  it('never throws', () => {
    for (const v of ['\u0000', '😀', '+', '++8801712345678', '٠١٢٣', '০১৭১২৩৪৫৬৭৮৯০', '\\n', '1e10']) {
      expect(() => parse(v)).not.toThrow();
    }
    expect(parse('++8801712345678').valid).toBe(false);
  });

  it('localizes messages', () => {
    expect(parse('', { locale: 'bn' }).error?.message).toBe('ফোন নম্বর দিন।');
    expect(parse('', { locale: 'en' }).error?.message).toBe('Phone number is required.');
  });
});

describe('warnings', () => {
  it('reports fixes made while normalizing', () => {
    expect(parse('০১৭১২৩৪৫৬৭৮').warnings).toContain('bangla_digits');
    expect(parse('1712345678').warnings).toContain('missing_leading_zero');
    expect(parse('+88001712345678').warnings).toContain('extra_trunk_zero');
    expect(parse('008801712345678').warnings).toContain('international_prefix');
    expect(parse('01712345678').warnings).toEqual([]);
  });

  it('can refuse a missing leading zero', () => {
    expect(isValid('1712345678', { allowMissingLeadingZero: false })).toBe(false);
    expect(parse('1712345678', { allowMissingLeadingZero: false }).error?.code).toBe('invalid_format');
  });
});

describe('landlines', () => {
  it.each([
    ['0222334455', '02'],
    ['02-9123456', '02'],
    ['+880 2 2233 4455', '02'],
    ['031-710123', '031'],
    ['0821-716000', '0821'],
    ['0721 775555', '0721'],
  ])('%s is a landline in area %s', (input, area) => {
    const info = parse(input, { allow: ['landline'] });
    expect(info.valid).toBe(true);
    expect(info.category).toBe('landline');
    expect(info.areaCode).toBe(area);
    expect(info.operator).toBeUndefined();
  });

  it('is not accepted by default', () => {
    const info = parse('0222334455');
    expect(info.valid).toBe(false);
    expect(info.error?.code).toBe('category_not_allowed');
    expect(info.category).toBe('landline');
    expect(getCategory('0222334455')).toBe('landline');
  });

  it('rejects unknown area codes and bad lengths', () => {
    expect(parse('0991234567', { allow: ['landline'] }).error?.code).toBe('unknown_area_code');
    expect(parse('02123', { allow: ['landline'] }).error?.code).toBe('too_short');
    expect(parse('0212345678901', { allow: ['landline'] }).error?.code).toBe('too_long');
  });
});

describe('short codes and hotlines', () => {
  it.each(['999', '16263', '16216', '16000', '333', '109', '106', '199'])('%s is a short code', (code) => {
    const info = parse(code, { allow: ['shortcode'] });
    expect(info.valid).toBe(true);
    expect(info.category).toBe('shortcode');
    expect(info.e164).toBeUndefined();
    expect(info.local).toBe(code);
  });

  it('is not valid unless allowed', () => {
    expect(isValid('999')).toBe(false);
    expect(parse('999').error?.code).toBe('category_not_allowed');
    expect(isValid('999', { allow: ['mobile', 'shortcode'] })).toBe(true);
  });

  it('does not treat arbitrary three digit numbers as short codes', () => {
    expect(parse('123', { allow: ['shortcode'] }).valid).toBe(false);
    expect(parse('123').error?.code).toBe('too_short');
  });

  it('is never reached with a plus sign or too many digits', () => {
    expect(parse('+999', { allow: ['shortcode'] }).valid).toBe(false);
    expect(parse('1626', { allow: ['shortcode'] }).valid).toBe(false);
    expect(getCategory('16263')).toBe('shortcode');
  });

  it('handles Bangla digits', () => {
    expect(parse('১৬২৬৩', { allow: ['shortcode'] }).local).toBe('16263');
  });
});

describe('allow list', () => {
  it('can accept several categories', () => {
    const opts = { allow: ['mobile', 'landline', 'shortcode'] } as const;
    expect(isValid('01712345678', opts)).toBe(true);
    expect(isValid('0222334455', opts)).toBe(true);
    expect(isValid('16263', opts)).toBe(true);
  });
});
