/** Identifier of a Bangladeshi mobile network operator. */
export type OperatorId = 'grameenphone' | 'banglalink' | 'robi' | 'teletalk';

/** Information about a mobile operator. */
export interface Operator {
  /** Stable machine-readable id. */
  readonly id: OperatorId;
  /** Display name in English. */
  readonly name: string;
  /** Display name in Bangla. */
  readonly nameBn: string;
  /** Three digit prefix as dialled domestically, for example `017`. */
  readonly prefix: string;
  /** Previous brand name, if the prefix was inherited (for example Airtel for `016`). */
  readonly formerName?: string;
}

/** Broad class of a number. */
export type NumberCategory = 'mobile' | 'landline' | 'shortcode';

/** Machine-readable reason a number was rejected. */
export type ErrorCode =
  | 'not_a_string'
  | 'empty'
  | 'invalid_characters'
  | 'too_short'
  | 'too_long'
  | 'invalid_country_code'
  | 'invalid_operator_prefix'
  | 'unknown_area_code'
  | 'invalid_format'
  | 'category_not_allowed';

/** Non-fatal observations made while normalizing. */
export type WarningCode =
  | 'bangla_digits'
  | 'missing_leading_zero'
  | 'extra_trunk_zero'
  | 'international_prefix';

/** Why validation failed. */
export interface PhoneError {
  readonly code: ErrorCode;
  /** Human readable message in the requested locale. */
  readonly message: string;
}

/** Locale for error messages. */
export type Locale = 'en' | 'bn';

/** Output styles supported by {@link format}. */
export type FormatStyle = 'e164' | 'international' | 'national' | 'local' | 'msisdn';

/** Options shared by the parsing based APIs. */
export interface ParseOptions {
  /**
   * Categories that count as valid.
   * @defaultValue `['mobile']`
   */
  allow?: readonly NumberCategory[];
  /**
   * Accept mobile numbers whose leading zero was lost (for example `1712345678`,
   * common after a spreadsheet import).
   * @defaultValue `true`
   */
  allowMissingLeadingZero?: boolean;
  /**
   * Language of error messages.
   * @defaultValue `'en'`
   */
  locale?: Locale;
}

/** Result of parsing one input. */
export interface PhoneInfo {
  /** True when the number parsed and its category is allowed. */
  readonly valid: boolean;
  /** The untouched input. */
  readonly input: string;
  /** English digits that were found in the input (separators removed). */
  readonly digits: string;
  /** Category when the number could be classified. */
  readonly category?: NumberCategory;
  /** Local form with the trunk zero, for example `01712345678`. */
  readonly local?: string;
  /** E.164 form, for example `+8801712345678` (absent for short codes). */
  readonly e164?: string;
  /** Mobile operator by prefix (see the note about number portability in the README). */
  readonly operator?: Operator;
  /** Landline area code including the trunk zero, for example `02`. */
  readonly areaCode?: string;
  /** Present when `valid` is false. */
  readonly error?: PhoneError;
  /** Things that were silently fixed. */
  readonly warnings: readonly WarningCode[];
}
