# bd-phone-validator

[![CI](https://github.com/saizul/bd-phone-validator/actions/workflows/ci.yml/badge.svg)](https://github.com/saizul/bd-phone-validator/actions/workflows/ci.yml) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white) ![License: MIT](https://img.shields.io/badge/License-MIT-green.svg) ![Zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)

Validate, normalize, format and mask **Bangladeshi phone numbers**. Detects the mobile operator, tells mobile, landline and hotline numbers apart, understands Bangla digits, cleans whole CSV files, and plugs into form libraries. TypeScript, ESM + CommonJS, **zero runtime dependencies**.

Built by [Saizul Amin](https://saizul.com). MIT licensed.

```ts
import { parse, isValid, normalize, getOperator, format } from 'bd-phone-validator';

isValid('01712-345678');            // true
normalize('+880 1712 345678');      // '+8801712345678'
normalize('০১৭১২৩৪৫৬৭৮', 'local');   // '01712345678'
getOperator('01912345678')?.name;   // 'Banglalink'
format('8801712345678');            // '01712-345678'
```

## Install

```bash
npm install bd-phone-validator
```


## Install from GitHub Packages

Releases are also published to [GitHub Packages](https://github.com/saizul/bd-phone-validator/pkgs/npm/bd-phone-validator) as `@saizul/bd-phone-validator`:

```bash
echo "@saizul:registry=https://npm.pkg.github.com" >> .npmrc
npm install @saizul/bd-phone-validator
```

GitHub Packages needs a personal access token with `read:packages` in your `~/.npmrc` (`//npm.pkg.github.com/:_authToken=YOUR_TOKEN`).

## What it accepts

All of these are the same number:

```
01712345678      +8801712345678     8801712345678     008801712345678
01712-345678     01712 345678       +880 1712-345678  +880 (1712) 345678
+88001712345678  1712345678 (leading zero lost, e.g. from a spreadsheet)
০১৭১২৩৪৫৬৭৮     +৮৮০১৭১২৩৪৫৬৭৮    tel:+8801712345678
```

## API

### `parse(input, options?) -> PhoneInfo`

Never throws. Returns everything in one object:

```ts
parse('+880 1612-345678');
// {
//   valid: true,
//   input: '+880 1612-345678',
//   digits: '01612345678',
//   category: 'mobile',
//   local: '01612345678',
//   e164: '+8801612345678',
//   operator: { id: 'robi', name: 'Robi', nameBn: 'রবি', prefix: '016', formerName: 'Airtel' },
//   warnings: []
// }

parse('01012345678').error; // { code: 'invalid_operator_prefix', message: 'Unknown mobile operator prefix.' }
```

Options: `allow` (categories counted as valid, default `['mobile']`), `allowMissingLeadingZero` (default `true`), `locale` (`'en' | 'bn'` for messages).

### `isValid`, `normalize`, `getOperator`, `getCategory`

```ts
isValid('01712345678');                 // true
isValid('0222334455');                  // false (landline, not allowed by default)
isValid('0222334455', { allow: ['mobile', 'landline'] }); // true

normalize('01712-345678');              // '+8801712345678'  (E.164, default)
normalize('+8801712345678', 'local');   // '01712345678'
normalize('garbage');                   // null

getOperator('01812345678')?.id;         // 'robi'
getCategory('16263');                   // 'shortcode'
```

### `format(input, style?)`

| style | result |
| --- | --- |
| `national` (default) | `01712-345678` |
| `local` | `01712345678` |
| `international` | `+880 1712-345678` |
| `e164` | `+8801712345678` |
| `msisdn` | `8801712345678` (SMS gateways) |

Returns `null` for invalid input.

### Operators

| Prefix | Operator |
| --- | --- |
| 013, 017 | Grameenphone |
| 014, 019 | Banglalink |
| 015 | Teletalk |
| 016 | Robi (formerly Airtel) |
| 018 | Robi |

> Because of mobile number portability a prefix only tells you the operator the number was **originally issued by**. Treat `getOperator` as a good hint, not a guarantee.

### Landlines and short codes

Separate categories, rejected unless you opt in:

```ts
parse('02-2233 4455', { allow: ['landline'] }).areaCode; // '02'  (Dhaka)
parse('16263', { allow: ['shortcode'] }).category;       // 'shortcode'
```

Landline detection recognizes the main city area codes (Dhaka 02, Chattogram 031, Khulna 041, Bogura 051, Cumilla 081, Mymensingh 091, Barishal 0431, Rangpur 0521, Rajshahi 0721, Sylhet 0821); others report `unknown_area_code`. Short codes cover `999`, `333`, `109`, `106`, `199`, `112` and five-digit `16xxx` hotlines. These have no E.164 form.

> **Note:** the landline area-code and short-code lists are a best-effort subset and are not taken from the official BTRC numbering plan. Mobile validation is the primary, well-tested feature; verify landline/short-code results for your use case, and PRs with corrections are welcome.

### Error codes

`not_a_string`, `empty`, `invalid_characters`, `too_short`, `too_long`, `invalid_country_code`, `invalid_operator_prefix`, `unknown_area_code`, `invalid_format`, `category_not_allowed`. Messages come in English and Bangla (`{ locale: 'bn' }`). `warnings` lists silent fixes: `bangla_digits`, `missing_leading_zero`, `extra_trunk_zero`, `international_prefix`.

### Digits

```ts
import { toEnglishDigits, toBanglaDigits } from 'bd-phone-validator';
toEnglishDigits('০১৭১২৩৪৫৬৭৮'); // '01712345678'
toBanglaDigits('01712345678');   // '০১৭১২৩৪৫৬৭৮'
```

### Links: WhatsApp and `tel:`

```ts
import { toWhatsAppLink, toTelLink } from 'bd-phone-validator';
toWhatsAppLink('01712-345678');                     // 'https://wa.me/8801712345678'
toWhatsAppLink('০১৭১২৩৪৫৬৭৮', 'Hi, is this available?');
// 'https://wa.me/8801712345678?text=Hi%2C%20is%20this%20available%3F'
toTelLink('01712345678');                           // 'tel:+8801712345678'
toTelLink('02-22334455');                           // 'tel:+880222334455' (landlines work)
toTelLink('999');                                   // null (short codes have no international form)
toWhatsAppLink('12345');                            // null (invalid)
```

Both accept any input form that `parse` accepts and return `null` for invalid numbers. `toWhatsAppLink` uses the digits-only form WhatsApp requires and URL-encodes the optional message; it accepts mobile numbers only by default. `toTelLink` accepts mobile numbers and landlines. Pass `{ allow: [...] }` as the last argument to change that.

### Formatting while typing

`formatAsYouType(value, options?)` formats a partially typed number for display inside an
input field. It is stateless (pass the whole field value on every keystroke), never throws and
accepts every form `parse` accepts.

```ts
import { formatAsYouType, AsYouType } from 'bd-phone-validator';

formatAsYouType('017123').formatted;        // '01712-3'
formatAsYouType('+88017123').formatted;     // '+880 1712-3'
formatAsYouType('০১৭১২৩').formatted;        // '০১৭১২-৩' (Bangla digits are kept)
formatAsYouType('0191').operator?.name;     // 'Banglalink', as soon as the prefix is typed
formatAsYouType('0171234');
// { formatted: '01712-34', national: '0171234', category: 'mobile', operator: {...},
//   complete: false, possible: true, remaining: 4 }
formatAsYouType('012').possible;            // false: no operator uses 012
```

| Field | Meaning |
| --- | --- |
| `formatted` | display string (`01712-34`, `+880 1712-34`, `02-22`) |
| `national` | English digits so far with the trunk zero |
| `category`, `operator`, `areaCode` | filled in as soon as they are known |
| `complete` | the digits form a valid number; `e164` is then set |
| `possible` | `false` when more typing cannot make it valid (unknown prefix, too long, letters) |
| `remaining` | digits still missing for a mobile number |
| `cursor` | caret position in `formatted`, when `options.cursor` is passed |

Options: `style` (`auto` follows the input, `national`, `international`), `digits` (`auto`,
`en`, `bn`), `allowMissingLeadingZero` (default `true`; `1712...` becomes `01712-...` once it
can no longer be a hotline such as `16263`) and `cursor`.

Keeping the caret in place in a plain input:

```ts
input.addEventListener('input', () => {
  const r = formatAsYouType(input.value, { cursor: input.selectionStart ?? input.value.length });
  input.value = r.formatted;
  input.setSelectionRange(r.cursor!, r.cursor!);
  input.setCustomValidity(r.possible ? '' : 'Not a Bangladeshi number');
});
```

`AsYouType` is a stateful wrapper for key-by-key handling:

```ts
const typer = new AsYouType();
typer.input('0171'); // '0171'
typer.input('23');   // '01712-3'
typer.backspace();   // '01712'
typer.result.operator?.name; // 'Grameenphone'
```

### Masking and redaction

```ts
import { mask, redact } from 'bd-phone-validator';
mask('+8801712345678');                              // '017******78'
mask('01712345678', { keepStart: 5, keepEnd: 0 });   // '01712******'
redact('Call 01712-345678 about order 123456');      // 'Call 017******78 about order 123456'
redact('Call 01712345678', { replacement: '[phone]' });
```

### Finding numbers in free text

```ts
import { findNumbers, extractNumbers } from 'bd-phone-validator';

const text = 'Rahim 01712-345678, office +880 1812 345678.\nOrder 20240117, bKash ০১৯১২৩৪৫৬৭৮';

extractNumbers(text);                     // ['+8801712345678', '+8801812345678', '+8801912345678']
extractNumbers(text, { style: 'local' }); // ['01712345678', '01812345678', '01912345678']

findNumbers(text)[1];
// { start: 27, end: 43, line: 1, column: 28, raw: '+880 1812 345678', info: { valid: true, e164: '+8801812345678', ... } }
```

`findNumbers` returns one `PhoneMatch` per number, in order, with `text.slice(start, end) === raw`. Dates, amounts and order ids are skipped because every candidate has to pass `parse`. Differences from `parse` defaults, chosen to keep false positives low in prose:

- mobile numbers only; pass `{ allow: ['mobile', 'landline', 'shortcode'] }` to widen it (short codes such as `999` match a lot of ordinary numbers),
- a lost leading zero (`1712345678`) is **not** accepted unless you pass `{ allowMissingLeadingZero: true }`,
- a number never spans a line break.

`extractNumbers` de-duplicates by default (`{ unique: false }` keeps repeats) and takes any `format` style; `{ limit: n }` stops after `n` matches.

### Bulk validation

```ts
import { validateBulk, cleanList } from 'bd-phone-validator';

const r = validateBulk(['01712345678', '+8801712345678', 'oops', '01912345678']);
r.stats;   // { total: 4, valid: 3, invalid: 1, duplicates: 1, unique: 2, byOperator: {...}, ... }
r.unique;  // PhoneInfo[] (first occurrence of each valid number)
r.invalid; // entries with the reason for each failure

cleanList(rawColumn);          // ['+8801712345678', '+8801912345678']
cleanList(rawColumn, 'local'); // ['01712345678', '01912345678']
```

### Forms

`phoneSchema()` returns a tiny validator that works without any schema library, and also exposes the [Standard Schema](https://standardschema.dev) contract (`~standard`) so libraries that support it can use it directly.

```ts
import { phoneSchema, rhfRule, antdRule, yupTest } from 'bd-phone-validator';

const phone = phoneSchema({ locale: 'bn', required: true });
phone.parse('০১৭১২৩৪৫৬৭৮');          // '+8801712345678' (throws PhoneValidationError otherwise)
phone.safeParse('x');                 // { success: false, error }
phone.validate('01712345678');        // true | 'message'

// react-hook-form
register('phone', rhfRule());                 // { validate: v => true | message }
// Ant Design
<Form.Item name="phone" rules={[antdRule()]} />
// Yup
string().test(yupTest());
// Formik field level validate
validate={phone.check}                        // message | undefined
// Plain HTML
<input pattern={MOBILE_INPUT_PATTERN} />
```

### Command line

```bash
npx bd-phone contacts.csv -o clean.csv --dedupe --only-valid
cat numbers.txt | npx bd-phone -f local --summary
```

Pull numbers out of free text (a chat export, an email, a saved web page) with `--extract`:

```bash
npx bd-phone --extract chat.txt --dedupe -f local
# line,column,match,phone_clean,phone_category,phone_operator
# 3,14,01712-345678,01712345678,mobile,grameenphone
# 9,1,+880 1812 345678,01812345678,mobile,robi
```

The CSV phone column is detected from the header (phone, mobile, msisdn, number...) or set with `-c name|index`. Five columns are appended: `phone_clean`, `phone_valid`, `phone_category`, `phone_operator`, `phone_error`.

| Flag | Meaning |
| --- | --- |
| `-c, --column` | column name or index |
| `-f, --format` | `e164` (default), `local`, `national`, `international`, `msisdn` |
| `-o, --output` | output file (default stdout) |
| `--dedupe` | keep only the first of each number |
| `--only-valid` | drop invalid rows |
| `--allow` | e.g. `mobile,landline` |
| `--mask` | mask numbers in the output |
| `--json` | output a JSON array of objects (input columns plus `phone_*` fields) |
| `--extract` | free-text mode: one row per number found, with `line`, `column` and the raw `match` |
| `--no-header` | CSV without header row |
| `--summary` | print counts to stderr |

## বাংলায় সংক্ষেপে

বাংলাদেশের মোবাইল নম্বর যাচাই, স্ট্যান্ডার্ড ফরম্যাটে রূপান্তর এবং অপারেটর শনাক্ত করার লাইব্রেরি। বাংলা অঙ্ক (০১৭১২৩৪৫৬৭৮), `+৮৮০`, ড্যাশ ও স্পেস সহ যেকোনো ফরম্যাট বোঝে।

```ts
import { isValid, normalize, getOperator, toBanglaDigits } from 'bd-phone-validator';

isValid('০১৭১২-৩৪৫৬৭৮');            // true
normalize('০১৭১২৩৪৫৬৭৮');          // '+8801712345678'
getOperator('01912345678')?.nameBn;  // 'বাংলালিংক'
toBanglaDigits('01712345678');       // '০১৭১২৩৪৫৬৭৮'
phoneSchema({ locale: 'bn' }).validate('');  // 'ফোন নম্বর দিন।'
```

অপারেটর কোড: ০১৩/০১৭ গ্রামীণফোন, ০১৪/০১৯ বাংলালিংক, ০১৫ টেলিটক, ০১৬/০১৮ রবি। নম্বর পোর্টেবিলিটির কারণে কোড দেখে অপারেটর শনাক্তকরণ ১০০% নিশ্চিত নয়।

## Development

```bash
npm install
npm run check   # eslint + tsc + vitest (unit and property-based tests)
npm run build   # ESM, CJS, d.ts and the CLI into dist/
```

See [CONTRIBUTING.md](CONTRIBUTING.md) and [CHANGELOG.md](CHANGELOG.md). All example numbers are synthetic. Licensed under the [MIT License](LICENSE).
