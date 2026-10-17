/// <reference types="node" />
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PDFDocument } from 'pdf-lib';

import { createPdfBuilder } from './build';

const jpeg = new Uint8Array(readFileSync(join(__dirname, '__fixtures__/portrait-30x40.jpg')));

describe('createPdfBuilder', () => {
  it('adds one page per JPEG and sets the title', async () => {
    const builder = await createPdfBuilder('Rent agreement', 'a4');
    await builder.addJpeg(jpeg);
    await builder.addJpeg(jpeg);
    expect(builder.pageCount()).toBe(2);

    const pdf = await PDFDocument.load(await builder.save(), { updateMetadata: false });
    expect(pdf.getPageCount()).toBe(2);
    expect(pdf.getTitle()).toBe('Rent agreement');
    expect(pdf.getProducer()).toBe('PDF Maker');
    const { width, height } = pdf.getPage(0).getSize();
    expect([width, height]).toEqual([595, 842]);
  });

  it('uses the image shape for fit pages', async () => {
    const builder = await createPdfBuilder('Photo', 'fit');
    await builder.addJpeg(jpeg);
    const pdf = await PDFDocument.load(await builder.save(), { updateMetadata: false });
    const { width, height } = pdf.getPage(0).getSize();
    expect(width).toBe(595);
    expect(height).toBe(Math.round((595 * 40) / 30));
  });
});
