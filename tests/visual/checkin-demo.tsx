import React, { useEffect, useState } from "react";
import { Button } from "../../src/components/ui/button";
import {
  PublicCheckinView,
  TotemConfirmView,
  TotemDoneView,
  TotemSearchView,
  TotemWelcomeView,
} from "../../src/components/checkin/totem-views";
import { QueuePageView, QueueView } from "../../src/components/checkin/queue-view";
import type { CheckinPublicView, FilaRow, TotemCandidate } from "../../src/lib/checkin.functions";

const now = Date.parse("2026-11-12T09:30:00Z");
const appointments: NonNullable<TotemCandidate["agendamentoHoje"]>[] = [
  {
    appointmentId: "10000000-0000-4000-8000-000000000001",
    scheduledAtISO: "2026-11-12T09:00:00Z",
    artistId: "20000000-0000-4000-8000-000000000001",
    artistNome: "Artista Exemplo A",
  },
  {
    appointmentId: "10000000-0000-4000-8000-000000000002",
    scheduledAtISO: "2026-11-12T13:00:00Z",
    artistId: "20000000-0000-4000-8000-000000000002",
    artistNome: "Artista Exemplo B",
  },
];
const candidate: TotemCandidate = {
  contactId: "30000000-0000-4000-8000-000000000001",
  ghlContactId: null,
  nomeMascarado: "Cliente E.",
  telefoneMascarado: "Telefone cadastrado",
  temTelefone: true,
  agendamentoHoje: appointments[0],
};
const initialRows: FilaRow[] = [
  {
    id: "checkin-example-one",
    clienteNome: "Cliente Exemplo (fictício)",
    codigo: "DEMO-01",
    status: "aguardando",
    arrivedAtISO: "2026-11-12T09:05:00Z",
    startedAtISO: null,
    scheduledAtISO: appointments[0].scheduledAtISO,
    artistId: appointments[0].artistId,
    tatuador: appointments[0].artistNome,
    appointmentId: appointments[0].appointmentId,
    syncStatus: "failed",
  },
  {
    id: "checkin-example-two",
    clienteNome: "Outra Pessoa Exemplo (fictícia)",
    codigo: "DEMO-02",
    status: "em_atendimento",
    arrivedAtISO: "2026-11-12T08:30:00Z",
    startedAtISO: "2026-11-12T09:00:00Z",
    scheduledAtISO: null,
    artistId: appointments[1].artistId,
    tatuador: null,
    appointmentId: null,
    syncStatus: "pending",
  },
  {
    id: "checkin-example-three",
    clienteNome: "Visita Concluída (fictícia)",
    codigo: "DEMO-03",
    status: "concluido",
    arrivedAtISO: "2026-11-12T08:00:00Z",
    startedAtISO: "2026-11-12T08:05:00Z",
    scheduledAtISO: null,
    artistId: null,
    tatuador: null,
    appointmentId: null,
    syncStatus: "synced",
  },
];
const scenes = {
  welcome: "Acolhida",
  search: "Identificação",
  confirm: "Confirmação",
  done: "QR Code",
  public: "Acompanhar",
  queue: "Fila",
} as const;
type Scene = keyof typeof scenes;
const states = {
  ready: "Carregado",
  loading: "Carregando",
  error: "Erro",
  empty: "Sem registro",
  expired: "Expirado",
  qr: "Falha do QR",
} as const;
type SourceState = keyof typeof states;

