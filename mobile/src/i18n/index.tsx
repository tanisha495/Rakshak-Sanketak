import {
  createContext,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { getStoredLanguage, saveStoredLanguage } from "./language-storage";
import { as } from "./translations/as";
import { en } from "./translations/en";
import { hi } from "./translations/hi";
import type { AppLanguage, TranslationDictionary, TranslationKey } from "./types";

const translations: Record<AppLanguage, TranslationDictionary> = {
  en,
  hi,
  as,
};

interface LanguageContextValue {
  hasSelectedLanguage: boolean;
  isReady: boolean;
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => Promise<void>;
  t: (key: TranslationKey) => string;
}

export const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [hasSelectedLanguage, setHasSelectedLanguage] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [language, setLanguageState] = useState<AppLanguage>("en");

  useEffect(() => {
    let mounted = true;

    getStoredLanguage()
      .then((storedLanguage) => {
        if (!mounted) {
          return;
        }

        if (storedLanguage) {
          setLanguageState(storedLanguage);
          setHasSelectedLanguage(true);
        }
      })
      .finally(() => {
        if (mounted) {
          setIsReady(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const setLanguage = useCallback(async (nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage);
    setHasSelectedLanguage(true);
    await saveStoredLanguage(nextLanguage);
  }, []);

  const t = useCallback(
    (key: TranslationKey) => {
      const parts = key.split(".");
      let value: unknown = translations[language];

      for (const part of parts) {
        if (typeof value !== "object" || value === null) {
          return key;
        }

        value = (value as Record<string, unknown>)[part];
      }

      return typeof value === "string" ? value : key;
    },
    [language],
  );

  const contextValue = useMemo(
    () => ({
      hasSelectedLanguage,
      isReady,
      language,
      setLanguage,
      t,
    }),
    [hasSelectedLanguage, isReady, language, setLanguage, t],
  );

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

export type { AppLanguage, TranslationKey };
