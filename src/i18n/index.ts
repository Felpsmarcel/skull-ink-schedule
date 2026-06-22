import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import pt from "./locales/pt.json";
import fr from "./locales/fr.json";
import en from "./locales/en.json";

export const SUPPORTED_LANGUAGES = ["pt", "fr", "en"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const BUNDLES = { pt, fr, en } as const;

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: BUNDLES,
      fallbackLng: "pt",
      lng: typeof window === "undefined" ? "pt" : undefined,
      supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
      defaultNS: "common",
      ns: ["common"],
      interpolation: { escapeValue: false },
      detection: {
        order: ["localStorage", "navigator"],
        caches: ["localStorage"],
        lookupLocalStorage: "gf-lang",
      },
    });
}

// Always (re)inject resources — survives HMR and JSON edits without restart.
for (const [lng, bundle] of Object.entries(BUNDLES)) {
  // bundle has shape { common: {...} }
  for (const [ns, res] of Object.entries(bundle as Record<string, unknown>)) {
    i18n.addResourceBundle(lng, ns, res, true, true);
  }
}

export default i18n;