/** Local-only fixture. Every action updates React state, never a server function. */
export function CheckinDemo() {
  const [scene, setScene] = useState<Scene>("welcome");
  const [source, setSource] = useState<SourceState>("ready");
  const [mode, setMode] = useState<"agendado" | "novo">("agendado");
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<TotemCandidate[] | null>(null);
  const [selected, setSelected] = useState<TotemCandidate | null>(null);
  const [last4, setLast4] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [appointment, setAppointment] = useState<TotemCandidate["agendamentoHoje"]>(null);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [queue, setQueue] = useState(initialRows);
  const [canManage, setCanManage] = useState(true);
  const [notice, setNotice] = useState("Nenhuma ação simulada ainda.");

  useEffect(() => {
    let disposed = false;
    void import("qrcode")
      .then(async ({ default: QRCode }) => {
        const url = await QRCode.toDataURL(
          "GF TATTOO - SIMULACAO LOCAL. NAO E LINK DE ATENDIMENTO.",
          { width: 420, margin: 1, errorCorrectionLevel: "M" },
        );
        if (!disposed) setQr(url);
      })
      .catch(() => {
        if (!disposed) setQr(null);
      });
    return () => {
      disposed = true;
    };
  }, []);

  function openScene(next: Scene) {
    setScene(next);
    setSource("ready");
    setError(null);
    if (next === "confirm") setAppointment(null);
  }
  const checkin: CheckinPublicView = {
    codigo: "DEMO-01",
    status: "aguardando",
    scheduledAtISO: appointment?.scheduledAtISO ?? null,
    arrivedAtISO: "2026-11-12T09:05:00Z",
    tatuadorPrimeiroNome: appointment?.artistNome ?? null,
    expirado: source === "expired",
  };
  const availableStates: SourceState[] =
    scene === "welcome"
      ? []
      : scene === "confirm"
        ? ["ready", "loading", "error"]
        : scene === "done"
          ? ["ready", "loading", "error", "empty", "expired", "qr"]
          : scene === "public"
            ? ["ready", "loading", "error", "empty", "expired"]
            : ["ready", "loading", "error", "empty"];
  const simulatedError =
    source === "error" ? "Erro simulado. Nenhum dado foi enviado. Peça apoio à recepção." : error;

  return (
    <div>
      <section
        aria-label="Controles da prévia de check-in"
        className="mx-auto max-w-6xl space-y-4 px-4 py-4 sm:px-6"
      >
        <p
          role="note"
          className="rounded-xl border border-primary/20 bg-accent/50 p-4 text-sm leading-6"
        >
          <strong>SIMULAÇÃO LOCAL · Nada é salvo ou enviado.</strong> Clientes, horários, IDs e
          estados são fictícios. Os componentes visuais são reais; nenhuma ação chama CRM,
          autenticação ou registro de presença. O QR contém apenas uma mensagem de demonstração.
        </p>
        <div role="group" aria-label="Tela de check-in" className="flex flex-wrap gap-2">
          {(Object.keys(scenes) as Scene[]).map((item) => (
            <Button
              key={item}
              type="button"
              variant={scene === item ? "default" : "outline"}
              aria-pressed={scene === item}
              className="min-h-11 rounded-xl"
              onClick={() => openScene(item)}
            >
              {scenes[item]}
            </Button>
          ))}
        </div>
        {availableStates.length ? (
          <div
            role="group"
            aria-label="Estado simulado do check-in"
            className="flex flex-wrap gap-2"
          >
            {availableStates.map((item) => (
              <Button
                key={item}
                type="button"
                variant={source === item ? "default" : "ghost"}
                aria-pressed={source === item}
                className="min-h-11 rounded-xl text-xs"
                onClick={() => setSource(item)}
              >
                {states[item]}
              </Button>
            ))}
          </div>
        ) : null}
        {scene === "search" ? (
          <div role="group" aria-label="Tipo de visita simulada" className="flex flex-wrap gap-2">
            <Button
              variant={mode === "agendado" ? "default" : "outline"}
              onClick={() => {
                setMode("agendado");
                setSelected(null);
              }}
            >
              Com agendamento
            </Button>
            <Button
              variant={mode === "novo" ? "default" : "outline"}
              onClick={() => setMode("novo")}
            >
              Novo cliente
            </Button>
            <p className="basis-full text-xs text-muted-foreground">
              Teste: pesquise “Cliente”; a validação usa quaisquer 4 dígitos e permanece local.
            </p>
          </div>
        ) : null}
        {scene === "queue" ? (
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={canManage}
              onChange={(event) => setCanManage(event.target.checked)}
              className="h-5 w-5"
            />
            Simular permissão para gerir a fila
          </label>
        ) : null}
        <p
          role="status"
          data-testid="checkin-fixture-action"
          className="text-xs leading-5 text-muted-foreground"
        >
          {notice}
        </p>
      </section>
      {scene === "welcome" ? (
        <TotemWelcomeView
          onChoose={(next) => {
            setMode(next);
            setSelected(null);
            setResults(null);
            setLast4("");
            openScene("search");
          }}
        />
      ) : null}
      {scene === "search" ? (
        <TotemSearchView
          mode={mode}
          term={term}
          onTermChange={setTerm}
          searching={source === "loading"}
          results={source === "empty" ? [] : results}
          selected={selected}
          onSelect={(next) => {
            setSelected(next);
            setError(null);
          }}
          last4={last4}
          onLast4Change={setLast4}
          validating={source === "loading"}
          name={name}
          onNameChange={setName}
          phone={phone}
          onPhoneChange={setPhone}
          error={simulatedError}
          onSearch={() => {
            setResults([candidate]);
            setNotice("Busca simulada: um cliente fictício localizado. Nada enviado.");
          }}
          onValidate={() => {
            setNotice("Identificação simulada: selecione um dos dois agendamentos fictícios.");
            openScene("confirm");
          }}
          onChooseOther={() => {
            setSelected(null);
            setLast4("");
            setError(null);
          }}
          onContinueNew={() => {
            if (name.trim().length < 2) {
              setError("Informe um nome fictício com pelo menos 2 caracteres.");
              return;
            }
            openScene("confirm");
          }}
          onBack={() => openScene("welcome")}
        />
      ) : null}
      {scene === "confirm" ? (
        <TotemConfirmView
          mode={mode}
          name={
            mode === "novo"
              ? name || "Novo Cliente Exemplo (fictício)"
              : "Cliente Exemplo (fictício)"
          }
          appointment={mode === "novo" ? null : appointment}
          appointments={mode === "novo" ? [] : appointments}
          onAppointmentChange={(id) =>
            setAppointment(appointments.find((item) => item.appointmentId === id) ?? null)
          }
          consent={consent}
          onConsentChange={setConsent}
          sending={source === "loading"}
          error={simulatedError}
          onConfirm={() => {
            setNotice(
              `Confirmação simulada · Agendamento ${appointment?.appointmentId ?? "sem agendamento"} · Comunicação ${consent ? "aceita" : "não aceita"}. Nada salvo ou enviado.`,
            );
            setSource("ready");
            setScene("done");
          }}
          onBack={() => openScene("search")}
        />
      ) : null}
      {scene === "done" ? (
        <TotemDoneView
          data={source === "empty" ? null : checkin}
          loading={source === "loading"}
          error={source === "error"}
          qrDataUrl={source === "qr" ? null : qr}
          qrFailed={source === "qr"}
          onRetry={() => {
            setSource("ready");
            setNotice("Nova leitura simulada. Nada enviado.");
          }}
          onDone={() => {
            setConsent(false);
            setAppointment(null);
            setSelected(null);
            setLast4("");
            setName("");
            setPhone("");
            openScene("welcome");
          }}
        />
      ) : null}
      {scene === "public" ? (
        <PublicCheckinView
          data={source === "empty" ? null : checkin}
          loading={source === "loading"}
          error={source === "error"}
          onRetry={() => setSource("ready")}
        />
      ) : null}
      {scene === "queue" ? (
        <QueuePageView
          count={
            source === "error" || source === "loading"
              ? null
              : source === "empty"
                ? 0
                : queue.length
          }
          refreshing={source === "loading"}
          onRefresh={() => {
            setSource("ready");
            setNotice("Atualização da fila simulada. Nada enviado.");
          }}
          onBack={() => openScene("welcome")}
        >
          <QueueView
            rows={source === "empty" ? [] : queue}
            loading={source === "loading"}
            error={source === "error"}
            showAll
            pending={false}
            canAct={() => canManage}
            now={now}
            onStatusChange={(row, status) => {
              setQueue((current) =>
                current.map((item) =>
                  item.id === row.id
                    ? {
                        ...item,
                        status,
                        startedAtISO:
                          status === "em_atendimento"
                            ? new Date(now).toISOString()
                            : item.startedAtISO,
                      }
                    : item,
                ),
              );
              setNotice(
                `Fila alterada apenas na simulação: ${row.codigo} → ${status}. Nenhuma presença real registrada.`,
              );
            }}
            onRetry={() => setSource("ready")}
          />
        </QueuePageView>
      ) : null}
    </div>
  );
}
