export type Rotation = 0 | 90 | 180 | 270;

export type DraftPage = {
  id: string;
  /** file:// URI of the scanner's JPEG in the draft folder. */
  uri: string;
  /** Clockwise rotation applied when the document is saved. */
  rotation: Rotation;
};

export function movePage(pages: readonly DraftPage[], from: number, to: number): DraftPage[] {
  if (from === to || from < 0 || to < 0 || from >= pages.length || to >= pages.length) return [...pages];
  const next = [...pages];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function rotatePage(pages: readonly DraftPage[], id: string): DraftPage[] {
  return pages.map((p) => (p.id === id ? { ...p, rotation: (((p.rotation + 90) % 360) as Rotation) } : p));
}

export function removePage(pages: readonly DraftPage[], id: string): DraftPage[] {
  return pages.filter((p) => p.id !== id);
}
