import { describe, expect, it } from '@jest/globals';

import { movePage, removePage, rotatePage, type DraftPage } from './draftPages';

const pages: DraftPage[] = ['a', 'b', 'c'].map((id) => ({ id, uri: `file:///${id}.jpg`, rotation: 0 }));
const ids = (list: DraftPage[]) => list.map((p) => p.id);

describe('draftPages', () => {
  it('moves a page down and up', () => {
    expect(ids(movePage(pages, 0, 2))).toEqual(['b', 'c', 'a']);
    expect(ids(movePage(pages, 2, 0))).toEqual(['c', 'a', 'b']);
  });

  it('ignores out-of-range moves without mutating the input', () => {
    expect(ids(movePage(pages, 0, 5))).toEqual(['a', 'b', 'c']);
    expect(ids(pages)).toEqual(['a', 'b', 'c']);
  });

  it('rotates clockwise and wraps 270 → 0', () => {
    let next = pages;
    for (const expected of [90, 180, 270, 0]) {
      next = rotatePage(next, 'b');
      expect(next[1].rotation).toBe(expected);
    }
    expect(next[0].rotation).toBe(0);
  });

  it('removes a page', () => {
    expect(ids(removePage(pages, 'b'))).toEqual(['a', 'c']);
  });
});
