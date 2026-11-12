import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { TotemSearchView } from "@/components/checkin/totem-views";
import {
  searchTotemClientes,
  validateTotemTelefone,
  type TotemCandidate,
} from "@/lib/checkin.functions";
import { checkinRequestError } from "@/components/checkin/checkin-presentation";
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
    } catch (error) {
      setResultados(null);
      setErro(checkinRequestError(error, "Não foi possível pesquisar agora. Chame a equipe."));
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
    } catch (error) {
      setErro(checkinRequestError(error, "Não foi possível validar agora. Chame a equipe."));
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
    <TotemSearchView
      mode={modo}
      term={termo}
      onTermChange={setTermo}
      searching={buscando}
      results={resultados}
      selected={selecionado}
      onSelect={(candidate) => {
        setSelecionado(candidate);
        setErro(null);
      }}
      last4={last4}
      onLast4Change={setLast4}
      validating={validando}
      name={nome}
      onNameChange={setNome}
      phone={telefone}
      onPhoneChange={setTelefone}
      error={erro}
      onSearch={() => void fazerBusca()}
      onValidate={() => void confirmarTelefone()}
      onChooseOther={() => {
        setSelecionado(null);
        setLast4("");
        setErro(null);
      }}
      onContinueNew={seguirComoNovo}
      onBack={() => navigate({ to: "/totem" })}
    />
  );
}
