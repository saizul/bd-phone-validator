import { dedupeKey, validateBulk } from './bulk';
import { parseCsv, stringifyCsv } from './csv';
import { findNumbers } from './find';
import { formatInfo } from './format';
import { mask } from './mask';
import type { FormatStyle, NumberCategory } from './types';
import { VERSION } from './version';

/** I/O surface used by the CLI, injectable for tests. */
export interface CliIo {
  readFile(path: string): string;
  readStdin(): string;
  writeFile(path: string, data: string): void;
  stdout(text: string): void;
  stderr(text: string): void;
}

const HELP = `bd-phone - clean and validate Bangladeshi phone numbers

Usage:
  bd-phone [options] [file]        read CSV or one-number-per-line text (stdin if no file)
  bd-phone --extract [options] [file]   find numbers anywhere in free text

Options:
  -c, --column <name|index>   column holding the numbers (CSV). Auto-detected by header name
  -f, --format <style>        e164 (default), local, national, international, msisdn
  -o, --output <file>         write to a file instead of stdout
      --dedupe                drop duplicate numbers (first one wins)
      --only-valid            drop invalid rows
      --allow <list>          comma list of mobile,landline,shortcode (default: mobile)
      --mask                  mask numbers in the output
      --json                  output a JSON array of objects instead of CSV
      --extract               treat the input as free text and list every number found in it
                              (columns: line, column, match, phone_clean, phone_category, phone_operator)
      --no-header             CSV has no header row
      --summary               print counts to stderr
  -h, --help                  show help
  -v, --version               show version

Adds columns: phone_clean, phone_valid, phone_category, phone_operator, phone_error
`;

const FORMATS: readonly FormatStyle[] = ['e164', 'local', 'national', 'international', 'msisdn'];
const CATEGORIES: readonly NumberCategory[] = ['mobile', 'landline', 'shortcode'];
const HEADER_HINT = /phone|mobile|msisdn|number|contact|cell|tel|ফোন|মোবাইল/i;
/** Columns appended to every output row. */
export const OUTPUT_COLUMNS = ['phone_clean', 'phone_valid', 'phone_category', 'phone_operator', 'phone_error'] as const;
/** Columns written by `--extract`. */
export const EXTRACT_COLUMNS = ['line', 'column', 'match', 'phone_clean', 'phone_category', 'phone_operator'] as const;

interface Args {
  file?: string;
  column?: string;
  format: FormatStyle;
  output?: string;
  dedupe: boolean;
  onlyValid: boolean;
  allow: NumberCategory[];
  mask: boolean;
  json: boolean;
  extract: boolean;
  header: boolean;
  summary: boolean;
  help: boolean;
  version: boolean;
}

class UsageError extends Error {}

function parseArgs(argv: readonly string[]): Args {
  const a: Args = {
    format: 'e164',
    dedupe: false,
    onlyValid: false,
    allow: ['mobile'],
    mask: false,
    json: false,
    extract: false,
    header: true,
    summary: false,
    help: false,
    version: false,
  };
  const need = (i: number, flag: string): string => {
    const v = argv[i + 1];
    if (v === undefined) throw new UsageError(`${flag} needs a value`);
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    switch (arg) {
      case '-h':
      case '--help':
        a.help = true;
        break;
      case '-v':
      case '--version':
        a.version = true;
        break;
      case '-c':
      case '--column':
        a.column = need(i++, arg);
        break;
      case '-f':
      case '--format': {
        const v = need(i++, arg) as FormatStyle;
        if (!FORMATS.includes(v)) throw new UsageError(`unknown format "${v}" (use ${FORMATS.join(', ')})`);
        a.format = v;
        break;
      }
      case '-o':
      case '--output':
        a.output = need(i++, arg);
        break;
      case '--dedupe':
        a.dedupe = true;
        break;
      case '--only-valid':
        a.onlyValid = true;
        break;
      case '--mask':
        a.mask = true;
        break;
      case '--json':
        a.json = true;
        break;
      case '--extract':
        a.extract = true;
        break;
      case '--no-header':
        a.header = false;
        break;
      case '--summary':
        a.summary = true;
        break;
      case '--allow': {
        const list = need(i++, arg).split(',').map((s) => s.trim()) as NumberCategory[];
        for (const c of list) {
          if (!CATEGORIES.includes(c)) throw new UsageError(`unknown category "${c}"`);
        }
        a.allow = list;
        break;
      }
      default:
        if (arg.startsWith('-') && arg !== '-') throw new UsageError(`unknown option ${arg}`);
        if (a.file !== undefined) throw new UsageError('only one input file is supported');
        a.file = arg;
    }
  }
  if (a.extract && a.column !== undefined) throw new UsageError('--column cannot be used with --extract');
  return a;
}

function pickColumn(header: readonly string[] | undefined, width: number, wanted?: string): number {
  if (wanted !== undefined) {
    if (/^\d+$/.test(wanted)) {
      const idx = Number(wanted);
      if (idx >= width) throw new UsageError(`column index ${idx} is out of range`);
      return idx;
    }
    const idx = (header ?? []).findIndex((h) => h.trim().toLowerCase() === wanted.toLowerCase());
    if (idx < 0) throw new UsageError(`column "${wanted}" not found`);
    return idx;
  }
  if (header) {
    const idx = header.findIndex((h) => HEADER_HINT.test(h));
    if (idx >= 0) return idx;
  }
  return 0;
}

