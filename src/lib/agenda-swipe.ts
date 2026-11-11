/** Horizontal intent must be deliberate; vertical scrolling wins ambiguous gestures. */
export function agendaSwipeAxis(dx: number, dy: number): "horizontal" | "vertical" | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 12) return null;
  return Math.abs(dx) > Math.abs(dy) * 1.5 ? "horizontal" : "vertical";
}

export function agendaSwipeDayDelta(dx: number, dy: number, elapsedMs: number): -1 | 0 | 1 {
  if (elapsedMs > 1200 || elapsedMs < 0 || Math.abs(dx) < 64 || agendaSwipeAxis(dx, dy) !== "horizontal") return 0;
  return dx < 0 ? 1 : -1;
}