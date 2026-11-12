import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFinalizeAppointment } from "@/hooks/use-finalize-appointment";
import { allSessionsScheduled, type AppointmentDraft } from "@/stores/appointment-draft";

const fake = vi.hoisted(() => ({
  draft: null as unknown,
  book: vi.fn(),
  navigate: vi.fn(),
  invalidateQueries: vi.fn(),
  sendEmail: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useState: () => [false, vi.fn()],
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => fake.navigate }));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: fake.invalidateQueries }),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => fake.book }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("sonner", () => ({
  toast: { success: fake.success, error: fake.error, warning: fake.warning },
}));
vi.mock("@/lib/booking.functions", () => ({ finalizeBooking: {} }));
vi.mock("@/lib/services", () => ({ formatPrice: (value: number) => `${value} EUR` }));
vi.mock("@/lib/email/send", () => ({ sendTransactionalEmail: fake.sendEmail }));
vi.mock("@/lib/haptics", () => ({ haptic: vi.fn() }));
vi.mock("@/hooks/use-artists", () => ({
  useArtists: () => ({
    data: [
      {
        id: "artist",
        calendarId: "calendar",
        name: "Artista fictício",
        email: "artist@example.invalid",
      },
    ],
  }),
}));
vi.mock("@/stores/appointment-draft", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/stores/appointment-draft")>()),
  useAppointmentDraft: () => fake.draft,
}));

function draftFixture() {
  const draft: AppointmentDraft & {
    setBookingCheckpoint: (checkpoint: AppointmentDraft["bookingCheckpoint"]) => void;
    reset: ReturnType<typeof vi.fn>;
    setStart: ReturnType<typeof vi.fn>;
  } = {
    contact: { id: "contact", contactName: "Cliente fictício", email: "client@example.invalid" },
    calendarId: "calendar",
    // In Brussels this is November 1, although the UTC timestamp is October 31.
    startISO: "2026-10-31T23:30:00.000Z",
    extraStarts: ["2026-11-08T10:00:00.000Z", "2026-11-15T10:00:00.000Z"],
    sessionCount: 3,
    services: [
      {
        service: {
          id: "service",
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
        },
        discountPct: 0,
        overridePriceEur: null,
      },
    ],
    notes: "Referências fictícias",
    sellerId: null,
    depositEur: 100,
    project: {
      decision: "new",
      reuseProjectId: null,
      reuseOpportunityId: null,
      projectType: "cover_up",
      bodyPart: "braço",
      description: "Projeto fictício",
    },
    idempotencyKey: "stable-fixture-key",
    bookingCheckpoint: null,
    setBookingCheckpoint: (checkpoint) => {
      draft.bookingCheckpoint = checkpoint;
    },
    reset: vi.fn(),
    setStart: vi.fn(),
  };
  fake.draft = draft;
  return draft;
}

function booked(session: number, projectId: string | null = "project") {
  return {
    kind: "created",
    appointmentId: `appointment-${session}`,
    ghlEventId: `event-${session}`,
    projectId,
    ghlOpportunityId: "opportunity",
    ghlContactId: "contact",
    totalEur: 600,
    commissionPct: 40,
    warnings: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  fake.invalidateQueries.mockResolvedValue(undefined);
  fake.sendEmail.mockResolvedValue(undefined);
  vi.stubGlobal("window", { location: { origin: "https://fixture.invalid" } });
});
afterEach(() => vi.unstubAllGlobals());

