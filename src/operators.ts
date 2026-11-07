import type { Operator, OperatorId } from './types';

const GP: Omit<Operator, 'prefix'> = { id: 'grameenphone', name: 'Grameenphone', nameBn: 'গ্রামীণফোন' };
const BL: Omit<Operator, 'prefix'> = { id: 'banglalink', name: 'Banglalink', nameBn: 'বাংলালিংক' };
const ROBI: Omit<Operator, 'prefix'> = { id: 'robi', name: 'Robi', nameBn: 'রবি' };
const TT: Omit<Operator, 'prefix'> = { id: 'teletalk', name: 'Teletalk', nameBn: 'টেলিটক' };

/** Mobile operators keyed by their three digit domestic prefix. */
export const OPERATOR_PREFIXES: Readonly<Record<string, Operator>> = Object.freeze({
  '013': { ...GP, prefix: '013' },
  '014': { ...BL, prefix: '014' },
  '015': { ...TT, prefix: '015' },
  '016': { ...ROBI, prefix: '016', formerName: 'Airtel' },
  '017': { ...GP, prefix: '017' },
  '018': { ...ROBI, prefix: '018' },
  '019': { ...BL, prefix: '019' },
});

/** All known operators, one entry per operator, with every prefix listed. */
export const OPERATORS: Readonly<Record<OperatorId, { operator: Operator; prefixes: readonly string[] }>> =
  (() => {
    const out = {} as Record<OperatorId, { operator: Operator; prefixes: string[] }>;
    for (const op of Object.values(OPERATOR_PREFIXES)) {
      const entry = out[op.id];
      if (entry) entry.prefixes.push(op.prefix);
      else out[op.id] = { operator: op, prefixes: [op.prefix] };
    }
    return out;
  })();

/** Look up an operator from a domestic prefix such as `017`. */
export function operatorForPrefix(prefix: string): Operator | undefined {
  return OPERATOR_PREFIXES[prefix];
}

/**
 * Landline area codes (with trunk zero) for the largest cities. The list is
 * intentionally small; unknown codes are reported as `unknown_area_code`.
 */
export const AREA_CODES: Readonly<Record<string, string>> = Object.freeze({
  '02': 'Dhaka',
  '031': 'Chattogram',
  '041': 'Khulna',
  '051': 'Bogura',
  '081': 'Cumilla',
  '091': 'Mymensingh',
  '0431': 'Barishal',
  '0521': 'Rangpur',
  '0721': 'Rajshahi',
  '0821': 'Sylhet',
});

/** Longest matching area code at the start of a national number, if any. */
export function findAreaCode(national: string): string | undefined {
  let best: string | undefined;
  for (const code of Object.keys(AREA_CODES)) {
    if (national.startsWith(code) && (!best || code.length > best.length)) best = code;
  }
  return best;
}

/** Well-known three digit service numbers (emergency, helplines, information). */
export const SHORT_CODES: readonly string[] = Object.freeze(['999', '333', '109', '106', '199', '112']);

/**
 * Short codes and hotlines: the well-known three digit numbers in
 * {@link SHORT_CODES} and five digit `16xxx` hotlines (for example `16263`).
 */
export const SHORT_CODE_PATTERN = /^(?:999|333|109|106|199|112|16\d{3})$/;
