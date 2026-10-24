import { PDFDocument } from 'pdf-lib';

import type { PageSize } from '@/store/settings';

import { layoutPage } from './layout';

/** Builds a PDF one JPEG page at a time, so callers can report progress. */
export async function createPdfBuilder(title: string, pageSize: PageSize) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setProducer('Panna');
  pdf.setCreator('Panna');
  const now = new Date();
  pdf.setCreationDate(now);
  pdf.setModificationDate(now);

  return {
    async addJpeg(bytes: Uint8Array) {
      const image = await pdf.embedJpg(bytes);
      const l = layoutPage(image.width, image.height, pageSize);
      pdf.addPage([l.pageW, l.pageH]).drawImage(image, { x: l.x, y: l.y, width: l.w, height: l.h });
    },
    pageCount: () => pdf.getPageCount(),
    save: () => pdf.save(),
  };
}
