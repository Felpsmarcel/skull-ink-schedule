import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
const f = vi.hoisted(() => ({ payments: vi.fn(), finance: vi.fn(), agenda: vi.fn() }));
vi.mock("@/lib/mcp/crm", () => ({
  fetchCrmAppointments: f.agenda,
  fetchCrmFinance: f.finance,
  summarizeCrmFinance: () => ({ total_ganho_eur: 999 }),
}));
vi.mock("@/lib/mcp/payments", () => ({ fetchStudioPaymentsForClient: f.payments }));
import { readDashboard } from "../../src/lib/dashboard-read.server";
it("artist A gets only own nonfinancial projection and no commission or studio amount", async () => {
  f.agenda.mockResolvedValue({
    rows: [
      {
        crm_event_id: "A",
        start_at: "2026-10-25T10:00:00Z",
        end_at: "2026-10-25T11:00:00Z",
        status: "confirmed",
        title: "Private",
        contact_id: "personal",
      },
    ],
    truncated: false,
    partial: false,
  });
  f.finance.mockResolvedValue({
    rows: [{ status: "won", valor_eur: 999, nome_cliente: "Private" }],
    truncated: false,
  });
  const scope = {
    role: "artist" as const,
    artistId: "A",
    artists: [{ id: "A", name: "A", ghl_calendar_id: "cal-A", ghl_user_id: "crm-A", active: true }],
    artistsByUserId: new Map([["crm-A", "A"]]),
    restrictToGhlUserId: "crm-A",
  };
  const result = await readDashboard({} as SupabaseClient, scope, "2026-10-25", "2026-10-25");
  expect(f.finance.mock.calls[0]?.[3]).toBe("crm-A");
  expect(f.agenda.mock.calls[0]?.[0]).toEqual([{ calendarId: "cal-A", artistName: "A" }]);
  expect(f.payments).not.toHaveBeenCalled();
  expect(result.opportunities).toMatchObject({ count: 1, commissionOmitted: true });
  expect(JSON.stringify(result)).not.toContain("999");
  expect(JSON.stringify(result)).not.toContain("Private");
  expect(JSON.stringify(result)).not.toContain("personal");
});
it("artist scope with another artist is rejected before CRM calls", async () => {
  f.finance.mockClear();
  await expect(
    readDashboard(
      {} as SupabaseClient,
      {
        role: "artist",
        artistId: "A",
        artists: [
          { id: "B", name: "B", ghl_calendar_id: "cal-B", ghl_user_id: "crm-B", active: true },
        ],
        artistsByUserId: new Map(),
        restrictToGhlUserId: "crm-A",
      },
      "2026-10-25",
      "2026-10-25",
    ),
  ).rejects.toMatchObject({ status: 403 });
  expect(f.finance).not.toHaveBeenCalled();
});
