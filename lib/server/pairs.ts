/** Order-independent key for a pair of professors: one vote per pair per student */
export const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
