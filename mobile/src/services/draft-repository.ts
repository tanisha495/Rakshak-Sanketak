import AsyncStorage from "@react-native-async-storage/async-storage";

import type { ReportDraft } from "@/report-draft";

export const activeReportDraftStorageKey = "sanketak_active_report_draft";

export async function getActiveReportDraft(): Promise<ReportDraft | null> {
  const value = await AsyncStorage.getItem(activeReportDraftStorageKey);

  if (!value) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (isReportDraftLike(parsed)) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

export async function saveActiveReportDraft(draft: ReportDraft): Promise<void> {
  await AsyncStorage.setItem(activeReportDraftStorageKey, JSON.stringify(draft));
}

export async function clearActiveReportDraft(): Promise<void> {
  await AsyncStorage.removeItem(activeReportDraftStorageKey);
}

function isReportDraftLike(value: unknown): value is ReportDraft {
  if (!value || typeof value !== "object") {
    return false;
  }

  const draft = value as Partial<ReportDraft>;

  return (
    typeof draft.description === "string" &&
    (draft.reportingMethod === "text" ||
      draft.reportingMethod === "voice" ||
      draft.reportingMethod === "photo") &&
    (draft.reportLanguage === "en" ||
      draft.reportLanguage === "hi" ||
      draft.reportLanguage === "as")
  );
}
