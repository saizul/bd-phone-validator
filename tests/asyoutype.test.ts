import { describe, expect, it } from 'vitest';
import { AsYouType, formatAsYouType, parse } from '../src';

const fmt = (input: string, options = {}) => formatAsYouType(input, options).formatted;

describe('formatAsYouType: national mobile', () => {
  it.each([
    ['', ''],
    ['0', '0'],
    ['01', '01'],
    ['017', '017'],
    ['0171', '0171'],
    ['01712', '01712'],
    ['017123', '01712-3'],
    ['0171234567', '01712-34567'],
    ['01712345678', '01712-345678'],
  ])('%s -> %s', (input, expected) => {
    expect(fmt(input)).toBe(expected);
  });

  it('ignores separators the user typed', () => {
    expect(fmt('01712 34')).toBe('01712-34');
    expect(fmt('(017) 12-34')).toBe('01712-34');
  });

  it('detects the operator from the prefix', () => {
    expect(formatAsYouType('01').operator).toBeUndefined();
    expect(formatAsYouType('019').operator?.id).toBe('banglalink');
    expect(formatAsYouType('0161').operator?.formerName).toBe('Airtel');
  });

  it('reports remaining digits and completion', () => {
    const partial = formatAsYouType('0171234');
    expect(partial).toMatchObject({ category: 'mobile', complete: false, possible: true, remaining: 4 });
    expect(partial.e164).toBeUndefined();
    const done = formatAsYouType('01712345678');
    expect(done).toMatchObject({ complete: true, possible: true, remaining: 0, e164: '+8801712345678' });
  });

  it('flags impossible prefixes and overlong input', () => {
    expect(formatAsYouType('012').possible).toBe(false);
    const long = formatAsYouType('017123456789');
    expect(long).toMatchObject({ possible: false, complete: false, formatted: '017123456789' });
  });

  it('restores a lost leading zero once it cannot be a hotline', () => {
    expect(fmt('17')).toBe('017');
    expect(fmt('171234')).toBe('01712-34');
    expect(formatAsYouType('16').category).toBeUndefined();
    expect(fmt('161234')).toBe('01612-34');
    expect(fmt('171234', { allowMissingLeadingZero: false })).toBe('171234');
    expect(formatAsYouType('171234', { allowMissingLeadingZero: false }).possible).toBe(false);
  });
});

describe('formatAsYouType: international entry', () => {
  it.each([
    ['+', '+'],
    ['+8', '+8'],
    ['+88', '+88'],
    ['+880', '+880'],
    ['+8801', '+880 1'],
    ['+880171', '+880 171'],
    ['+8801712', '+880 1712'],
    ['+88017123', '+880 1712-3'],
    ['+8801712345678', '+880 1712-345678'],
    ['880171234', '+880 1712-34'],
    ['00880171234', '+880 1712-34'],
    ['+880 01712 34', '+880 1712-34'],
    ['tel:+8801712', '+880 1712'],
  ])('%s -> %s', (input, expected) => {
    expect(fmt(input)).toBe(expected);
  });

  it('keeps partial country codes possible and rejects others', () => {
    expect(formatAsYouType('008').possible).toBe(true);
    expect(formatAsYouType('+1').possible).toBe(false);
    expect(formatAsYouType('0044').possible).toBe(false);
    expect(formatAsYouType('+881').possible).toBe(false);
  });

  it('can be forced into either layout', () => {
    expect(fmt('+88017123', { style: 'national' })).toBe('01712-3');
    expect(fmt('017123', { style: 'international' })).toBe('+880 1712-3');
    expect(fmt('17123', { style: 'international' })).toBe('+880 1712-3');
  });

  it('completes with e164 regardless of entry form', () => {
    for (const input of ['+8801712345678', '8801712345678', '008801712345678', '+88001712345678']) {
      expect(formatAsYouType(input).e164).toBe('+8801712345678');
    }
  });
});

