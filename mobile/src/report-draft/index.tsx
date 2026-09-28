import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Alert } from "react-native";

import type { AppLanguage } from "@/i18n";
import { useLanguage } from "@/i18n/use-language";
import {
  clearActiveReportDraft,
  getActiveReportDraft,
  saveActiveReportDraft,
} from "@/services/draft-repository";

export type ReportingMethod = "voice" | "text" | "photo";
export type ReportSite = "Mathura" | "Barauni" | "Digboi" | "Panipat";

export interface ReportAnalysis {
  activity: string;
  hazard: string;
  exposure: string;
  barrierFailure: string;
  potentialConsequence: string;
  lifeSavingRules: string[];
}

export interface ReportDraft {
  description: string;
  reportingMethod: ReportingMethod;
  reportLanguage: AppLanguage;
  detectedLanguage?: AppLanguage | string;
  site?: ReportSite;
  area?: string;
  photoUri?: string;
  audioUri?: string;
  analysis?: ReportAnalysis;
}

interface ReportDraftContextValue {
  draft: ReportDraft;
  resetDraft: () => void;
  replaceDraft: (draft: ReportDraft) => void;
  updateDraft: (patch: Partial<ReportDraft>) => void;
}

const initialDraft: ReportDraft = {
  description: "",
  reportingMethod: "text",
  reportLanguage: "en",
};

const ReportDraftContext = createContext<ReportDraftContextValue | null>(null);

export function ReportDraftProvider({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState<ReportDraft>(initialDraft);
  const [hydrated, setHydrated] = useState(false);

  const updateDraft = useCallback((patch: Partial<ReportDraft>) => {
    setDraft((current) => ({
      ...current,
      ...patch,
    }));
  }, []);

  const replaceDraft = useCallback((nextDraft: ReportDraft) => {
    setDraft(nextDraft);
  }, []);

  const resetDraft = useCallback(() => {
    setDraft(initialDraft);
    clearActiveReportDraft();
  }, []);

  useEffect(() => {
    let mounted = true;

    getActiveReportDraft()
      .then((storedDraft) => {
        if (!mounted || !storedDraft || !hasMeaningfulDraft(storedDraft)) {
          return;
        }

        Alert.alert(t("draft.restoreTitle"), t("draft.restoreDescription"), [
          {
            onPress: () => {
              clearActiveReportDraft();
              setDraft(initialDraft);
            },
            style: "destructive",
            text: t("draft.startNew"),
          },
          {
            onPress: () => setDraft(storedDraft),
            text: t("draft.continue"),
          },
        ]);
      })
      .finally(() => {
        if (mounted) {
          setHydrated(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, [t]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const timer = setTimeout(() => {
      if (hasMeaningfulDraft(draft)) {
        saveActiveReportDraft(draft);
        return;
      }

      clearActiveReportDraft();
    }, 650);

    return () => clearTimeout(timer);
  }, [draft, hydrated]);

  const value = useMemo(
    () => ({
      draft,
      replaceDraft,
      resetDraft,
      updateDraft,
    }),
    [draft, replaceDraft, resetDraft, updateDraft],
  );

  return (
    <ReportDraftContext.Provider value={value}>
      {children}
    </ReportDraftContext.Provider>
  );
}

function hasMeaningfulDraft(draft: ReportDraft): boolean {
  return Boolean(
    draft.description.trim() ||
      draft.audioUri ||
      draft.photoUri ||
      draft.site ||
      draft.area?.trim(),
  );
}

export function useReportDraft() {
  const context = use(ReportDraftContext);

  if (!context) {
    throw new Error("useReportDraft must be used within ReportDraftProvider");
  }

  return context;
}
