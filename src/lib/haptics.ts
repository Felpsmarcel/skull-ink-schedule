/**
 * Lightweight haptic feedback wrapper.
 * Safari iOS ignores navigator.vibrate silently — that's fine, it's a no-op.
 * On Android Chrome and most PWAs it produces a subtle tap.
 */
type HapticKind = "tap" | "success" | "warning";

export function haptic(kind: HapticKind = "tap"): void {
  if (typeof navigator === "undefined") return;
  const v = (navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }).vibrate;
  if (typeof v !== "function") return;
  const patterns: Record<HapticKind, number | number[]> = {
    tap: 8,
    success: [10, 40, 10],
    warning: [20, 60, 20],
  };
  try {
    v.call(navigator, patterns[kind] as number[]);
  } catch {
    // ignore
  }
}