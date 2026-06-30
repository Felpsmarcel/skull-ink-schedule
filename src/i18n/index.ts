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
      nonExplicitSupportedLngs: true,
      load: "languageOnly",
      defaultNS: "common",
      ns: ["common"],
      interpolation: { escapeValue: false },
      detection: {
        order: ["localStorage", "navigator", "htmlTag"],
        caches: ["localStorage"],
        lookupLocalStorage: "gf-lang",
      },
    });
}

// Always (re)inject resources — survives HMR and JSON edits without restart.
// Each bundle has shape `{ common: {...} }`; register the inner object under
// the `common` namespace so `t("agenda.today")` resolves correctly.
for (const [lng, bundle] of Object.entries(BUNDLES)) {
  const inner = (bundle as Record<string, unknown>).common ?? bundle;
  i18n.addResourceBundle(lng, "common", inner, true, true);
}

export function ensureI18n() {
  return i18n;
}

export default i18n;