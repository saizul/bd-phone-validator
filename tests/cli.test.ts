import { describe, expect, it } from 'vitest';
import { runCli } from '../src/cli';
import type { CliIo } from '../src/cli';
import { VERSION } from '../src/version';
import pkg from '../package.json';

function makeIo(files: Record<string, string> = {}, stdin = '') {
  const out: string[] = [];
  const err: string[] = [];
  const written: Record<string, string> = {};
  const io: CliIo = {
    readFile: (p) => {
      if (!(p in files)) throw new Error(`ENOENT: ${p}`);
      return files[p] as string;
    },
    readStdin: () => stdin,
    writeFile: (p, d) => {
      written[p] = d;
    },
    stdout: (t) => out.push(t),
    stderr: (t) => err.push(t),
  };
  return { io, out: () => out.join(''), err: () => err.join(''), written };
}

const CSV = `name,Mobile,city
Rahim,01712345678,Dhaka
Karim,"+880 1812-345678",Sylhet
Dup,8801712345678,Dhaka
Bad,12345,Khulna
Bangla,০১৯১২৩৪৫৬৭৮,Rajshahi
`;

describe('cli', () => {
  it('version matches package.json', () => {
    expect(VERSION).toBe(pkg.version);
    const t = makeIo();
    expect(runCli(['--version'], t.io)).toBe(0);
    expect(t.out()).toBe(`${pkg.version}\n`);
  });

  it('prints help', () => {
    const t = makeIo();
    expect(runCli(['--help'], t.io)).toBe(0);
    expect(t.out()).toContain('Usage:');
  });

  it('cleans a CSV, auto-detecting the phone column', () => {
    const t = makeIo({ 'in.csv': CSV });
    expect(runCli(['in.csv'], t.io)).toBe(0);
    const lines = t.out().trim().split('\n');
    expect(lines[0]).toBe('name,Mobile,city,phone_clean,phone_valid,phone_category,phone_operator,phone_error');
    expect(lines[1]).toBe('Rahim,01712345678,Dhaka,+8801712345678,true,mobile,grameenphone,');
    expect(lines[2]).toBe('Karim,+880 1812-345678,Sylhet,+8801812345678,true,mobile,robi,');
    expect(lines[3]).toContain('+8801712345678,true');
    expect(lines[4]).toBe('Bad,12345,Khulna,,false,,,too_short');
    expect(lines[5]).toContain('+8801912345678,true,mobile,banglalink');
    expect(lines).toHaveLength(6);
  });

  it('dedupes and drops invalid rows', () => {
    const t = makeIo({ 'in.csv': CSV });
    runCli(['in.csv', '--dedupe', '--only-valid', '-f', 'local', '--summary'], t.io);
    const lines = t.out().trim().split('\n');
    expect(lines).toHaveLength(4); // header + 3 unique valid
    expect(lines[1]).toContain(',01712345678,true');
    expect(t.err()).toBe('total=5 valid=4 invalid=1 duplicates=1 unique=3\n');
  });

  it('selects a column by name or index', () => {
    const csv = 'a,b\n01712345678,01812345678\n';
    const t1 = makeIo({ 'x.csv': csv });
    runCli(['x.csv', '-c', 'b'], t1.io);
    expect(t1.out().split('\n')[1]).toContain('+8801812345678');
    const t2 = makeIo({ 'x.csv': csv });
    runCli(['x.csv', '--column', '0'], t2.io);
    expect(t2.out().split('\n')[1]).toContain('+8801712345678');
  });

  it('reads plain text lines from stdin', () => {
    const t = makeIo({}, '01712345678\n+8801812345678\nnope\n');
    expect(runCli([], t.io)).toBe(0);
    expect(t.out().trim().split('\n')).toEqual([
      'input,phone_clean,phone_valid,phone_category,phone_operator,phone_error',
      '01712345678,+8801712345678,true,mobile,grameenphone,',
      '+8801812345678,+8801812345678,true,mobile,robi,',
      'nope,,false,,,invalid_characters',
    ]);
  });

  it('supports --no-header', () => {
    const t = makeIo({ 'n.csv': '01712345678,x\n' });
    runCli(['n.csv', '--no-header'], t.io);
    expect(t.out().trim().split('\n')).toEqual(['01712345678,x,+8801712345678,true,mobile,grameenphone,']);
  });

  it('masks output', () => {
    const t = makeIo({ 'in.csv': 'phone\n01712345678\n' });
    runCli(['in.csv', '--mask', '-f', 'local'], t.io);
    expect(t.out().trim().split('\n')[1]).toBe('017******78,017******78,true,mobile,grameenphone,');
  });

  it('writes to a file with --output', () => {
    const t = makeIo({ 'in.csv': CSV });
    expect(runCli(['in.csv', '-o', 'out.csv'], t.io)).toBe(0);
    expect(t.out()).toBe('');
    expect(t.written['out.csv']).toContain('phone_clean');
  });

  it('accepts other categories with --allow', () => {
    const t = makeIo({}, '0222334455\n999\n');
    runCli(['--allow', 'landline,shortcode'], t.io);
    expect(t.out()).toContain('0222334455,+880222334455,true,landline');
    expect(t.out()).toContain('999,999,true,shortcode');
  });

  it.each([
    [['--bogus']],
    [['--format', 'weird']],
    [['--allow', 'cats']],
    [['a.csv', 'b.csv']],
    [['--column']],
  ])('usage error for %j', (argv) => {
    const t = makeIo({ 'a.csv': 'phone\n1\n', 'b.csv': 'phone\n1\n' });
    expect(runCli(argv, t.io)).toBe(2);
    expect(t.err()).toContain('bd-phone:');
  });

  it('reports missing files and columns', () => {
    const t = makeIo();
    expect(runCli(['missing.csv'], t.io)).toBe(2);
    const t2 = makeIo({ 'c.csv': 'phone\n01712345678\n' });
    expect(runCli(['c.csv', '-c', 'nope'], t2.io)).toBe(2);
    expect(runCli(['c.csv', '-c', '9'], makeIo({ 'c.csv': 'phone\n1\n' }).io)).toBe(2);
  });

  it('--json outputs objects with typed phone fields', () => {
    const t = makeIo({ 'in.csv': CSV });
    expect(runCli(['--json', '--only-valid', '--dedupe', 'in.csv'], t.io)).toBe(0);
    const rows = JSON.parse(t.out()) as Record<string, unknown>[];
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      name: 'Rahim',
      phone_clean: '+8801712345678',
      phone_valid: true,
      phone_category: 'mobile',
      phone_error: null,
    });
  });

  it('--json keeps invalid rows with null clean value and error code', () => {
    const t = makeIo({}, '12345\n');
    expect(runCli(['--json'], t.io)).toBe(0);
    const rows = JSON.parse(t.out()) as Record<string, unknown>[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ input: '12345', phone_clean: null, phone_valid: false });
    expect(typeof rows[0]?.phone_error).toBe('string');
  });
});
