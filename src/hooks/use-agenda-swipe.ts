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

    const begin = (event: TouchEvent) => {
      start = null;
      if (event.touches.length !== 1 || !window.matchMedia("(max-width: 639px)").matches) return;
      const touch = event.touches[0];
      if (!touch || touch.clientX < 24 || touch.clientX > window.innerWidth - 24) return;
      start = {
        x: touch.clientX,
        y: touch.clientY,
        at: performance.now(),
        id: touch.identifier,
        axis: null,
      };
    };
    const move = (event: TouchEvent) => {
      if (!start) return;
      if (event.touches.length !== 1) {
        start = null;
        return;
      }
      const touch = event.touches[0];
      if (!touch || touch.identifier !== start.id) {
        start = null;
        return;
      }
      start.axis ??= agendaSwipeAxis(touch.clientX - start.x, touch.clientY - start.y);
      if (start.axis === "vertical") {
        start = null;
        return;
      }
      if (start.axis === "horizontal") {
        if (event.cancelable) event.preventDefault();
        suppressClickUntil = performance.now() + 500;
      }
    };
    const end = (event: TouchEvent) => {
      const gesture = start;
      start = null;
      if (!gesture || event.touches.length > 0 || gesture.axis !== "horizontal") return;
      const touch = Array.from(event.changedTouches).find((t) => t.identifier === gesture.id);
      if (!touch) return;
      suppressClickUntil = performance.now() + 500;
      const delta = agendaSwipeDayDelta(
        touch.clientX - gesture.x,
        touch.clientY - gesture.y,
        performance.now() - gesture.at,
      );
      if (delta) callbackRef.current(delta);
    };
    const cancel = () => {
      start = null;
    };
    const click = (event: MouseEvent) => {
      if (performance.now() < suppressClickUntil && event.detail !== 0) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    surface.addEventListener("touchstart", begin, { passive: true });
    surface.addEventListener("touchmove", move, { passive: false });
    surface.addEventListener("touchend", end);
    surface.addEventListener("touchcancel", cancel);
    surface.addEventListener("click", click, true);
    return () => {
      surface.removeEventListener("touchstart", begin);
      surface.removeEventListener("touchmove", move);
      surface.removeEventListener("touchend", end);
      surface.removeEventListener("touchcancel", cancel);
      surface.removeEventListener("click", click, true);
    };
  }, []);
  return surfaceRef;
}
