import type { ErrorCode, Locale } from './types';

/** Error messages by locale. */
export const MESSAGES: Readonly<Record<Locale, Readonly<Record<ErrorCode, string>>>> = Object.freeze({
  en: {
    not_a_string: 'Phone number must be a string.',
    empty: 'Phone number is required.',
    invalid_characters: 'Phone number contains invalid characters.',
    too_short: 'Phone number is too short.',
    too_long: 'Phone number is too long.',
    invalid_country_code: 'Only Bangladeshi numbers (+880) are supported.',
    invalid_operator_prefix: 'Unknown mobile operator prefix.',
    unknown_area_code: 'Unknown landline area code.',
    invalid_format: 'Not a valid Bangladeshi phone number.',
    category_not_allowed: 'This type of number is not accepted.',
  },
  bn: {
    not_a_string: 'ফোন নম্বর অবশ্যই টেক্সট হতে হবে।',
    empty: 'ফোন নম্বর দিন।',
    invalid_characters: 'ফোন নম্বরে অবৈধ অক্ষর আছে।',
    too_short: 'ফোন নম্বরটি খুব ছোট।',
    too_long: 'ফোন নম্বরটি খুব বড়।',
    invalid_country_code: 'শুধু বাংলাদেশি (+৮৮০) নম্বর গ্রহণযোগ্য।',
    invalid_operator_prefix: 'অপারেটর কোড চেনা যায়নি।',
    unknown_area_code: 'ল্যান্ডলাইনের এরিয়া কোড চেনা যায়নি।',
    invalid_format: 'সঠিক বাংলাদেশি ফোন নম্বর নয়।',
    category_not_allowed: 'এই ধরনের নম্বর গ্রহণযোগ্য নয়।',
  },
});

/** Message for an error code. Falls back to English. */
export function messageFor(code: ErrorCode, locale: Locale = 'en'): string {
  return (MESSAGES[locale] ?? MESSAGES.en)[code];
}
