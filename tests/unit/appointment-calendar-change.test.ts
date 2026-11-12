import { beforeEach, describe, expect, it } from "vitest";
import { createJSONStorage } from "zustand/middleware";
import {
  allSessionsScheduled,
  projectTotalEur,
  useAppointmentDraft,
} from "@/stores/appointment-draft";

const starts = ["2026-11-16T10:00:00Z", "2026-11-23T13:00:00Z", "2026-12-07T10:00:00Z"];

beforeEach(() => {
  // Exercise the actual state actions, with storage confined to this test process.
  useAppointmentDraft.persist.setOptions({
    storage: createJSONStorage(() => ({
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    })),
  });
  useAppointmentDraft.setState({ ...useAppointmentDraft.getInitialState() }, true);
  const draft = useAppointmentDraft.getState();
  draft.setContact({ id: "contact-a", contactName: "Cliente de teste" });
  draft.setProject({
    decision: "reuse",
    reuseProjectId: "project-a",
    reuseOpportunityId: "opportunity-a",
  });
  draft.setCalendar("calendar-a");
  draft.setSessionCount(3);
  draft.setStart(starts[0]);
  draft.setExtraStart(0, starts[1]);
  draft.setExtraStart(1, starts[2]);
  draft.addService({
    id: "service-a",
    name: "Sessão",
    category: "Tattoo",
    duration_min: 180,
    modality: "presencial",
    price_eur: 600,
    price_max_eur: null,
    description: null,
    description_short: null,
    sort_order: 0,
    active: true,
    price_on_request: false,
  });
  draft.setDeposit(100);
  draft.setNotes("Manter as referências do projeto");
});

describe("calendar changes on a multiple-session booking", () => {
  it("requires every session to be rescheduled for the new calendar without losing the project or amounts", () => {
    const previous = useAppointmentDraft.getState();
    expect(allSessionsScheduled(previous)).toBe(true);
    previous.setCalendar("calendar-b");
    const changed = useAppointmentDraft.getState();
    expect(changed.calendarId).toBe("calendar-b");
    expect(changed.startISO).toBeNull();
    expect(changed.extraStarts).toEqual([null, null]);
    expect(changed.sessionCount).toBe(3);
    expect(changed.contact).toEqual(previous.contact);
    expect(changed.project).toEqual(previous.project);
    expect(changed.services).toEqual(previous.services);
    expect(changed.depositEur).toBe(100);
    expect(changed.notes).toBe(previous.notes);
    expect(changed.idempotencyKey).toBe(previous.idempotencyKey);
    expect(projectTotalEur(changed)).toBe(1800);
    changed.setStart("2026-11-17T10:00:00Z");
    changed.setExtraStart(0, "2026-11-24T10:00:00Z");
    expect(allSessionsScheduled(useAppointmentDraft.getState())).toBe(false);
    changed.setExtraStart(1, "2026-12-08T10:00:00Z");
    expect(allSessionsScheduled(useAppointmentDraft.getState())).toBe(true);
  });

  it("keeps all chosen dates when the same calendar is selected again", () => {
    const previous = useAppointmentDraft.getState();
    previous.setCalendar("calendar-a");
    const unchanged = useAppointmentDraft.getState();
    expect([unchanged.startISO, ...unchanged.extraStarts]).toEqual(starts);
    expect(allSessionsScheduled(unchanged)).toBe(true);
    expect(projectTotalEur(unchanged)).toBe(1800);
  });

  it("does not retain scheduled times after clearing the calendar", () => {
    useAppointmentDraft.getState().setCalendar(null);
    const cleared = useAppointmentDraft.getState();
    expect(cleared.calendarId).toBeNull();
    expect([cleared.startISO, ...cleared.extraStarts]).toEqual([null, null, null]);
    expect(allSessionsScheduled(cleared)).toBe(false);
  });
});
