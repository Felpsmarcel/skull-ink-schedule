import React, { useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  createRouter,
  createRootRoute,
  createRoute,
  createMemoryHistory,
  RouterProvider,
  Outlet,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthShell } from "@/components/layout/auth-shell";
import { AgendaToolbar, type AgendaView } from "@/components/agenda/agenda-toolbar";
import { AgendaWeekBoard } from "@/components/agenda/agenda-week-board";
import { AgendaPeriodSummary } from "@/components/agenda/agenda-period-summary";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  brusselsWeekStartMs,
  brusselsAddDays,
  enumerateBrusselsDays,
  brusselsDayKey,
} from "@/lib/agenda-grid";
import { type AgendaEntry, type AgendaReadState, entryName } from "@/lib/agenda-presentation";
import { type AgendaValuesSource } from "@/lib/agenda-values-core";
import { RANDEVU_CALENDAR_ID } from "@/lib/artist-commission-policy";
import type { StaffMember } from "@/config/staff";
import "@/i18n";
import "./visual.css";
const team: StaffMember[] = [
  {
    id: "demo-a",
    name: "Tatuador Exemplo A",
    shortName: "Tatuador A",
    calendarId: "cal-a",
    initials: "TA",
    color: "",
  },
  {
    id: "demo-b",
    name: "Tatuador Exemplo B",
    shortName: "Tatuador B",
    calendarId: "cal-b",
    initials: "TB",
    color: "",
  },
  {
    id: "demo-r",
    name: "Randevu · exemplo",
    shortName: "Randevu",
    calendarId: RANDEVU_CALENDAR_ID,
    initials: "RD",
    color: "",
  },
];
const dates = [
  "2026-11-09",
  "2026-11-10",
  "2026-11-11",
  "2026-11-12",
  "2026-11-13",
  "2026-11-14",
  "2026-11-15",
];
const all: AgendaEntry[] = dates.flatMap((date, i) =>
  Array.from({ length: i === 6 ? 0 : i === 4 ? 3 : 2 }, (_, j) => ({
    staff: team[j === 1 && i % 2 === 0 ? 2 : j % 2],
    event: {
      id: `demo-${i}-${j}`,
      startTime: `${date}T${j === 0 ? "09:00" : "13:30"}:00+01:00`,
      endTime: `${date}T${j === 0 ? "12:00" : "15:00"}:00+01:00`,
      appointmentStatus: i === 5 && j === 1 ? "cancelled" : j === 0 ? "confirmed" : "new",
      contact: { name: `Cliente Exemplo ${i + 1}${j === 0 ? "A" : "B"}` },
      title:
        j === 0
          ? `Cobertura de braço · sessão ${(i % 3) + 1} de 3`
          : i % 2 === 0
            ? "Conversa de orçamento"
            : "Projeto floral · antebraço",
    },
  })),
);
const values: AgendaValuesSource = {
  state: "ready",
  items: all.map(({ event, staff }, i) => ({
    ghlEventId: event.id,
    artistId: staff.id,
    calendarId: staff.calendarId,
    startTime: event.startTime,
    totalCents: 50000,
    depositCents: i % 2 ? 10000 : 20000,
    projectId: i % 2 ? null : "demo-project",
  })),
};
function Demo() {
  const [date, setDate] = useState(new Date("2026-11-13T12:00:00+01:00"));
  const [view, setView] = useState<AgendaView>("week"),
    [picker, setPicker] = useState(false),
    [artist, setArtist] = useState(""),
    [mode, setMode] = useState<AgendaReadState | "empty" | "unknown">("ready"),
    [role, setRole] = useState("admin"),
    [opened, setOpened] = useState<AgendaEntry | null>(null),
    [action, setAction] = useState("");
  const opener = useRef<HTMLElement | null>(null);
  const start = brusselsWeekStartMs(date),
    days = enumerateBrusselsDays(start, brusselsAddDays(start, 7));
  const entries =
    mode === "empty" || mode === "loading"
      ? []
      : all.filter(
          (e) =>
            (!artist || e.staff.id === artist) &&
            (role === "admin" || e.staff.id === team[0].id) &&
            Date.parse(e.event.startTime) >= start &&
            Date.parse(e.event.startTime) < brusselsAddDays(start, 7),
        );
  const source: AgendaValuesSource = mode === "unknown" ? { state: "ready", items: [] } : values;
  const state = mode === "empty" || mode === "unknown" ? "ready" : mode;
  const pick = (d: Date) => {
    setDate(d);
    setAction(`Agenda diária de ${brusselsDayKey(d)}. No app, abre a grade real de horários.`);
  };
  return (
    <>
      <div className="flex flex-wrap gap-3 border-b bg-muted px-4 py-2 text-xs">
        <strong>DEMONSTRAÇÃO · dados fictícios · sem CRM</strong>
        <label>
          Perfil{" "}
          <select
            aria-label="Perfil de teste"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="admin">Administrador</option>
            <option value="artist">Tatuador</option>
          </select>
        </label>
        <label>
          Estado{" "}
          <select
            aria-label="Estado de teste"
            value={mode}
            onChange={(e) => setMode(e.target.value as typeof mode)}
          >
            <option value="ready">Completo</option>
            <option value="partial">Parcial</option>
            <option value="loading">Carregando</option>
            <option value="empty">Vazio</option>
            <option value="unknown">Valores desconhecidos</option>
          </select>
        </label>
      </div>
      <AgendaToolbar
        date={date}
        dateLabel={`${brusselsDayKey(new Date(start)).slice(8)} – ${brusselsDayKey(new Date(days[6])).slice(8)} nov. 2026`}
        view={view}
        setView={(v) => {
          setView(v);
          if (v !== "week") setAction(`Modo ${v}: no app, abre a grade existente.`);
        }}
        pickerOpen={picker}
        setPickerOpen={setPicker}
        setDate={setDate}
        goPrevMonth={() => setDate(new Date("2026-10-13T12:00:00Z"))}
        shift={(n) => setDate(new Date(brusselsAddDays(start, n * 7)))}
        booked={entries.length}
        free={0}
        summaryState={state}
        allowArtistFilter={role === "admin"}
        pickedArtistId={artist}
        setPickedArtistId={setArtist}
        allArtists={team}
        onRefresh={() => setMode("ready")}
        onNew={() =>
          setAction(
            "No app, este botão abre o fluxo existente de cliente, projeto e seleção de sessões.",
          )
        }
      />
      <AgendaPeriodSummary
        entries={entries}
        state={state}
        source={source}
        showValues={role === "admin"}
      />
      <AgendaWeekBoard
        days={days}
        entries={entries}
        state={state}
        source={source}
        showValues={role === "admin"}
        todayKey="2026-11-13"
        onOpen={(e) => {
          opener.current = document.activeElement as HTMLElement;
          setOpened(e);
        }}
        onPickDay={pick}
        onNew={pick}
        onRetry={() => setMode("ready")}
      />
      <Dialog
        open={Boolean(opened || action)}
        onOpenChange={(open) => {
          if (!open) {
            setOpened(null);
            setAction("");
          }
        }}
      >
        <DialogContent
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            opener.current?.focus();
          }}
        >
          <DialogTitle>{opened ? entryName(opened) : "Navegação de demonstração"}</DialogTitle>
          <DialogDescription>
            {opened
              ? `${opened.event.title}. No app, abre a ficha existente com cliente e projeto. Esta demonstração não lê ou grava compromissos.`
              : action}
          </DialogDescription>
        </DialogContent>
      </Dialog>
    </>
  );
}
const root = createRootRoute({
  component: () => (
    <AuthShell>
      <Outlet />
    </AuthShell>
  ),
});
const route = createRoute({ getParentRoute: () => root, path: "/agenda", component: Demo });
const router = createRouter({
  routeTree: root.addChildren([route]),
  history: createMemoryHistory({ initialEntries: ["/agenda"] }),
});
const reactRoot = createRoot(document.getElementById("root")!);
reactRoot.render(
  <QueryClientProvider client={new QueryClient()}>
    <RouterProvider router={router} />
  </QueryClientProvider>,
);
if (import.meta.hot) import.meta.hot.dispose(() => reactRoot.unmount());
