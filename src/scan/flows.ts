import { router } from 'expo-router';

import { useDraft } from '@/store/draft';
import { saveIdCard } from '@/storage/localStore';

import { pickImages, scanPages } from './scanner';

/** Scan or pick images, then open Review for a new document. */
export async function startNewDocument(from: 'scan' | 'photos') {
  const pages = from === 'scan' ? await scanPages() : await pickImages();
  if (!pages) return;
  useDraft.getState().startNew(pages);
  router.push('/scan/review');
}

/** Scans the front and back of a card and puts both on one A4 page. */
export async function scanIdCard() {
  const pages = await scanPages({ pageLimit: 2 });
  if (!pages) return;
  const id = await saveIdCard(pages);
  router.push({ pathname: '/doc/[id]', params: { id } });
}