describe('formatAsYouType: landlines and short codes', () => {
  it('groups the area code', () => {
    expect(fmt('02')).toBe('02');
    expect(fmt('0222')).toBe('02-22');
    expect(fmt('0222334455')).toBe('02-22334455');
    expect(fmt('0721')).toBe('0721');
    expect(fmt('072181')).toBe('0721-81');
    expect(fmt('+880222', {})).toBe('+880 2-22');
  });

  it('reports landline completion through parse', () => {
    const r = formatAsYouType('0222334455');
    expect(r).toMatchObject({ category: 'landline', areaCode: '02', complete: true, e164: '+880222334455' });
    expect(formatAsYouType('0222').complete).toBe(false);
  });

  it('keeps unknown but possible area codes raw', () => {
    expect(formatAsYouType('07')).toMatchObject({ formatted: '07', possible: true });
    expect(formatAsYouType('0731').possible).toBe(false);
    expect(formatAsYouType('00').possible).toBe(true);
    expect(formatAsYouType('+88000').possible).toBe(false);
  });

  it('recognizes hotlines', () => {
    expect(formatAsYouType('999')).toMatchObject({ category: 'shortcode', complete: true, formatted: '999' });
    expect(formatAsYouType('16263')).toMatchObject({ category: 'shortcode', complete: true });
    expect(formatAsYouType('99')).toMatchObject({ possible: true, complete: false });
    expect(formatAsYouType('55').possible).toBe(false);
  });
});

describe('formatAsYouType: digits, junk and cursor', () => {
  it('keeps Bangla digits by default', () => {
    expect(fmt('০১৭১২৩')).toBe('০১৭১২-৩');
    expect(formatAsYouType('০১৭১২৩').national).toBe('017123');
    expect(fmt('০১৭১২৩', { digits: 'en' })).toBe('01712-3');
    expect(fmt('017123', { digits: 'bn' })).toBe('০১৭১২-৩');
  });

  it('marks letters and misplaced plus signs impossible', () => {
    expect(formatAsYouType('0171a').possible).toBe(false);
    expect(formatAsYouType('017+1').possible).toBe(false);
    expect(formatAsYouType('01712345678x').complete).toBe(false);
  });

  it('never throws on non-string input', () => {
    expect(formatAsYouType(undefined)).toMatchObject({ formatted: '', possible: true, complete: false });
    expect(formatAsYouType(42 as unknown)).toMatchObject({ formatted: '' });
  });

  it('maps the caret into the formatted value', () => {
    expect(formatAsYouType('017123', { cursor: 6 }).cursor).toBe(7);
    expect(formatAsYouType('017123', { cursor: 5 }).cursor).toBe(5);
    expect(formatAsYouType('017123', { cursor: 0 }).cursor).toBe(0);
    expect(formatAsYouType('17123', { cursor: 5 }).cursor).toBe(7);
    expect(formatAsYouType('+88017123', { cursor: 9 }).cursor).toBe(11);
    expect(formatAsYouType('+88017123', { cursor: 1 }).cursor).toBe(1);
    expect(formatAsYouType('01712345678').cursor).toBeUndefined();
  });

  it('agrees with parse for every prefix of a valid number', () => {
    const number = '01812345678';
    for (let i = 1; i <= number.length; i++) {
      const prefix = number.slice(0, i);
      const r = formatAsYouType(prefix);
      expect(r.possible).toBe(true);
      expect(r.complete).toBe(parse(prefix).valid);
    }
  });
});

describe('AsYouType', () => {
  it('formats key by key', () => {
    const typer = new AsYouType();
    const seen = Array.from('01712345678').map((ch) => typer.input(ch));
    expect(seen.slice(4, 7)).toEqual(['01712', '01712-3', '01712-34']);
    expect(typer.result).toMatchObject({ complete: true, e164: '+8801712345678' });
    expect(typer.raw).toBe('01712345678');
  });

  it('backspace removes digits, skipping separators', () => {
    const typer = new AsYouType();
    typer.input('01712-');
    expect(typer.backspace()).toBe('0171');
    typer.reset();
    typer.input('+');
    expect(typer.backspace()).toBe('');
    expect(typer.backspace()).toBe('');
  });

  it('passes options through', () => {
    const typer = new AsYouType({ style: 'international' });
    expect(typer.input('017123')).toBe('+880 1712-3');
  });
});
