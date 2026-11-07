import { describe, expect, it } from 'vitest';
import { mask, redact } from '../src';

describe('mask', () => {
  it('masks a local number by default', () => {
    expect(mask('01712345678')).toBe('017******78');
    expect(mask('+8801712345678')).toBe('017******78');
    expect(mask('০১৭১২৩৪৫৬৭৮')).toBe('017******78');
  });

  it('supports custom keep counts and mask character', () => {
    expect(mask('01712345678', { keepStart: 5, keepEnd: 0 })).toBe('01712******');
    expect(mask('01712345678', { keepStart: 0, keepEnd: 0, maskChar: '#' })).toBe('###########');
    expect(mask('01712345678', { keepStart: 2, keepEnd: 4 })).toBe('01*****5678');
  });

  it('masks formatted output styles', () => {
    expect(mask('01712345678', { style: 'e164' })).toBe('+88017******78');
    expect(mask('01712345678', { style: 'national' })).toBe('017**-****78');
    expect(mask('01712345678', { style: 'international' })).toBe('+880 17**-****78');
  });

  it('masks invalid input best-effort and keeps separators', () => {
    expect(mask('12345678901234')).toBe('123*********34');
    expect(mask('abc-12345')).toBe('abc-12345');
    expect(mask('abc-1234567', { keepStart: 1, keepEnd: 1 })).toBe('abc-1*****7');
    expect(mask('')).toBe('');
    expect(mask(null)).toBe('');
  });
});

describe('redact', () => {
  it('masks numbers inside text', () => {
    expect(redact('Call 01712-345678 today')).toBe('Call 017******78 today');
    expect(redact('a +8801712345678, b ০১৯১২৩৪৫৬৭৮.')).toBe('a 017******78, b 019******78.');
  });

  it('leaves non-phone digits alone', () => {
    const s = 'Order 123456 on 2026-03-14 total 1,500 BDT';
    expect(redact(s)).toBe(s);
  });

  it('finds a number next to other digit groups', () => {
    expect(redact('ref 2026 01712345678 end')).toBe('ref 2026 017******78 end');
  });

  it('supports a fixed replacement', () => {
    expect(redact('mail me at 01712345678', { replacement: '[phone]' })).toBe('mail me at [phone]');
  });

  it('redacts several numbers', () => {
    expect(redact('01712345678 / 01812345678')).toBe('017******78 / 018******78');
  });

  it('is a no-op without numbers', () => {
    expect(redact('')).toBe('');
    expect(redact('hello world')).toBe('hello world');
  });
});
