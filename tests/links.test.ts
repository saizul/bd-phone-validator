import { describe, expect, it } from 'vitest';
import { toSmsLink, toTelLink, toWhatsAppLink } from '../src';

describe('toWhatsAppLink', () => {
  it.each([
    ['01712345678'],
    ['+8801712345678'],
    ['8801712345678'],
    ['01712-345678'],
    ['০১৭১২৩৪৫৬৭৮'],
    ['1712345678'],
  ])('%s -> wa.me link', (input) => {
    expect(toWhatsAppLink(input)).toBe('https://wa.me/8801712345678');
  });

  it('url-encodes the message', () => {
    expect(toWhatsAppLink('01712345678', 'Hi, is this available? 100% & more')).toBe(
      'https://wa.me/8801712345678?text=Hi%2C%20is%20this%20available%3F%20100%25%20%26%20more',
    );
  });

  it('encodes Bangla text as UTF-8', () => {
    const link = toWhatsAppLink('01712345678', 'হ্যালো') as string;
    expect(decodeURIComponent(link.split('?text=')[1])).toBe('হ্যালো');
    expect(link).not.toMatch(/[^\x20-\x7e]/);
  });

  it('omits the query for missing or empty text', () => {
    expect(toWhatsAppLink('01712345678', '')).toBe('https://wa.me/8801712345678');
    expect(toWhatsAppLink('01712345678', undefined)).toBe('https://wa.me/8801712345678');
  });

  it('returns null for invalid numbers', () => {
    expect(toWhatsAppLink('12345')).toBeNull();
    expect(toWhatsAppLink('01012345678', 'hi')).toBeNull();
    expect(toWhatsAppLink(null)).toBeNull();
    expect(toWhatsAppLink(undefined)).toBeNull();
  });

  it('only accepts mobiles unless told otherwise', () => {
    expect(toWhatsAppLink('02-22334455')).toBeNull();
    expect(toWhatsAppLink('02-22334455', undefined, { allow: ['landline'] })).toBe('https://wa.me/880222334455');
  });
});

describe('toTelLink', () => {
  it.each([['01712345678'], ['+8801712345678'], ['008801712345678'], ['০১৭১২-৩৪৫৬৭৮']])('%s -> tel link', (input) => {
    expect(toTelLink(input)).toBe('tel:+8801712345678');
  });

  it('supports landlines by default', () => {
    expect(toTelLink('02-22334455')).toBe('tel:+880222334455');
  });

  it('returns null for short codes and invalid input', () => {
    expect(toTelLink('999')).toBeNull();
    expect(toTelLink('abc')).toBeNull();
    expect(toTelLink(42)).toBeNull();
  });

  it('lets callers narrow the categories', () => {
    expect(toTelLink('02-22334455', { allow: ['mobile'] })).toBeNull();
  });
});

describe('toSmsLink', () => {
  it.each([['01712345678'], ['+880 1712-345678'], ['০১৭১২৩৪৫৬৭৮'], ['1712345678']])('%s -> sms URI', (input) => {
    expect(toSmsLink(input)).toBe('sms:+8801712345678');
  });

  it('url-encodes the body as UTF-8', () => {
    expect(toSmsLink('01712345678', 'Your OTP is 1234 & valid 5 min')).toBe(
      'sms:+8801712345678?body=Your%20OTP%20is%201234%20%26%20valid%205%20min',
    );
    const link = toSmsLink('01712345678', 'ধন্যবাদ') as string;
    expect(decodeURIComponent(link.split('?body=')[1])).toBe('ধন্যবাদ');
    expect(link).not.toMatch(/[^\x20-\x7e]/);
  });

  it('omits the query for missing or empty body', () => {
    expect(toSmsLink('01712345678', '')).toBe('sms:+8801712345678');
  });

  it('returns null for invalid numbers and landlines by default', () => {
    expect(toSmsLink('12345')).toBeNull();
    expect(toSmsLink('02-22334455')).toBeNull();
    expect(toSmsLink('02-22334455', undefined, { allow: ['landline'] })).toBe('sms:+880222334455');
  });
});
