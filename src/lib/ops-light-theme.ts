/**
 * Pilot scope for the light "Papel & Petróleo" identity.
 * Only these routes switch tokens; every other screen keeps the current theme.
 */
export const OPS_LIGHT_CLASS = "gf-ops-light";

export function isOpsLightPath(pathname: string): boolean {
  return (
    pathname === "/agenda" ||
    pathname.startsWith("/agenda/") ||
    pathname === "/auth" ||
    pathname.startsWith("/auth/") ||
    pathname === "/projetos" ||
    pathname.startsWith("/projetos/") ||
    pathname === "/financeiro" ||
    pathname === "/painel-tatuador" ||
    pathname === "/preview/ficha-projeto"
  );
}

/** Pre-paint script (inline in <head>) mirroring isOpsLightPath to avoid a dark flash. */
export const OPS_LIGHT_BOOT_SCRIPT = `(function(){try{var p=location.pathname;if(p==="/agenda"||p.indexOf("/agenda/")===0||p==="/auth"||p.indexOf("/auth/")===0||p==="/projetos"||p.indexOf("/projetos/")===0||p==="/financeiro"||p==="/painel-tatuador"||p==="/preview/ficha-projeto"){document.documentElement.classList.add("${OPS_LIGHT_CLASS}")}}catch(e){}})();`;