/** `--extract`: list every number found in free text, one output row per match. */
function runExtract(text: string, args: Args): { output: string; summary: string } {
  const matches = findNumbers(text, { allow: args.allow });
  const seen = new Set<string>();
  const rows: string[][] = [[...EXTRACT_COLUMNS]];
  const objects: Record<string, string | number | null>[] = [];
  for (const m of matches) {
    const key = dedupeKey(m.info);
    const repeated = seen.has(key);
    seen.add(key);
    if (repeated && args.dedupe) continue;
    let clean = formatInfo(m.info, args.format) ?? m.info.local ?? '';
    let raw = m.raw;
    if (args.mask) {
      clean = mask(clean, { allow: args.allow, style: args.format });
      raw = mask(raw, { allow: args.allow });
    }
    if (args.json) {
      objects.push({
        line: m.line,
        column: m.column,
        match: raw,
        phone_clean: clean,
        phone_category: m.info.category ?? null,
        phone_operator: m.info.operator?.id ?? null,
      });
    } else {
      rows.push([String(m.line), String(m.column), raw, clean, m.info.category ?? '', m.info.operator?.id ?? '']);
    }
  }
  return {
    output: args.json ? `${JSON.stringify(objects, null, 2)}\n` : stringifyCsv(rows),
    summary: `found=${matches.length} unique=${seen.size} duplicates=${matches.length - seen.size}\n`,
  };
}

/**
 * Run the CLI. Returns the process exit code: `0` on success, `2` for usage or
 * input errors. Invalid numbers do not cause a non-zero exit.
 */
export function runCli(argv: readonly string[], io: CliIo): number {
  let args: Args;
  try {
    args = parseArgs(argv);
  } catch (e) {
    io.stderr(`bd-phone: ${(e as Error).message}\n\n${HELP}`);
    return 2;
  }
  if (args.help) {
    io.stdout(HELP);
    return 0;
  }
  if (args.version) {
    io.stdout(`${VERSION}\n`);
    return 0;
  }

  let text: string;
  try {
    text = args.file && args.file !== '-' ? io.readFile(args.file) : io.readStdin();
  } catch (e) {
    io.stderr(`bd-phone: cannot read input: ${(e as Error).message}\n`);
    return 2;
  }

  if (args.extract) {
    const { output, summary } = runExtract(text, args);
    try {
      if (args.output) io.writeFile(args.output, output);
      else io.stdout(output);
    } catch (e) {
      io.stderr(`bd-phone: cannot write output: ${(e as Error).message}\n`);
      return 2;
    }
    if (args.summary) io.stderr(summary);
    return 0;
  }

  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const isCsv = /\.csv$/i.test(args.file ?? '') || firstLine.includes(',');
  let rows = parseCsv(text);
  rows = rows.filter((r) => !(r.length === 1 && r[0] === ''));

  let header: string[] | undefined;
  if (isCsv && args.header && rows.length > 0) header = rows.shift();
  const width = Math.max(header?.length ?? 0, ...rows.map((r) => r.length), 1);

  let col: number;
  try {
    col = isCsv ? pickColumn(header, width, args.column) : 0;
  } catch (e) {
    io.stderr(`bd-phone: ${(e as Error).message}\n`);
    return 2;
  }

  const values = rows.map((r) => r[col] ?? '');
  const result = validateBulk(values, { allow: args.allow, dedupe: args.dedupe });

  const out: string[][] = [];
  const objects: Record<string, string | boolean | null>[] = [];
  const baseHeader = isCsv ? (header ?? null) : ['input'];
  if (baseHeader) out.push([...baseHeader, ...OUTPUT_COLUMNS]);
  result.entries.forEach((entry, i) => {
    if (entry.duplicateOf !== undefined) return; // dedupe was requested
    if (args.onlyValid && !entry.info.valid) return;
    const info = entry.info;
    let clean = '';
    if (info.valid) {
      clean = formatInfo(info, args.format) ?? info.local ?? '';
      if (args.mask) clean = mask(clean, { allow: args.allow, style: args.format });
    }
    const original = [...(rows[i] ?? [])];
    if (!isCsv) original[0] = args.mask ? mask(original[0] ?? '', { allow: args.allow }) : (original[0] ?? '');
    else if (args.mask) original[col] = mask(original[col] ?? '', { allow: args.allow });
    if (args.json) {
      const base: Record<string, string> = {};
      if (isCsv && header) header.forEach((h, k) => (base[h] = original[k] ?? ''));
      else original.forEach((v, k) => (base[isCsv ? `column${k + 1}` : 'input'] = v));
      objects.push({
        ...base,
        phone_clean: clean || null,
        phone_valid: info.valid,
        phone_category: info.category ?? null,
        phone_operator: info.operator?.id ?? null,
        phone_error: info.error?.code ?? null,
      });
      return;
    }
    out.push([
      ...original,
      clean,
      info.valid ? 'true' : 'false',
      info.category ?? '',
      info.operator?.id ?? '',
      info.error?.code ?? '',
    ]);
  });

  const csv = args.json ? `${JSON.stringify(objects, null, 2)}\n` : stringifyCsv(out);
  try {
    if (args.output) io.writeFile(args.output, csv);
    else io.stdout(csv);
  } catch (e) {
    io.stderr(`bd-phone: cannot write output: ${(e as Error).message}\n`);
    return 2;
  }
  if (args.summary) {
    const s = result.stats;
    io.stderr(
      `total=${s.total} valid=${s.valid} invalid=${s.invalid} duplicates=${s.duplicates} unique=${s.unique}\n`,
    );
  }
  return 0;
}
