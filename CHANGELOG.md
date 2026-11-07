# Changelog

All notable changes are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-03-30

### Added
- `parse`, `isValid`, `normalize`, `getOperator`, `getCategory` and `format` for Bangladeshi numbers.
- Input tolerance: local, `+880`, `880`, `00880`, separators, Bangla digits, lost leading zero, extra trunk zero.
- Operator detection by prefix (Grameenphone, Banglalink, Robi including the former Airtel `016`, Teletalk).
- Separate `landline` (city area codes) and `shortcode` (`999`, `16xxx` hotlines and friends) categories.
- Detailed machine-readable error codes with English and Bangla messages, plus warnings for silent fixes.
- `toEnglishDigits` and `toBanglaDigits`.
- `mask` and `redact` helpers.
- Bulk validation with de-duplication and statistics (`validateBulk`, `cleanList`).
- Form helpers: `phoneSchema` (Standard Schema compatible), `rhfRule`, `antdRule`, `yupTest`, `MOBILE_INPUT_PATTERN`.
- `bd-phone` command line tool that cleans CSV or plain text files.
- ESM and CommonJS builds with TypeScript declarations. No runtime dependencies.
