import { useCallback, useEffect, useMemo, useState } from "react";
import { LanguageContext } from "./language-context";
import en from "./en";
import tl from "./tl";

const DICTIONARIES = { en, tl };
const LOCALES = { en: "en-PH", tl: "fil-PH" };
const STORAGE_KEY = "comunisolve-lang";

// localStorage can throw (private mode, blocked storage), so the app must work without it.
function savedLanguage() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value in DICTIONARIES ? value : "en";
  } catch {
    return "en";
  }
}

function fill(text, params) {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(savedLanguage);

  const setLang = useCallback((value) => {
    setLangState(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // The choice still applies until the page is closed.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo(() => {
    const dict = DICTIONARIES[lang];
    const lookup = (key) => dict[key] ?? en[key];

    function t(key, params) {
      let k = key;
      if (params && typeof params.count === "number") {
        const form = `${key}_${params.count === 1 ? "one" : "other"}`;
        if (lookup(form) !== undefined) k = form;
      }
      const text = lookup(k);
      if (text === undefined) {
        if (import.meta.env.DEV) console.warn(`[i18n] missing key: ${k}`);
        return k;
      }
      if (import.meta.env.DEV && dict[k] === undefined) console.warn(`[i18n] no ${lang} text for: ${k}`);
      return fill(text, params);
    }

    function label(prefix, value) {
      return lookup(`${prefix}.${value}`) ?? value;
    }

    function formatDate(value) {
      return value ? new Date(value).toLocaleDateString(LOCALES[lang], { dateStyle: "medium" }) : "";
    }

    function monthName(month) {
      return new Date(2000, month, 1).toLocaleDateString(LOCALES[lang], { month: "long" });
    }

    function formatDateTime(value) {
      return value ? new Date(value).toLocaleString(LOCALES[lang], { dateStyle: "medium", timeStyle: "short" }) : "";
    }

    function errorText(e, fallbackKey = "common.somethingWrong") {
      if (!e) return t(fallbackKey);
      if (e.key) return t(e.key, e.params);
      if (e.code === "account_suspended") {
        const { until, reason } = e.params || {};
        let text = until
          ? t("error.account_suspended_until", { until: formatDate(until) })
          : t("error.account_suspended");
        if (reason) text += t("error.suspension_reason", { reason });
        return text;
      }
      if (e.code && lookup(`error.${e.code}`) !== undefined) return t(`error.${e.code}`, e.params);
      if (e.name === "TypeError") return t("error.network");
      if (e.status >= 500) return t("error.server_error");
      return e.message || t(fallbackKey);
    }

    return { lang, setLang, t, label, formatDate, formatDateTime, monthName, errorText };
  }, [lang, setLang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
