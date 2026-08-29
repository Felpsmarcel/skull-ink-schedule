import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import gfMark from "@/assets/gf-mark.png";

const APP_NAME = "GF Tattoo Studio";
const SLUG = "gf-tattoo-studio";

export const Route = createFileRoute("/connect")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Ligar assistente de IA — GF Tattoo Studio" },
      {
        name: "description",
        content:
          "Instruções para ligar o ChatGPT, o Claude ou outro assistente de IA ao GF Tattoo Studio.",
      },
      { property: "og:title", content: "Ligar assistente de IA — GF Tattoo Studio" },
      {
        property: "og:description",
        content: "Ligue o seu assistente de IA à agenda e aos pagamentos do GF Tattoo Studio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConnectPage,
});

function useMcpUrl() {
  if (typeof window === "undefined") return "";
  return new URL("/mcp", window.location.origin).toString();
}

function CopyButton({ value, label = "Copiar" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      className="shrink-0"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          setDone(false);
        }
      }}
    >
      {done ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      <span className="ml-1.5">{done ? "Copiado" : label}</span>
    </Button>
  );
}

function ConnectPage() {
  const mcpUrl = useMcpUrl();
  const installCmd = `claude mcp add --scope user --transport http ${SLUG} '${mcpUrl.replace(/'/g, "'\\''")}'`;
  const chatgptDialog =
    "https://chatgpt.com/plugins#settings/Connectors?create-connector=true&redirectAfter=%2Fplugins";
  const claudeDialog = `https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=${encodeURIComponent(
    APP_NAME,
  )}&connectorUrl=${encodeURIComponent(mcpUrl)}`;

  return (
    <div className="min-h-svh bg-background pb-16 text-foreground">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur">
        <img src={gfMark} alt="" className="h-7 w-7 object-contain" />
        <h1 className="text-base font-bold uppercase tracking-wider">Ligar assistente de IA</h1>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        <p className="text-sm text-muted-foreground">
          Ligue o ChatGPT, o Claude ou outro assistente de IA a este aplicativo para consultar a
          agenda, os pagamentos registados e os tatuadores por conversa. Ao ligar, é pedido que
          inicie sessão nesta conta — o assistente vê apenas o que você já pode ver.
        </p>

        <section className="space-y-2 rounded-lg border border-border bg-card p-4">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Endereço do aplicativo
          </h2>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-3 py-2 font-mono text-sm">
              {mcpUrl}
            </code>
            <CopyButton value={mcpUrl} />
          </div>
          <p className="text-xs text-muted-foreground">
            É este endereço que cola no seu assistente nos passos abaixo.
          </p>
        </section>

        <Card title="ChatGPT">
          <Steps
            items={[
              <>
                Abra{" "}
                <A href="https://chatgpt.com/#settings/Connectors/Advanced">
                  Configurações → Conectores → Avançado
                </A>{" "}
                e ative o modo de desenvolvedor (leia o aviso de risco mostrado nessa página). Se a
                opção não aparecer, peça a um administrador do ChatGPT para a ativar.
              </>,
              <>
                Abra a <A href={chatgptDialog}>janela “New plugin”</A>.
              </>,
              <>
                No nome escreva <strong>{APP_NAME}</strong> e cole o endereço acima no campo do URL.
              </>,
              <>
                Reveja os dados, marque “I understand and want to continue” (o ChatGPT mostra este
                aviso para qualquer aplicativo externo) e clique em <strong>Create</strong>.
              </>,
              <>Ative o aplicativo na caixa de conversa e peça ao ChatGPT para o usar.</>,
            ]}
          />
        </Card>

        <Card title="Claude">
          <Steps
            items={[
              <>
                Abra a <A href={claudeDialog}>janela de conector personalizado</A> — o nome e o
                endereço já vêm preenchidos.
              </>,
              <>
                Reveja os dados e clique em <strong>Add</strong>.
              </>,
              <>
                Se o formulário não abrir preenchido, entre na página Connectors do Claude, escolha
                “Add custom connector”, dê um nome e cole o endereço acima.
              </>,
              <>Ative o conector na caixa de conversa e peça ao Claude para o usar.</>,
            ]}
          />
        </Card>

        <Card title="Claude Code">
          <Steps
            items={[
              <>
                Corra este comando num terminal:
                <div className="mt-2 flex items-center gap-2">
                  <code className="min-w-0 flex-1 overflow-x-auto whitespace-pre rounded-md bg-muted px-3 py-2 font-mono text-xs">
                    {installCmd}
                  </code>
                  <CopyButton value={installCmd} />
                </div>
              </>,
              <>
                Abra o Claude Code e corra <code className="font-mono">/mcp</code> para confirmar a
                ligação. É nesse menu que inicia sessão nesta conta.
              </>,
              <>Peça ao Claude Code para usar o aplicativo.</>,
            ]}
          />
        </Card>

        <Card title="Outros assistentes de IA">
          <Steps
            items={[
              <>Abra as definições de conectores ou servidores MCP do assistente.</>,
              <>Crie uma ligação a um servidor remoto.</>,
              <>Dê um nome à ligação e cole o endereço acima.</>,
              <>Conclua o pedido de início de sessão ou autorização.</>,
              <>Ative a ligação e peça ao assistente para usar o aplicativo.</>,
            ]}
          />
        </Card>

        <Card title="Atualizar depois de mudanças no aplicativo">
          <p className="mb-3 text-sm text-muted-foreground">
            O assistente guarda em cache o que o aplicativo sabe fazer. Depois de publicarmos
            novidades, atualize a ligação:
          </p>
          <h3 className="mb-1 text-xs font-bold uppercase tracking-wider">ChatGPT</h3>
          <Steps
            items={[
              <>Abra a página Plugins e escolha este aplicativo.</>,
              <>
                Desça até “Information” e clique em <strong>Refresh</strong>.
              </>,
              <>
                O ChatGPT não consegue alterar o endereço de um aplicativo já criado — se ele mudar,
                apague o aplicativo em Plugins e repita os passos de ligação com o endereço atual.
              </>,
              <>Comece uma conversa nova e peça ao ChatGPT para usar o aplicativo.</>,
            ]}
          />
          <h3 className="mb-1 mt-4 text-xs font-bold uppercase tracking-wider">Claude</h3>
          <Steps
            items={[
              <>Abra a página Connectors e escolha este conector.</>,
              <>Atualize as ferramentas do conector.</>,
              <>
                O Claude não consegue alterar o endereço de um conector já criado — se ele mudar,
                remova o conector e repita os passos de ligação.
              </>,
              <>Peça ao Claude para usar o aplicativo.</>,
            ]}
          />
          <h3 className="mb-1 mt-4 text-xs font-bold uppercase tracking-wider">Claude Code</h3>
          <Steps
            items={[
              <>Comece uma sessão nova — ela carrega a versão mais recente ao ligar.</>,
              <>
                Se o endereço mudou, corra{" "}
                <code className="font-mono">claude mcp remove {SLUG}</code> e volte a correr o
                comando de instalação com o endereço atual.
              </>,
              <>Peça ao Claude Code para usar o aplicativo.</>,
            ]}
          />
          <h3 className="mb-1 mt-4 text-xs font-bold uppercase tracking-wider">
            Outros assistentes
          </h3>
          <Steps
            items={[
              <>Abra as definições de conectores ou servidores MCP.</>,
              <>Escolha a ligação criada para este aplicativo.</>,
              <>Atualize a lista de ferramentas, recarregue ou volte a ligar o servidor.</>,
              <>Se o endereço mudou, cole o endereço atual mostrado acima.</>,
              <>Comece uma conversa nova e peça ao assistente para usar o aplicativo.</>,
            ]}
          />
        </Card>
      </main>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wider">{title}</h2>
      {children}
    </section>
  );
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="ml-4 list-decimal space-y-2 text-sm">
      {items.map((item, i) => (
        <li key={i} className="pl-1">
          {item}
        </li>
      ))}
    </ol>
  );
}

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 font-semibold underline underline-offset-2"
    >
      {children}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}
