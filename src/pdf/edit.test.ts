/// <reference types="node" />
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { degrees, PDFDocument } from 'pdf-lib';

import { extractPages, mergePdfs, PdfEditError, rebuildPdf } from './edit';

const jpeg = new Uint8Array(readFileSync(join(__dirname, '__fixtures__/portrait-30x40.jpg')));

/** A PDF whose page widths (100, 200, …) identify each page. */
async function fixture(count: number, first = 100, rotations: number[] = []) {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < count; i++) {
    const page = pdf.addPage([first + i * 100, 500]);
    if (rotations[i]) page.setRotation(degrees(rotations[i]));
  }
  return pdf.save();
}

async function describePages(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes);
  return pdf.getPages().map((p) => ({ width: p.getWidth(), rotation: p.getRotation().angle }));
}

describe('rebuildPdf', () => {
  it('reorders, rotates, deletes and appends pages', async () => {
    const source = await fixture(3, 100, [0, 270, 0]);
    const out = await rebuildPdf(
      source,
      [
        { from: 'pdf', index: 2, rotation: 0 },
        { from: 'pdf', index: 1, rotation: 180 },
        { from: 'image', bytes: jpeg },
      ],
      { title: 'Edited', pageSize: 'a4' },
    );
    expect(await describePages(out)).toEqual([
      { width: 300, rotation: 0 },
      { width: 200, rotation: 90 }, // 270 + 180 wraps to 90
      { width: 595, rotation: 0 },
    ]);
  });

  it('refuses an empty document', async () => {
    await expect(rebuildPdf(await fixture(1), [], { title: 'x', pageSize: 'a4' })).rejects.toBeInstanceOf(PdfEditError);
  });

  it('gives a friendly error for a file that is not a PDF', async () => {
    const notPdf = new TextEncoder().encode('hello');
    await expect(rebuildPdf(notPdf, [{ from: 'pdf', index: 0, rotation: 0 }], { title: 'x', pageSize: 'a4' })).rejects.toThrow(
      'damaged',
    );
  });
});

describe('mergePdfs', () => {
  it('joins documents in order', async () => {
    const out = await mergePdfs([await fixture(2, 100), await fixture(1, 700)], 'Merged');
    expect((await describePages(out)).map((p) => p.width)).toEqual([100, 200, 700]);
  });

  it('needs at least two documents', async () => {
    await expect(mergePdfs([await fixture(1)], 'x')).rejects.toBeInstanceOf(PdfEditError);
  });
});

describe('extractPages', () => {
  it('keeps only the chosen pages in the given order', async () => {
    const out = await extractPages(await fixture(4), [3, 1], 'Pages');
    expect((await describePages(out)).map((p) => p.width)).toEqual([400, 200]);
  });
});
