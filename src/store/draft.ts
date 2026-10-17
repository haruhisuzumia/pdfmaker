import { create } from 'zustand';

import { movePage, removePage, rotatePage, type DraftPage } from '@/lib/draftPages';

export type DraftTarget = { mode: 'new' } | { mode: 'edit'; docId: string };

type DraftState = {
  target: DraftTarget;
  pages: DraftPage[];
  /** A new document from scanned or picked images. */
  startNew: (pages: DraftPage[]) => void;
  /** Editing the pages of a saved document. */
  startEdit: (docId: string, pages: DraftPage[]) => void;
  append: (pages: DraftPage[]) => void;
  move: (from: number, to: number) => void;
  rotate: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
};

/** The pages being reviewed. Lives in memory only; new images are in the draft folder (see src/scan/scanner.ts). */
export const useDraft = create<DraftState>()((set) => ({
  target: { mode: 'new' },
  pages: [],
  startNew: (pages) => set({ target: { mode: 'new' }, pages }),
  startEdit: (docId, pages) => set({ target: { mode: 'edit', docId }, pages }),
  append: (pages) => set((s) => ({ pages: [...s.pages, ...pages] })),
  move: (from, to) => set((s) => ({ pages: movePage(s.pages, from, to) })),
  rotate: (id) => set((s) => ({ pages: rotatePage(s.pages, id) })),
  remove: (id) => set((s) => ({ pages: removePage(s.pages, id) })),
  clear: () => set({ target: { mode: 'new' }, pages: [] }),
}));
