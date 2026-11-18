import { format } from './format';
import type { NumberCategory, ParseOptions } from './types';

/** Options for the link helpers; the same as the parsing options. */
export type LinkOptions = ParseOptions;

/**
 * Build a click-to-chat link (`https://wa.me/<number>`) for a Bangladeshi mobile number.
 *
 * Accepts every input form `parse` accepts (local, `+880`, Bangla digits, separators). The
 * optional `text` is URL-encoded into the `text` query parameter and pre-fills the message.
 * Returns `null` when the number is invalid; only mobile numbers are accepted unless
 * `options.allow` says otherwise.
 *
 * @example
 * toWhatsAppLink('01712-345678'); // 'https://wa.me/8801712345678'
 * toWhatsAppLink('01712345678', 'Hi, is this available?');
 * // 'https://wa.me/8801712345678?text=Hi%2C%20is%20this%20available%3F'
 */
export function toWhatsAppLink(input: unknown, text?: string, options: LinkOptions = {}): string | null {
  const msisdn = format(input, 'msisdn', options);
  if (msisdn === null) return null;
  const base = `https://wa.me/${msisdn}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

const TEL_CATEGORIES: readonly NumberCategory[] = ['mobile', 'landline'];

/**
 * Build a `tel:` URI in E.164 form (`tel:+8801712345678`) that dials correctly from anywhere.
 *
 * Mobile numbers and landlines are accepted by default (short codes such as `999` have no
 * international form and give `null`). Returns `null` for invalid input.
 *
 * @example
 * toTelLink('০১৭১২৩৪৫৬৭৮'); // 'tel:+8801712345678'
 * toTelLink('02-22334455'); // 'tel:+880222334455'
 */
export function toTelLink(input: unknown, options: LinkOptions = {}): string | null {
  const e164 = format(input, 'e164', { allow: TEL_CATEGORIES, ...options });
  return e164 === null ? null : `tel:${e164}`;
}

/**
 * Build an `sms:` URI (RFC 5724) in E.164 form that opens the messaging app, optionally with a
 * pre-filled message body (`sms:+8801712345678?body=...`).
 *
 * Mobile numbers are accepted by default; returns `null` for invalid input. The body is
 * URL-encoded as UTF-8, so Bangla text is safe.
 *
 * @example
 * toSmsLink('01712345678');                    // 'sms:+8801712345678'
 * toSmsLink('01712345678', 'Your OTP is 1234'); // 'sms:+8801712345678?body=Your%20OTP%20is%201234'
 */
export function toSmsLink(input: unknown, body?: string, options: LinkOptions = {}): string | null {
  const e164 = format(input, 'e164', options);
  if (e164 === null) return null;
  const base = `sms:${e164}`;
  return body ? `${base}?body=${encodeURIComponent(body)}` : base;
}
