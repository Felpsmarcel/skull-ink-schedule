import { useEffect, useRef } from "react";
import { agendaSwipeAxis, agendaSwipeDayDelta } from "@/lib/agenda-swipe";

/** Only the daily grid opts in. Edge gestures, multitouch and vertical scrolling stay native. */
export function useAgendaSwipe(onShiftDay: (delta: number) => void) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onShiftDay);
  useEffect(() => {
    callbackRef.current = onShiftDay;
  }, [onShiftDay]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    let start: {
      x: number;
      y: number;
      at: number;
      id: number;
      axis: "horizontal" | "vertical" | null;
    } | null = null;
    let suppressClickUntil = 0;

    const begin = (event: PointerEvent) => {
      start = null;
      if (
        event.pointerType !== "touch" ||
        !event.isPrimary ||
        !window.matchMedia("(max-width: 639px)").matches
      )
        return;
      if (event.clientX < 24 || event.clientX > window.innerWidth - 24) return;
      start = {
        x: event.clientX,
        y: event.clientY,
        at: performance.now(),
        id: event.pointerId,
        axis: null,
      };
      surface.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (!start || event.pointerId !== start.id) return;
      start.axis ??= agendaSwipeAxis(event.clientX - start.x, event.clientY - start.y);
      if (start.axis === "vertical") {
        start = null;
        return;
      }
      if (start.axis === "horizontal") suppressClickUntil = performance.now() + 500;
    };
    const end = (event: PointerEvent) => {
      const gesture = start;
      start = null;
      if (!gesture || event.pointerId !== gesture.id || gesture.axis !== "horizontal") return;
      suppressClickUntil = performance.now() + 500;
      const delta = agendaSwipeDayDelta(
        event.clientX - gesture.x,
        event.clientY - gesture.y,
        performance.now() - gesture.at,
      );
      if (delta) callbackRef.current(delta);
    };
    const cancel = () => {
      start = null;
    };
    const multitouch = (event: TouchEvent) => {
      if (event.touches.length > 1) start = null;
    };
    const click = (event: MouseEvent) => {
      if (performance.now() < suppressClickUntil && event.detail !== 0) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    surface.addEventListener("pointerdown", begin);
    surface.addEventListener("pointermove", move);
    surface.addEventListener("pointerup", end);
    surface.addEventListener("pointercancel", cancel);
    surface.addEventListener("touchstart", multitouch, { passive: true });
    surface.addEventListener("click", click, true);
    return () => {
      surface.removeEventListener("pointerdown", begin);
      surface.removeEventListener("pointermove", move);
      surface.removeEventListener("pointerup", end);
      surface.removeEventListener("pointercancel", cancel);
      surface.removeEventListener("touchstart", multitouch);
      surface.removeEventListener("click", click, true);
    };
  }, []);
  return surfaceRef;
}
