import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { GhlContact } from "@/lib/ghl";
import type { Service } from "@/lib/services";

export interface DraftServiceLine {
  service: Service;
  /** Discount percent applied to this line (0–100). */
  discountPct: number;
  /** Override price in EUR (used when the service has `price_on_request`). */
  overridePriceEur: number | null;
}

export interface AppointmentDraft {
  contact: GhlContact | null;
  calendarId: string | null;
  /** ISO string start time (local) */
  startISO: string | null;
  services: DraftServiceLine[];
  notes: string;
  sellerId: string | null;
  /** Deposit already paid by the client, in EUR. */
  depositEur: number;
}

interface State extends AppointmentDraft {
  setContact: (c: GhlContact | null) => void;
  setCalendar: (id: string | null) => void;
  setStart: (iso: string | null) => void;
  addService: (s: Service) => void;
  removeService: (id: string) => void;
  setDiscount: (serviceId: string, pct: number) => void;
  setOverridePrice: (serviceId: string, eur: number | null) => void;
  setNotes: (n: string) => void;
  setSeller: (id: string | null) => void;
  setDeposit: (eur: number) => void;
  reset: () => void;
}

const initial: AppointmentDraft = {
  contact: null,
  calendarId: null,
  startISO: null,
  services: [],
  notes: "",
  sellerId: null,
  depositEur: 0,
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
            : {
                services: [
                  ...st.services,
                  { service: s, discountPct: 0, overridePriceEur: null },
                ],
              },
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
      setOverridePrice: (serviceId, eur) =>
        set((st) => ({
          services: st.services.map((l) =>
            l.service.id === serviceId
              ? {
                  ...l,
                  overridePriceEur:
                    eur == null || Number.isNaN(eur) ? null : Math.max(0, eur),
                }
              : l,
          ),
        })),
      setNotes: (notes) => set({ notes: notes.slice(0, 1000) }),
      setSeller: (sellerId) => set({ sellerId }),
      setDeposit: (eur) =>
        set({ depositEur: Number.isFinite(eur) ? Math.max(0, eur) : 0 }),
      reset: () => set({ ...initial }),
    }),
    {
      name: "gf-appointment-draft",
      version: 4,
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? sessionStorage : (undefined as unknown as Storage),
      ),
    },
  ),
);

export function totalDurationMin(draft: AppointmentDraft): number {
  return draft.services.reduce((acc, l) => acc + l.service.duration_min, 0);
}

/** Base price of a draft line — override wins over the catalog price. */
export function linePriceEur(line: DraftServiceLine): number {
  if (line.service.price_on_request) {
    return line.overridePriceEur != null ? line.overridePriceEur : 0;
  }
  return line.overridePriceEur ?? line.service.price_eur;
}

export function totalOriginalEur(draft: AppointmentDraft): number {
  return round2(
    draft.services.reduce((acc, l) => acc + linePriceEur(l), 0),
  );
}

export function totalFinalEur(draft: AppointmentDraft): number {
  return round2(
    draft.services.reduce(
      (acc, l) => acc + linePriceEur(l) * (1 - l.discountPct / 100),
      0,
    ),
  );
}

export function balanceEur(draft: AppointmentDraft): number {
  return round2(Math.max(0, totalFinalEur(draft) - (draft.depositEur || 0)));
}

/** True when every "sob consulta" line has a value entered. */
export function draftValuesComplete(draft: AppointmentDraft): boolean {
  return draft.services.every(
    (l) => !l.service.price_on_request || (l.overridePriceEur ?? 0) > 0,
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}