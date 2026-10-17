/** "1, 3–5, 8" for zero-based page indices (shown one-based). */
export function formatPageRanges(indices: readonly number[]): string {
  const sorted = [...new Set(indices)].sort((a, b) => a - b).map((i) => i + 1);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i];
    while (i + 1 < sorted.length && sorted[i + 1] === sorted[i] + 1) i++;
    const end = sorted[i];
    parts.push(start === end ? `${start}` : `${start}–${end}`);
  }
  return parts.join(', ');
}

/** Default name for pages taken out of a document, e.g. "Rent agreement (pages 2–4)". */
export function extractTitle(sourceTitle: string, indices: readonly number[]): string {
  const label = indices.length === 1 ? 'page' : 'pages';
  return `${sourceTitle} (${label} ${formatPageRanges(indices)})`;
}
