/**
 * Pilot scope for the light "Papel & Petróleo" identity.
 * Only these routes switch tokens; every other screen keeps the current theme.
 */
export const OPS_LIGHT_CLASS = "gf-ops-light";

export function isOpsLightPath(pathname: string): boolean {
  return (
    pathname === "/menu" ||
    pathname === "/agenda" ||
    pathname.startsWith("/agenda/") ||
    pathname === "/auth" ||
    pathname.startsWith("/auth/") ||
    pathname === "/projetos" ||
    pathname.startsWith("/projetos/") ||
    pathname === "/financeiro" ||
    pathname === "/painel-tatuador" ||
    pathname === "/appointments/new" ||
    pathname.startsWith("/appointments/new/") ||
    pathname === "/totem" ||
    pathname.startsWith("/totem/") ||
    pathname.startsWith("/a/") ||
    pathname === "/admin/fila" ||
    pathname === "/preview/ficha-projeto"
  );
}

/** Pre-paint script (inline in <head>) mirroring isOpsLightPath to avoid a dark flash. */
export const OPS_LIGHT_BOOT_SCRIPT = `(function(){try{var p=location.pathname;if(p==="/menu"||p==="/agenda"||p.indexOf("/agenda/")===0||p==="/auth"||p.indexOf("/auth/")===0||p==="/projetos"||p.indexOf("/projetos/")===0||p==="/financeiro"||p==="/painel-tatuador"||p==="/appointments/new"||p.indexOf("/appointments/new/")===0||p==="/totem"||p.indexOf("/totem/")===0||p.indexOf("/a/")===0||p==="/admin/fila"||p==="/preview/ficha-projeto"){document.documentElement.classList.add("${OPS_LIGHT_CLASS}")}}catch(e){}})();`;
