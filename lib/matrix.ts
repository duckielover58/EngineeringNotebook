/** Totals per option; highest total wins. */
export function optionTotals(matrix: number[][]): number[] {
  return matrix.map((row) => row.reduce((a, b) => a + b, 0));
}

export function winningOptionIndex(totals: number[]): number {
  if (!totals.length) return -1;
  let max = totals[0];
  let idx = 0;
  for (let i = 1; i < totals.length; i++) {
    if (totals[i] > max) {
      max = totals[i];
      idx = i;
    }
  }
  return idx;
}

export function sortOptionIndexesByTotal(totals: number[]): number[] {
  return totals
    .map((total, idx) => ({ total, idx }))
    .sort((a, b) => b.total - a.total || a.idx - b.idx)
    .map((item) => item.idx);
}
