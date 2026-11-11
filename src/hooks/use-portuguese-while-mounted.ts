import { useEffect } from "react";
import i18n from "@/i18n";

/** Mostra menu e textos em PT-BR enquanto a ficha está aberta; restaura o idioma ao sair. */
export function usePortugueseWhileMounted() {
  useEffect(() => {
    const previous = i18n.language;
    if (!previous?.startsWith("pt")) void i18n.changeLanguage("pt");
    return () => {
      if (previous && !previous.startsWith("pt")) void i18n.changeLanguage(previous);
    };
  }, []);
}
