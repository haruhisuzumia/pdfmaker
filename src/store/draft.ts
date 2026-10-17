import { create } from 'zustand';

import { movePage, removePage, rotatePage, type DraftPage } from '@/lib/draftPages';

type DraftState = {
  pages: DraftPage[];
  start: (pages: DraftPage[]) => void;
  append: (pages: DraftPage[]) => void;
  move: (from: number, to: number) => void;
  rotate: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
};

/** The scan being reviewed. Lives in memory only; files are in the draft folder (see src/scan/scanner.ts). */
export const useDraft = create<DraftState>()((set) => ({
  pages: [],
  start: (pages) => set({ pages }),
  append: (pages) => set((s) => ({ pages: [...s.pages, ...pages] })),
  move: (from, to) => set((s) => ({ pages: movePage(s.pages, from, to) })),
  rotate: (id) => set((s) => ({ pages: rotatePage(s.pages, id) })),
  remove: (id) => set((s) => ({ pages: removePage(s.pages, id) })),
  clear: () => set({ pages: [] }),
}));
