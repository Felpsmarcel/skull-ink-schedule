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
  try {
    switch (kind) {
      case "tap":
        v.call(navigator, 8);
        break;
      case "success":
        v.call(navigator, [10, 40, 10]);
        break;
      case "warning":
        v.call(navigator, [20, 60, 20]);
        break;
    }
  } catch {
    // ignore
  }
}