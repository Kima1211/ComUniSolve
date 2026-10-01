import { createContext, useContext } from "react";

export const LanguageContext = createContext(null);

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === null) {
    throw new Error("useLanguage must be used inside <LanguageProvider>");
  }
  return context;
}
