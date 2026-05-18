export const NOTEBOOK_TITLE_SEP = " — ";

/** User-chosen portion after the student name prefix (or the full title if no prefix). */
export function parseNotebookTitleSuffix(fullTitle: string): string {
  const sep = NOTEBOOK_TITLE_SEP;
  const idx = fullTitle.indexOf(sep);
  if (idx === -1) return fullTitle;
  return fullTitle.slice(idx + sep.length);
}

export function composeNotebookTitle(displayName: string, suffix: string): string {
  const name = displayName.trim() || "Student";
  const part = suffix.trim();
  return part ? `${name}${NOTEBOOK_TITLE_SEP}${part}` : name;
}
