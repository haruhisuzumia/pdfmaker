import { describe, expect, it } from '@jest/globals';

import { extractTitle, formatPageRanges } from './pageRanges';

describe('formatPageRanges', () => {
  it('joins consecutive pages into ranges, one-based and sorted', () => {
    expect(formatPageRanges([4, 0, 2, 3, 7])).toBe('1, 3–5, 8');
  });

  it('handles a single page and duplicates', () => {
    expect(formatPageRanges([1, 1])).toBe('2');
  });
});

describe('extractTitle', () => {
  it('names the new document after its source', () => {
    expect(extractTitle('Rent agreement', [1, 2, 3])).toBe('Rent agreement (pages 2–4)');
    expect(extractTitle('Marksheet', [0])).toBe('Marksheet (page 1)');
  });
});
