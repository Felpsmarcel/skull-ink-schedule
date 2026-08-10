import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, Search } from "lucide-react";
import {
  searchTotemClientes,
  validateTotemTelefone,
  type TotemCandidate,
} from "@/lib/checkin.functions";
import { useTotemDraft } from "@/stores/totem-checkin";

export const Route = createFileRoute("/totem/buscar")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Identificação — Check-in GF Tattoo" },
      { name: "description", content: "Encontre o seu registo para confirmar a chegada." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: TotemBuscar,
});

function TotemBuscar() {
  const navigate = useNavigate();
  const { modo, setSession, setNovo } = useTotemDraft();
  const search = useServerFn(searchTotemClientes);
  const validate = useServerFn(validateTotemTelefone);

  const [termo, setTermo] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<TotemCandidate[] | null>(null);
  const [selecionado, setSelecionado] = useState<TotemCandidate | null>(null);
  const [last4, setLast4] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [validando, setValidando] = useState(false);

  // Cliente novo: nome + telefone, sem busca.
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");

  async function fazerBusca() {
    setErro(null);
    setBuscando(true);
    try {
      const rows = await search({ data: { query: termo } });
      setResultados(rows);
    } catch {
      setErro("Não foi possível pesquisar agora. Chame a equipa.");
    } finally {
      setBuscando(false);
    }
  }

  async function confirmarTelefone() {
    if (!selecionado) return;
    setErro(null);
    setValidando(true);
    try {
      const res = await validate({ data: { contactId: selecionado.contactId, last4 } });
      if (!res.ok || !res.session) {
        setErro("Os números não coincidem. Tente novamente.");
        return;
      }
      setSession(res.session);
      navigate({ to: "/totem/confirmar" });
    } catch {
      setErro("Não foi possível validar agora. Chame a equipa.");
    } finally {
      setValidando(false);
    }
  }

  function seguirComoNovo() {
    if (nome.trim().length < 2) {
      setErro("Escreva o seu nome completo.");
      return;
    }
    setNovo(nome.trim(), telefone.trim());
    setSession(null);
    navigate({ to: "/totem/confirmar" });
  }

  return (
    <div className="min-h-svh bg-background px-6 py-10 text-foreground">
      <header className="mx-auto mb-8 flex w-full max-w-md items-center gap-3">
        <Link to="/totem" className="rounded-md p-3 hover:bg-muted" aria-label="Voltar">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-bold uppercase tracking-wider">
          {modo === "novo" ? "Novo cliente" : "Identificação"}
        </h1>
      </header>

      <div className="mx-auto w-full max-w-md space-y-5">
        {modo === "novo" ? (
          <>
            <Field label="Nome completo">
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                autoFocus
                className="h-14 w-full rounded-lg border border-border bg-card px-4 text-lg"
                placeholder="Como devemos chamá-lo?"
              />
            </Field>
            <Field label="Telefone (opcional)">
              <input
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                inputMode="tel"
                className="h-14 w-full rounded-lg border border-border bg-card px-4 text-lg"
                placeholder="+32 ..."
              />
            </Field>
            {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
            <button
              type="button"
              onClick={seguirComoNovo}
              className="h-16 w-full rounded-xl bg-primary text-base font-bold uppercase tracking-wider text-primary-foreground active:scale-[0.98]"
            >
              Continuar
            </button>
          </>
        ) : selecionado ? (
          <>
            <p className="text-base text-muted-foreground">
              Para sua segurança, escreva os <strong>4 últimos dígitos</strong> do telefone de{" "}
              <strong>{selecionado.nomeMascarado}</strong>{" "}
              {selecionado.telefoneMascarado ? `(${selecionado.telefoneMascarado})` : null}
            </p>
            <input
              value={last4}
              onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
              inputMode="numeric"
              autoFocus
              className="h-20 w-full rounded-lg border border-border bg-card text-center text-4xl tracking-[0.5em]"
              placeholder="0000"
            />
            {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
            <button
              type="button"
              disabled={last4.length !== 4 || validando}
              onClick={confirmarTelefone}
              className="flex h-16 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
            >
              {validando ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
              Confirmar
            </button>
            <button
              type="button"
              onClick={() => {
                setSelecionado(null);
                setLast4("");
                setErro(null);
              }}
              className="h-12 w-full rounded-lg border border-border text-sm uppercase tracking-wider text-muted-foreground"
            >
              Escolher outro registo
            </button>
          </>
        ) : (
          <>
            <Field label="Nome ou telefone">
              <div className="flex gap-2">
                <input
                  value={termo}
                  onChange={(e) => setTermo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") fazerBusca();
                  }}
                  autoFocus
                  className="h-14 flex-1 rounded-lg border border-border bg-card px-4 text-lg"
                  placeholder="Ex.: Maria ou 471..."
                />
                <button
                  type="button"
                  onClick={fazerBusca}
                  disabled={termo.trim().length < 3 || buscando}
                  className="grid h-14 w-14 place-items-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
                  aria-label="Pesquisar"
                >
                  {buscando ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Search className="h-5 w-5" />
                  )}
                </button>
              </div>
            </Field>

            {erro ? <p className="text-sm text-destructive">{erro}</p> : null}

            {resultados?.length === 0 ? (
              <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                Não encontrámos o seu registo. Verifique o nome ou chame a equipa.
              </div>
            ) : null}

            <ul className="space-y-3">
              {(resultados ?? []).map((c) => (
                <li key={c.contactId}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelecionado(c);
                      setErro(null);
                    }}
                    disabled={!c.temTelefone}
                    className="flex min-h-20 w-full flex-col items-start justify-center gap-1 rounded-lg border border-border bg-card px-4 py-3 text-left disabled:opacity-50"
                  >
                    <span className="text-lg font-semibold">{c.nomeMascarado}</span>
                    <span className="text-xs text-muted-foreground">
                      {c.telefoneMascarado ?? "sem telefone registado"}
                      {c.agendamentoHoje ? " • tem agendamento hoje" : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
