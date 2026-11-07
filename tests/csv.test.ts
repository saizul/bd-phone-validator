import { describe, expect, it } from 'vitest';
import { parseCsv, stringifyCsv } from '../src';

describe('csv', () => {
  it('parses simple rows', () => {
    expect(parseCsv('a,b\n1,2\n')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('handles quotes, commas and newlines inside fields', () => {
    expect(parseCsv('a,"b,c","d\ne"\r\n"x""y",2')).toEqual([['a', 'b,c', 'd\ne'], ['x"y', '2']]);
  });
  it('strips a BOM and handles missing trailing newline', () => {
    expect(parseCsv('﻿a,b')).toEqual([['a', 'b']]);
  });
  it('supports other delimiters', () => {
    expect(parseCsv('a;b\n1;2', ';')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('keeps empty fields', () => {
    expect(parseCsv(',\n,x')).toEqual([['', ''], ['', 'x']]);
  });
  it('stringifies with quoting', () => {
    expect(stringifyCsv([['a', 'b,c'], ['x"y', 'z\nw']])).toBe('a,"b,c"\n"x""y","z\nw"\n');
    expect(stringifyCsv([])).toBe('');
  });
  it('round-trips', () => {
    const rows = [['id', 'note'], ['1', 'he said "hi", ok'], ['2', 'line\nbreak'], ['3', '']];
    expect(parseCsv(stringifyCsv(rows))).toEqual(rows);
  });
});
