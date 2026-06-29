// Normalize an i18next language code to a BCP-47 tag safe for Intl APIs.
// Some environments (Chromium headless, certain Linux containers) expose
// `navigator.language` as `en-US@posix`, which i18next adopts and then
// crashes `Intl.DateTimeFormat`. Map the languages we actually ship.

export type SupportedLocale = "pt-PT" | "fr-FR" | "en-GB";

export function resolveIntlLocale(lang: string | undefined | null): SupportedLocale {
  const base = (lang ?? "").toLowerCase().split(/[-_@]/)[0];
  switch (base) {
    case "fr":
      return "fr-FR";
    case "en":
      return "en-GB";
    case "pt":
    default:
      return "pt-PT";
  }
}