describe("multiple-session finalization preserves confirmed writes", () => {
  it("stops on a second-session contact conflict and blocks a blind resend of the draft", async () => {
    const draft = draftFixture();
    fake.book.mockResolvedValueOnce(booked(1)).mockResolvedValueOnce({
      kind: "contact_conflict",
      reason: "Contato ambíguo",
      candidates: [],
    });
    await useFinalizeAppointment().run();
    expect(fake.book).toHaveBeenCalledTimes(2);
    expect(draft.bookingCheckpoint).toMatchObject({
      pendingSession: 2,
      sessions: [
        {
          session: 1,
          appointmentId: "appointment-1",
          ghlEventId: "event-1",
          projectId: "project",
          ghlOpportunityId: "opportunity",
          idempotencyKey: "appt-stable-fixture-key",
        },
      ],
    });
    expect(draft.bookingCheckpoint?.reason).toContain("Revisão administrativa necessária");
    expect(draft.idempotencyKey).toBe("stable-fixture-key");
    expect(draft.reset).not.toHaveBeenCalled();
    expect(fake.success).not.toHaveBeenCalled();
    expect(fake.sendEmail).not.toHaveBeenCalled();
    expect(fake.navigate).toHaveBeenLastCalledWith({ to: "/appointments/new/revisao" });
    await useFinalizeAppointment().run();
    expect(fake.book).toHaveBeenCalledTimes(2);
  });

  it("keeps both confirmed session IDs when the third session conflicts", async () => {
    const draft = draftFixture();
    fake.book
      .mockResolvedValueOnce(booked(1))
      .mockResolvedValueOnce(booked(2))
      .mockResolvedValueOnce({
        kind: "contact_conflict",
        reason: "Conferir cliente",
        candidates: [],
      });
    await useFinalizeAppointment().run();
    expect(
      draft.bookingCheckpoint?.sessions.map((s) => [s.session, s.appointmentId, s.idempotencyKey]),
    ).toEqual([
      [1, "appointment-1", "appt-stable-fixture-key"],
      [2, "appointment-2", "appt-stable-fixture-key-s2"],
    ]);
    expect(draft.bookingCheckpoint?.pendingSession).toBe(3);
    expect(draft.reset).not.toHaveBeenCalled();
    expect(fake.success).not.toHaveBeenCalled();
  });

  it("does not erase session 1 or claim rollback when an extra call throws after a possible write", async () => {
    const draft = draftFixture();
    fake.book
      .mockResolvedValueOnce(booked(1))
      .mockRejectedValueOnce(new Error("Timeout ao confirmar a sessão"));
    await useFinalizeAppointment().run();
    expect(draft.bookingCheckpoint?.reason).toContain("não confirmada");
    expect(draft.bookingCheckpoint?.sessions[0].appointmentId).toBe("appointment-1");
    expect(draft.setStart).not.toHaveBeenCalled();
    expect(draft.reset).not.toHaveBeenCalled();
    expect(fake.sendEmail).not.toHaveBeenCalled();
    expect(fake.book).toHaveBeenCalledTimes(2);
  });

  it("stops as partial when session 1 has no linked project", async () => {
    const draft = draftFixture();
    fake.book.mockResolvedValueOnce(booked(1, null));
    await useFinalizeAppointment().run();
    expect(fake.book).toHaveBeenCalledTimes(1);
    expect(draft.bookingCheckpoint?.pendingSession).toBe(2);
    expect(draft.reset).not.toHaveBeenCalled();
    expect(fake.success).not.toHaveBeenCalled();
  });

  it("uses per-session keys and navigates to the first session's Brussels day only after all succeed", async () => {
    const draft = draftFixture();
    fake.book
      .mockResolvedValueOnce(booked(1))
      .mockResolvedValueOnce(booked(2))
      .mockResolvedValueOnce(booked(3));
    await useFinalizeAppointment().run();
    expect(
      fake.book.mock.calls.map(([args]) => [
        args.data.idempotencyKey,
        args.data.depositEur,
        args.data.projectTotalEur,
      ]),
    ).toEqual([
      ["appt-stable-fixture-key", 100, 1800],
      ["appt-stable-fixture-key-s2", 0, null],
      ["appt-stable-fixture-key-s3", 0, null],
    ]);
    expect(fake.navigate).toHaveBeenLastCalledWith({
      to: "/agenda",
      search: { date: "2026-11-01", novo: "event-1" },
    });
    expect(draft.reset).toHaveBeenCalledOnce();
    expect(fake.success).toHaveBeenCalledOnce();
  });

  it("never starts writes with a missing or truncated extra-session schedule", async () => {
    const draft = draftFixture();
    draft.extraStarts = ["2026-11-08T10:00:00.000Z"];
    expect(allSessionsScheduled(draft)).toBe(false);
    await useFinalizeAppointment().run();
    expect(fake.book).not.toHaveBeenCalled();
    expect(fake.navigate).toHaveBeenLastCalledWith({ to: "/appointments/new/agenda" });
    draft.extraStarts.push("2026-11-15T10:00:00.000Z");
    expect(allSessionsScheduled(draft)).toBe(true);
    draft.startISO = null;
    expect(allSessionsScheduled(draft)).toBe(false);
  });
});
