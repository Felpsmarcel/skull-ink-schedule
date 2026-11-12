import type { ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  Check,
  Clock,
  Loader2,
  Search,
  UserPlus,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import type { CheckinPublicView, TotemCandidate } from "@/lib/checkin.functions";
import { CHECKIN_STATUS_LABEL, checkinTime } from "@/components/checkin/checkin-presentation";
import gfMark from "@/assets/gf-mark.png";

function TotemShell({
  title,
  description,
  onBack,
  children,
  step,
}: {
  title: string;
  description?: string;
  onBack?: () => void;
  children: ReactNode;
  step?: string;
}) {
  return (
    <div className="min-h-svh bg-background px-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+1.5rem)] text-foreground sm:px-6 sm:pt-10">
      <div className="mx-auto w-full max-w-lg">
        <header className="mb-7">
          <div className="mb-7 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <img src={gfMark} alt="" className="h-11 w-11 rounded-xl object-contain" />
              <span className="text-xs font-semibold tracking-wide">GF Tattoo Studio</span>
            </div>
            {onBack ? (
              <Button
                variant="ghost"
                size="icon"
                type="button"
                onClick={onBack}
                aria-label="Voltar"
                className="rounded-xl"
              >
                <ArrowLeft aria-hidden="true" />
              </Button>
            ) : null}
          </div>
          {step ? (
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
              {step}
            </p>
          ) : null}
          <h1 className="break-words font-display text-3xl font-bold leading-tight sm:text-4xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
          ) : null}
        </header>
        <main className="space-y-5">{children}</main>
      </div>
    </div>
  );
}

