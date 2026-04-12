/** 1 = best, 5 = worst. Totals per option; lowest total wins. */
export function optionTotals(matrix: number[][]): number[] {
  return matrix.map((row) => row.reduce((a, b) => a + b, 0));
}

export function winningOptionIndex(totals: number[]): number {
  if (!totals.length) return -1;
  let min = totals[0];
  let idx = 0;
  for (let i = 1; i < totals.length; i++) {
    if (totals[i] < min) {
      min = totals[i];
      idx = i;
    }
  }
  return idx;
}
