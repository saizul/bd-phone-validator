import { formatInfo } from './format';
import { parse } from './parse';
import type { FormatStyle, ParseOptions, PhoneError } from './types';

/** Options for {@link phoneSchema}. */
export interface PhoneSchemaOptions extends ParseOptions {
  /** Reject empty input. When false, empty input is accepted and returned as `''`. @defaultValue true */
  required?: boolean;
  /** Form of the value returned by `parse`. @defaultValue `'e164'` */
  output?: FormatStyle;
  /** Custom error message, or a function receiving the underlying error. */
  message?: string | ((error: PhoneError) => string);
}

/** Error thrown by {@link PhoneSchema.parse}. */
export class PhoneValidationError extends Error {
  readonly code: PhoneError['code'];
  constructor(error: PhoneError) {
    super(error.message);
    this.name = 'PhoneValidationError';
    this.code = error.code;
  }
}

/** Result of `safeParse`, shaped like the common schema libraries. */
export type SafeParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: PhoneValidationError };

/** Minimal subset of the Standard Schema v1 contract (https://standardschema.dev). */
export interface StandardSchemaProps {
  readonly version: 1;
  readonly vendor: string;
  readonly validate: (
    value: unknown,
  ) => { readonly value: string } | { readonly issues: ReadonlyArray<{ readonly message: string }> };
}

/** A tiny validator object that plugs into form libraries. */
export interface PhoneSchema {
  /** Return the normalized value or throw {@link PhoneValidationError}. */
  parse(value: unknown): string;
  /** Like `parse` but returns a result object instead of throwing. */
  safeParse(value: unknown): SafeParseResult<string>;
  /** `true` or an error message. Matches react-hook-form's `validate` option. */
  validate(value: unknown): true | string;
  /** Error message or `undefined`. Matches Formik's field level `validate`. */
  check(value: unknown): string | undefined;
  /** Standard Schema entry point, so the object works anywhere that contract is accepted. */
  readonly '~standard': StandardSchemaProps;
}

/**
 * Build a validator object for forms.
 *
 * @example
 * const phone = phoneSchema({ locale: 'bn' });
 * phone.safeParse('০১৭১২৩৪৫৬৭৮'); // { success: true, data: '+8801712345678' }
 */
export function phoneSchema(options: PhoneSchemaOptions = {}): PhoneSchema {
  const required = options.required ?? true;
  const output = options.output ?? 'e164';

  const run = (value: unknown): SafeParseResult<string> => {
    const isBlank = value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
    if (isBlank && !required) return { success: true, data: '' };
    const info = parse(value === undefined || value === null ? '' : value, options);
    if (info.valid) {
      const data = formatInfo(info, output) ?? info.local ?? info.digits;
      return { success: true, data };
    }
    const base = info.error as PhoneError;
    const message =
      typeof options.message === 'function' ? options.message(base) : (options.message ?? base.message);
    return { success: false, error: new PhoneValidationError({ code: base.code, message }) };
  };

  return {
    parse(value) {
      const r = run(value);
      if (!r.success) throw r.error;
      return r.data;
    },
    safeParse: run,
    validate(value) {
      const r = run(value);
      return r.success ? true : r.error.message;
    },
    check(value) {
      const r = run(value);
      return r.success ? undefined : r.error.message;
    },
    '~standard': {
      version: 1,
      vendor: 'bd-phone-validator',
      validate(value) {
        const r = run(value);
        return r.success ? { value: r.data } : { issues: [{ message: r.error.message }] };
      },
    },
  };
}

/** react-hook-form: `register('phone', rhfRule())` */
export function rhfRule(options: PhoneSchemaOptions = {}): { validate: (value: unknown) => true | string } {
  const schema = phoneSchema(options);
  return { validate: (value) => schema.validate(value) };
}

/** Ant Design / async-validator style rule: `rules={[antdRule()]}` */
export function antdRule(options: PhoneSchemaOptions = {}): {
  validator: (rule: unknown, value: unknown) => Promise<void>;
} {
  const schema = phoneSchema(options);
  return {
    validator: (_rule, value) => {
      const message = schema.check(value);
      return message === undefined ? Promise.resolve() : Promise.reject(new Error(message));
    },
  };
}

/** Yup: `string().test(yupTest())` */
export function yupTest(options: PhoneSchemaOptions = {}): {
  name: string;
  message: string;
  test: (value: unknown) => boolean;
} {
  const schema = phoneSchema(options);
  const message =
    typeof options.message === 'string' ? options.message : parse('', { locale: options.locale }).error?.message ?? 'Invalid phone number';
  return { name: 'bd-phone', message, test: (value) => schema.check(value) === undefined };
}

/**
 * Value for an `<input pattern>` attribute. Matches English-digit local and
 * international mobile numbers without separators.
 */
export const MOBILE_INPUT_PATTERN = '(?:(?:\\+|00)?880|0)1[3-9][0-9]{8}';
