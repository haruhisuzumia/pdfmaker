import { describe, expect, it } from '@jest/globals';

import { layoutPage } from './layout';

describe('layoutPage', () => {
  it('fits a portrait scan on A4, centred horizontally', () => {
    const l = layoutPage(1000, 2000, 'a4');
    expect([l.pageW, l.pageH]).toEqual([595, 842]);
    expect(l.h).toBeCloseTo(842);
    expect(l.w).toBeCloseTo(421);
    expect(l.x).toBeCloseTo((595 - 421) / 2);
    expect(l.y).toBeCloseTo(0);
  });

  it('turns the page landscape for a landscape image', () => {
    const l = layoutPage(4000, 3000, 'letter');
    expect([l.pageW, l.pageH]).toEqual([792, 612]);
    expect(l.h).toBeCloseTo(594);
    expect(l.w).toBeCloseTo(792);
    expect(l.y).toBeCloseTo(9);
  });

  it('fit makes the page the image shape with no borders', () => {
    expect(layoutPage(1240, 1754, 'fit')).toEqual({ pageW: 595, pageH: 842, x: 0, y: 0, w: 595, h: 842 });
  });

  it('keeps the image aspect ratio', () => {
    const l = layoutPage(2480, 3508, 'letter');
    expect(l.w / l.h).toBeCloseTo(2480 / 3508);
    expect(l.w).toBeLessThanOrEqual(l.pageW);
    expect(l.h).toBeLessThanOrEqual(l.pageH);
  });
});
