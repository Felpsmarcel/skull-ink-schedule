/**
 * Shared "Papel & Petróleo" identity for the studio's application screens.
 * Explicit route families keep service endpoints and external consent pages out.
 * The initial paint and client-side navigation consume the same route list.
 */
export const OPS_LIGHT_CLASS = "gf-ops-light";

const APP_ROUTE_FAMILIES = [
  "/home",
  "/menu",
  "/agenda",
  "/auth",
  "/projetos",
  "/financeiro",
  "/painel-tatuador",
  "/appointments/new",
  "/totem",
  "/a",
  "/admin/fila",
  "/admin/equipe",
  "/admin/vendedores",
  "/admin/configuracoes",
  "/admin/movimentacao-links",
  "/admin/movimentacao/novo",
  "/admin/saude",
  "/reconciliar",
  "/relatorios/agendamentos",
  "/relatorios/movimentacoes",
  "/movimentacao",
  "/onboarding",
  "/reviews",
  "/services",
  "/connect",
  "/ghl-test",
  "/preview/ficha-projeto",
] as const;

export function isOpsLightPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    APP_ROUTE_FAMILIES.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  );
}

/** Runs before paint; serialized route data prevents a second hand-maintained list. */
export const OPS_LIGHT_BOOT_SCRIPT = `(function(){try{var p=location.pathname,r=${JSON.stringify(APP_ROUTE_FAMILIES)};if(p==="/"||r.some(function(s){return p===s||p.indexOf(s+"/")===0})){document.documentElement.classList.add("${OPS_LIGHT_CLASS}")}}catch(e){}})();`;
