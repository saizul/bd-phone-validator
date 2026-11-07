const BANGLA_ZERO = 0x09e6;

/**
 * Convert Bangla digits (০-৯) to English digits (0-9). Other characters are untouched.
 *
 * @example
 * toEnglishDigits('০১৭১২-৩৪৫৬৭৮'); // '01712-345678'
 */
export function toEnglishDigits(input: string): string {
  let out = '';
  for (const ch of input) {
    const code = ch.codePointAt(0) as number;
    out += code >= BANGLA_ZERO && code <= BANGLA_ZERO + 9 ? String(code - BANGLA_ZERO) : ch;
  }
  return out;
}

/**
 * Convert English digits (0-9) to Bangla digits (০-৯). Other characters are untouched.
 *
 * @example
 * toBanglaDigits('01712345678'); // '০১৭১২৩৪৫৬৭৮'
 */
export function toBanglaDigits(input: string): string {
  return input.replace(/[0-9]/g, (d) => String.fromCodePoint(BANGLA_ZERO + Number(d)));
}

/** True when the string contains at least one Bangla digit. */
export function hasBanglaDigits(input: string): boolean {
  return /[০-৯]/.test(input);
}
