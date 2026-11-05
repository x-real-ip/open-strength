// Mirrors the server's deload prescription so the Today screen shows what the workout will ask for.
export function floorToStep(w: number, step: number): number {
  if (step <= 0) return w;
  return Math.round(Math.max(0, Math.floor(w / step + 1e-9) * step) * 100) / 100;
}

export function deloadPreview(sets: number, weight: number, increment: number) {
  return { sets: Math.max(1, Math.round(sets * 0.6)), weight: increment > 0 ? floorToStep(weight * 0.9, increment) : weight };
}

export function addStep(value: number, step: number, dir: 1 | -1): number {
  const s = step > 0 ? step : 1;
  return Math.max(0, Math.round((value + dir * s) * 100) / 100);
}
