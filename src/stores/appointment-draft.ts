import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { GhlContact } from "@/lib/ghl";
import type { Service } from "@/lib/services";

export interface DraftServiceLine {
  service: Service;
  /** Discount percent applied to this line (0–100). */
  discountPct: number;
}

export interface AppointmentDraft {
  contact: GhlContact | null;
  calendarId: string | null;
  /** ISO string start time (local) */
  startISO: string | null;
  services: DraftServiceLine[];
  notes: string;
}

interface State extends AppointmentDraft {
  setContact: (c: GhlContact | null) => void;
  setCalendar: (id: string | null) => void;
  setStart: (iso: string | null) => void;
  addService: (s: Service) => void;
  removeService: (id: string) => void;
  setDiscount: (serviceId: string, pct: number) => void;
  setNotes: (n: string) => void;
  reset: () => void;
}

const initial: AppointmentDraft = {
  contact: null,
  calendarId: null,
  startISO: null,
  services: [],
  notes: "",
};

export const useAppointmentDraft = create<State>()(
  persist(
    (set) => ({
      ...initial,
      setContact: (contact) => set({ contact }),
      setCalendar: (calendarId) => set({ calendarId }),
      setStart: (startISO) => set({ startISO }),
      addService: (s) =>
        set((st) =>
          st.services.some((l) => l.service.id === s.id)
            ? st
            : { services: [...st.services, { service: s, discountPct: 0 }] },
        ),
      removeService: (id) =>
        set((st) => ({ services: st.services.filter((l) => l.service.id !== id) })),
      setDiscount: (serviceId, pct) =>
        set((st) => ({
          services: st.services.map((l) =>
            l.service.id === serviceId
              ? { ...l, discountPct: Math.max(0, Math.min(100, pct)) }
              : l,
          ),
        })),
      setNotes: (notes) => set({ notes: notes.slice(0, 1000) }),
      reset: () => set({ ...initial }),
    }),
    {
      name: "gf-appointment-draft",
      version: 2,
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? sessionStorage : (undefined as unknown as Storage),
      ),
    },
  ),
);

export function totalDurationMin(draft: AppointmentDraft): number {
  return draft.services.reduce((acc, l) => acc + l.service.duration_min, 0);
}

export function totalOriginalEur(draft: AppointmentDraft): number {
  return round2(
    draft.services.reduce((acc, l) => acc + l.service.price_eur, 0),
  );
}

export function totalFinalEur(draft: AppointmentDraft): number {
  return round2(
    draft.services.reduce(
      (acc, l) => acc + l.service.price_eur * (1 - l.discountPct / 100),
      0,
    ),
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}