export function TotemWelcomeView({ onChoose }: { onChoose: (mode: "agendado" | "novo") => void }) {
  return (
    <TotemShell
      title="Que bom ter você aqui."
      description="Confirme sua chegada com o apoio da recepção. A equipe acompanha o atendimento por aqui."
      step="Check-in na recepção"
    >
      <div className="space-y-3">
        <WelcomeChoice
          title="Tenho agendamento"
          description="Encontre seu cadastro e confirme a chegada."
          icon={<CalendarCheck />}
          primary
          onClick={() => onChoose("agendado")}
        />
        <WelcomeChoice
          title="Sou um novo cliente"
          description="Identifique-se para falar com a nossa equipe."
          icon={<UserPlus />}
          onClick={() => onChoose("novo")}
        />
      </div>
      <p className="pt-3 text-center text-xs leading-5 text-muted-foreground">
        Este check-in usa o acesso da recepção. Peça ajuda à equipe para continuar.
      </p>
    </TotemShell>
  );
}
function WelcomeChoice({
  title,
  description,
  icon,
  primary = false,
  onClick,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-28 w-full items-center gap-4 rounded-2xl border p-5 text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none ${primary ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90" : "border-border bg-card hover:border-primary/40"}`}
    >
      <span
        aria-hidden="true"
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${primary ? "bg-white/10" : "bg-accent text-primary"}`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block text-base sm:text-lg">{title}</strong>
        <span
          className={`mt-1 block text-xs leading-5 ${primary ? "text-primary-foreground/80" : "text-muted-foreground"}`}
        >
          {description}
        </span>
      </span>
      <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
    </button>
  );
}

export interface TotemSearchViewProps {
  mode: "agendado" | "novo" | null;
  term: string;
  onTermChange: (value: string) => void;
  searching: boolean;
  results: TotemCandidate[] | null;
  selected: TotemCandidate | null;
  onSelect: (candidate: TotemCandidate) => void;
  last4: string;
  onLast4Change: (value: string) => void;
  validating: boolean;
  name: string;
  onNameChange: (value: string) => void;
  phone: string;
  onPhoneChange: (value: string) => void;
  error: string | null;
  onSearch: () => void;
  onValidate: () => void;
  onChooseOther: () => void;
  onContinueNew: () => void;
  onBack: () => void;
}

export function TotemSearchView(props: TotemSearchViewProps) {
  const isNew = props.mode === "novo";
  return (
    <TotemShell
      title={
        isNew
          ? "Como podemos chamar você?"
          : props.selected
            ? "Confirme seu telefone."
            : "Vamos encontrar seu cadastro."
      }
      description={
        isNew
          ? "Preencha seus dados para a equipe identificar sua chegada."
          : props.selected
            ? "Essa confirmação ajuda a identificar o cadastro selecionado."
            : "Digite pelo menos 3 caracteres do seu nome ou telefone."
      }
      step="01 · Identificação"
      onBack={props.onBack}
    >
      {isNew ? (
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            props.onContinueNew();
          }}
        >
          <Field label="Nome completo">
            <Input
              aria-label="Nome completo"
              value={props.name}
              onChange={(event) => props.onNameChange(event.target.value)}
              autoComplete="off"
              autoFocus
              className="h-14 rounded-xl text-base"
              placeholder="Seu nome completo"
            />
          </Field>
          <Field label="Telefone (opcional)">
            <Input
              aria-label="Telefone (opcional)"
              value={props.phone}
              onChange={(event) => props.onPhoneChange(event.target.value)}
              autoComplete="off"
              type="tel"
              inputMode="tel"
              className="h-14 rounded-xl text-base"
              placeholder="+32 ..."
            />
          </Field>
          <InlineError message={props.error} />
          <Button type="submit" className="h-14 w-full rounded-xl">
            Continuar
            <ArrowRight aria-hidden="true" />
          </Button>
        </form>
      ) : props.selected ? (
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (props.last4.length === 4 && !props.validating) props.onValidate();
          }}
        >
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Cadastro selecionado</p>
            <p className="mt-1 break-words font-semibold">{props.selected.nomeMascarado}</p>
          </div>
          <Field label="Últimos 4 dígitos do telefone">
            <Input
              aria-label="Últimos 4 dígitos do telefone"
              value={props.last4}
              onChange={(event) =>
                props.onLast4Change(event.target.value.replace(/\D/g, "").slice(0, 4))
              }
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              aria-describedby="phone-check-help"
              className="h-20 rounded-xl text-center text-3xl tracking-[0.4em] md:text-3xl"
              placeholder="0000"
            />
            <span id="phone-check-help" className="block text-xs leading-5 text-muted-foreground">
              Use o telefone informado ao estúdio. Se precisar, chame a recepção.
            </span>
          </Field>
          <InlineError message={props.error} />
          <Button
            type="submit"
            disabled={props.last4.length !== 4 || props.validating}
            className="h-14 w-full rounded-xl"
          >
            {props.validating ? (
              <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
            ) : null}
            {props.validating ? "Verificando…" : "Confirmar telefone"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={props.onChooseOther}
            disabled={props.validating}
            className="h-12 w-full rounded-xl"
          >
            Escolher outro cadastro
          </Button>
        </form>
      ) : (
        <div className="space-y-5">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (props.term.trim().length >= 3 && !props.searching) props.onSearch();
            }}
          >
            <Field label="Nome ou telefone">
              <div className="flex min-w-0 gap-2">
                <Input
                  aria-label="Nome ou telefone"
                  value={props.term}
                  onChange={(event) => props.onTermChange(event.target.value)}
                  autoComplete="off"
                  autoFocus
                  className="h-14 min-w-0 flex-1 rounded-xl text-base"
                  placeholder="Ex.: Maria ou 471..."
                />
                <Button
                  type="submit"
                  disabled={props.term.trim().length < 3 || props.searching}
                  className="h-14 w-14 shrink-0 rounded-xl"
                  aria-label="Pesquisar cadastro"
                >
                  {props.searching ? (
                    <Loader2
                      aria-hidden="true"
                      className="animate-spin motion-reduce:animate-none"
                    />
                  ) : (
                    <Search aria-hidden="true" />
                  )}
                </Button>
              </div>
            </Field>
          </form>
          <InlineError message={props.error} />
          {props.searching ? (
            <p role="status" className="text-sm text-muted-foreground">
              Buscando cadastros…
            </p>
          ) : props.results?.length === 0 ? (
            <div
              role="status"
              className="rounded-2xl border border-dashed border-border bg-card p-5 text-sm leading-6 text-muted-foreground"
            >
              Não encontramos um cadastro nesta busca. Verifique os dados ou fale com a recepção.
            </div>
          ) : null}
          {!props.searching ? (
            <ul className="space-y-3" aria-label="Cadastros encontrados">
              {(props.results ?? []).map((candidate) => (
                <li key={candidate.contactId}>
                  <button
                    type="button"
                    onClick={() => props.onSelect(candidate)}
                    disabled={!candidate.temTelefone}
                    className="flex min-h-24 w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-sm hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                  >
                    <span className="min-w-0">
                      <strong className="block break-words text-base">
                        {candidate.nomeMascarado}
                      </strong>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                        {candidate.telefoneMascarado ?? "Sem telefone cadastrado"}
                        {candidate.agendamentoHoje ? " · Agendamento localizado hoje" : ""}
                      </span>
                      {!candidate.temTelefone ? (
                        <span className="mt-1 block text-xs text-muted-foreground">
                          A recepção pode ajudar a identificar seu cadastro.
                        </span>
                      ) : null}
                    </span>
                    <ArrowRight
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                    />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </TotemShell>
  );
}

export interface TotemConfirmViewProps {
  mode: "agendado" | "novo" | null;
  name: string;
  appointment: TotemCandidate["agendamentoHoje"];
  appointments?: NonNullable<TotemCandidate["agendamentoHoje"]>[];
  onAppointmentChange?: (appointmentId: string) => void;
  consent: boolean;
  onConsentChange: (value: boolean) => void;
  sending: boolean;
  error: string | null;
  onConfirm: () => void;
  onBack: () => void;
}
export function TotemConfirmView(props: TotemConfirmViewProps) {
  const needsAppointment = (props.appointments?.length ?? 0) > 1 && !props.appointment;
  return (
    <TotemShell
      title="Tudo certo para sua chegada?"
      description="Confira os dados antes de registrar o check-in."
      step="02 · Confirmar chegada"
      onBack={props.onBack}
    >
      {(props.appointments?.length ?? 0) > 1 ? (
        <label className="block space-y-2 rounded-2xl border border-border bg-card p-4">
          <span className="text-sm font-semibold">Qual agendamento você veio atender?</span>
          <span className="block text-xs leading-5 text-muted-foreground">
            Há mais de um agendamento hoje. Selecione o horário e o tatuador com a recepção.
          </span>
          <select
            aria-label="Agendamento para confirmar chegada"
            value={props.appointment?.appointmentId ?? ""}
            onChange={(event) => props.onAppointmentChange?.(event.target.value)}
            disabled={props.sending || !props.onAppointmentChange}
            className="min-h-14 w-full min-w-0 max-w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            <option value="">Selecione o agendamento</option>
            {props.appointments?.map((appointment) => (
              <option key={appointment.appointmentId} value={appointment.appointmentId}>
                {checkinTime(appointment.scheduledAtISO)} ·{" "}
                {appointment.artistNome ?? "Tatuador a confirmar"}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <Detail icon={<UserRound />} label="Cliente" value={props.name} />
        {props.appointment ? (
          <>
            <Detail
              icon={<Clock />}
              label="Horário agendado"
              value={checkinTime(props.appointment.scheduledAtISO)}
            />
            <Detail
              icon={<CalendarCheck />}
              label="Tatuador"
              value={props.appointment.artistNome ?? "A confirmar"}
            />
            <p className="border-t border-border pt-3 text-xs text-muted-foreground">
              Horário de Bruxelas
            </p>
          </>
        ) : (
          <p className="border-t border-border pt-4 text-sm leading-6 text-muted-foreground">
            {needsAppointment
              ? "Escolha o agendamento antes de confirmar sua chegada."
              : props.mode === "novo"
                ? "Primeira visita. A recepção orientará os próximos passos."
                : "Não há agendamento localizado para hoje. A recepção pode conferir com você."}
          </p>
        )}
      </div>
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-card p-4 text-sm leading-6">
        <input
          type="checkbox"
          checked={props.consent}
          onChange={(event) => props.onConsentChange(event.target.checked)}
          disabled={props.sending}
          className="mt-1 h-5 w-5 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span>
          Aceito receber a confirmação do atendimento por WhatsApp ou SMS.
          <span className="mt-1 block text-xs text-muted-foreground">
            Opcional. Você pode confirmar sua chegada sem aceitar.
          </span>
        </span>
      </label>
      <InlineError message={props.error} />
      <Button
        type="button"
        onClick={props.onConfirm}
        disabled={props.sending || needsAppointment}
        className="h-auto min-h-16 w-full whitespace-normal rounded-xl px-4 py-4 text-base"
      >
        {props.sending ? (
          <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
        ) : (
          <Check aria-hidden="true" />
        )}
        {props.sending ? "Registrando chegada…" : "Confirmar minha chegada"}
      </Button>
    </TotemShell>
  );
}

export interface TotemDoneViewProps {
  data: CheckinPublicView | null | undefined;
  loading: boolean;
  error: boolean;
  qrDataUrl: string | null;
  qrFailed: boolean;
  onRetry: () => void;
  onDone: () => void;
}
export function TotemDoneView({
  data,
  loading,
  error,
  qrDataUrl,
  qrFailed,
  onRetry,
  onDone,
}: TotemDoneViewProps) {
  const confirmed = Boolean(data && !data.expirado && !loading && !error);
  return (
    <TotemShell
      title={confirmed ? "Chegada registrada." : "Confira seu atendimento."}
      description={
        confirmed
          ? "Guarde seu código para acompanhar o atendimento."
          : "A recepção pode ajudar se os dados não aparecerem."
      }
    >
      {loading ? (
        <PendingState />
      ) : error || !data ? (
        <UnavailableState onRetry={onRetry} />
      ) : data.expirado ? (
        <ExpiredState />
      ) : (
        <>
          <div className="rounded-2xl border border-border bg-card p-5 text-center shadow-sm">
            <p className="text-xs text-muted-foreground">Seu código de atendimento</p>
            <p
              data-testid="checkin-codigo"
              className="mt-2 break-words font-display text-4xl font-bold tracking-wider"
            >
              {data.codigo}
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              {CHECKIN_STATUS_LABEL[data.status]}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 text-center">
            {qrDataUrl ? (
              <img
                data-testid="checkin-qr"
                src={qrDataUrl}
                alt="QR Code do seu atendimento"
                className="mx-auto h-auto w-full max-w-64 rounded-lg"
              />
            ) : qrFailed ? (
              <p role="status" className="px-3 py-8 text-sm text-muted-foreground">
                Não foi possível mostrar o QR Code. Guarde seu código e fale com a recepção.
              </p>
            ) : (
              <PendingState label="Preparando QR Code…" />
            )}
            <p className="mx-auto mt-3 max-w-xs text-xs leading-5 text-muted-foreground">
              Leia com seu telefone para acompanhar o atendimento. Mantenha este link com você.
            </p>
          </div>
        </>
      )}
      <Button type="button" variant="outline" onClick={onDone} className="h-14 w-full rounded-xl">
        Concluir
      </Button>
    </TotemShell>
  );
}

export function PublicCheckinView({
  data,
  loading,
  error,
  onRetry,
}: {
  data: CheckinPublicView | null | undefined;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  return (
    <TotemShell
      title="Seu atendimento."
      description="Acompanhe o status registrado pela equipe do estúdio."
    >
      {loading ? (
        <PendingState />
      ) : error || !data ? (
        <UnavailableState onRetry={onRetry} />
      ) : data.expirado ? (
        <ExpiredState />
      ) : (
        <>
          <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
            <p className="text-xs text-muted-foreground">Código de atendimento</p>
            <p
              data-testid="publico-codigo"
              className="mt-2 break-words font-display text-4xl font-bold tracking-wider"
            >
              {data.codigo}
            </p>
            <StatusBadge
              data-testid="publico-status"
              variant={
                data.status === "em_atendimento"
                  ? "info"
                  : data.status === "concluido"
                    ? "success"
                    : "neutral"
              }
              className="mt-4 whitespace-normal rounded-full"
            >
              {CHECKIN_STATUS_LABEL[data.status]}
            </StatusBadge>
          </div>
          <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <Detail
              icon={<Clock />}
              label="Horário agendado"
              value={checkinTime(data.scheduledAtISO)}
            />
            <Detail
              icon={<UserRound />}
              label="Tatuador"
              value={data.tatuadorPrimeiroNome ?? "A confirmar"}
            />
            <Detail
              icon={<Check />}
              label="Chegada registrada"
              value={checkinTime(data.arrivedAtISO)}
            />
            <p className="border-t border-border pt-3 text-xs text-muted-foreground">
              Horários de Bruxelas
            </p>
          </div>
          {data.status === "aguardando" ? (
            <p className="rounded-xl bg-accent/50 p-4 text-sm leading-6 text-muted-foreground">
              Aguarde no espaço de espera. Fale com a recepção se precisar de ajuda.
            </p>
          ) : null}
        </>
      )}
    </TotemShell>
  );
}

function Detail({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span aria-hidden="true" className="mt-0.5 shrink-0 text-primary [&>svg]:h-4 [&>svg]:w-4">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 break-words text-base font-semibold">{value}</p>
      </div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="block space-y-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </div>
  );
}
function InlineError({ message }: { message: string | null }) {
  return message ? (
    <p
      role="alert"
      className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm leading-6 text-destructive"
    >
      {message}
    </p>
  ) : null;
}
function PendingState({ label = "Carregando atendimento…" }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-3 rounded-2xl border border-border bg-card px-4 py-10 text-sm text-muted-foreground"
    >
      <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
      {label}
    </div>
  );
}
function UnavailableState({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="status"
      className="space-y-4 rounded-2xl border border-border bg-card p-5 text-sm leading-6"
    >
      <p>
        Não foi possível localizar o atendimento nesta leitura. Confira com a recepção antes de
        registrar novamente.
      </p>
      <Button type="button" variant="outline" onClick={onRetry} className="min-h-11 rounded-xl">
        Tentar novamente
      </Button>
    </div>
  );
}
function ExpiredState() {
  return (
    <p
      role="status"
      className="rounded-2xl border border-border bg-card p-5 text-sm leading-6 text-muted-foreground"
    >
      Este link expirou. Ele é válido apenas no dia do atendimento. Fale com a recepção se precisar
      de ajuda.
    </p>
  );
}
