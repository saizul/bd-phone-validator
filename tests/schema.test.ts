import { describe, expect, it } from 'vitest';
import {
  MOBILE_INPUT_PATTERN,
  PhoneValidationError,
  antdRule,
  phoneSchema,
  rhfRule,
  yupTest,
} from '../src';

describe('phoneSchema', () => {
  const s = phoneSchema();

  it('parses valid input to E.164', () => {
    expect(s.parse('01712-345678')).toBe('+8801712345678');
    expect(s.safeParse('০১৭১২৩৪৫৬৭৮')).toEqual({ success: true, data: '+8801712345678' });
  });

  it('throws a typed error', () => {
    expect(() => s.parse('123')).toThrow(PhoneValidationError);
    try {
      s.parse('123');
    } catch (e) {
      expect((e as PhoneValidationError).code).toBe('too_short');
    }
  });

  it('safeParse reports failures', () => {
    const r = s.safeParse('01012345678');
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('invalid_operator_prefix');
  });

  it('validate / check mimic form libraries', () => {
    expect(s.validate('01712345678')).toBe(true);
    expect(s.validate('x')).toBe('Phone number contains invalid characters.');
    expect(s.check('01712345678')).toBeUndefined();
    expect(s.check('')).toBe('Phone number is required.');
  });

  it('supports optional fields', () => {
    const o = phoneSchema({ required: false });
    expect(o.parse('')).toBe('');
    expect(o.parse(undefined)).toBe('');
    expect(o.validate('   ')).toBe(true);
    expect(o.validate('12')).not.toBe(true);
  });

  it('supports output styles and messages', () => {
    expect(phoneSchema({ output: 'local' }).parse('+8801712345678')).toBe('01712345678');
    expect(phoneSchema({ output: 'national' }).parse('+8801712345678')).toBe('01712-345678');
    expect(phoneSchema({ message: 'Bad phone' }).validate('x')).toBe('Bad phone');
    expect(phoneSchema({ message: (e) => `E:${e.code}` }).validate('x')).toBe('E:invalid_characters');
    expect(phoneSchema({ locale: 'bn' }).validate('')).toBe('ফোন নম্বর দিন।');
  });

  it('implements the Standard Schema contract', () => {
    const std = s['~standard'];
    expect(std.version).toBe(1);
    expect(std.vendor).toBe('bd-phone-validator');
    expect(std.validate('01712345678')).toEqual({ value: '+8801712345678' });
    expect(std.validate('x')).toHaveProperty('issues');
  });

  it('allows landlines when configured', () => {
    expect(phoneSchema({ allow: ['mobile', 'landline'] }).parse('0222334455')).toBe('+880222334455');
  });
});

describe('form adapters', () => {
  it('rhfRule', () => {
    const rule = rhfRule();
    expect(rule.validate('01712345678')).toBe(true);
    expect(rule.validate('1')).not.toBe(true);
  });

  it('antdRule', async () => {
    const rule = antdRule();
    await expect(rule.validator({}, '01712345678')).resolves.toBeUndefined();
    await expect(rule.validator({}, 'x')).rejects.toThrow('invalid characters');
  });

  it('yupTest', () => {
    const t = yupTest();
    expect(t.name).toBe('bd-phone');
    expect(t.test('01712345678')).toBe(true);
    expect(t.test('x')).toBe(false);
    expect(typeof t.message).toBe('string');
    expect(yupTest({ message: 'custom' }).message).toBe('custom');
  });

  it('MOBILE_INPUT_PATTERN works as an HTML pattern', () => {
    const re = new RegExp(`^${MOBILE_INPUT_PATTERN}$`);
    for (const ok of ['01712345678', '8801712345678', '+8801712345678', '008801712345678']) expect(re.test(ok)).toBe(true);
    for (const bad of ['01012345678', '0171234567', '+9101712345678', '017123456789']) expect(re.test(bad)).toBe(false);
  });
});
