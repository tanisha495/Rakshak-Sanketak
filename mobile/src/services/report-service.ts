import type { ReportDraft } from "@/report-draft";
import type {
  OfflineQueueItem,
  ReportLanguage,
  ReportStatus,
  ReportStatusStep,
  WorkerSafetyReport,
} from "@/types";
import { getReportStatusSteps } from "@/utils";
import { addToQueue } from "./offline-queue-service";
import { persistMedia } from "./media-persistence-service";
import { createReportId, createTrackingId } from "./report-id-service";
import { submitReportToBackend } from "./remote-report-service";
import {
  getReportById as getPersistedReportById,
  getReports as getPersistedReports,
  saveReport,
  updateReportSyncStatus,
} from "./report-repository";

export {
  getReportByTrackingToken,
  saveReport,
  submittedReportsStorageKey,
  updateReportSyncStatus,
  updateReportStatus,
} from "./report-repository";

const MOCK_DELAY_MS = 150;

function wait(ms = MOCK_DELAY_MS): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function submitReport(
  draft: ReportDraft,
): Promise<WorkerSafetyReport> {
  const description = draft.description.trim();
  const now = new Date().toISOString();

  if (!description) {
    throw new Error("Report description is required.");
  }

  const report: WorkerSafetyReport = {
    id: createReportId(),
    trackingId: createTrackingId(),
    description,
    language: mapReportLanguage(draft.reportLanguage),
    site: draft.site ?? "Not provided",
    areaOrEquipment: draft.area?.trim() || "Not provided",
    submittedAt: now,
    status: "submitted",
    reportingMethod: draft.reportingMethod,
    photoUri: draft.photoUri,
    audioUri: draft.audioUri,
    aiAnalysis: draft.analysis,
    detectedLanguage:
      typeof draft.detectedLanguage === "string"
        ? draft.detectedLanguage
        : undefined,
    syncStatus: "synced",
    syncedAt: now,
  };

  const remoteResult = await submitReportToBackend(report);

  return saveReport({
    ...report,
    ...remoteResult,
  });
}

export async function queueReportForOfflineProcessing(
  draft: ReportDraft,
): Promise<WorkerSafetyReport> {
  const now = new Date().toISOString();
  const reportId = createReportId();
  const trackingId = createTrackingId();
  const persistedPhotoUri = await persistMedia(draft.photoUri, "photo");
  const persistedAudioUri = await persistMedia(draft.audioUri, "audio");
  const queuedDraft: ReportDraft = {
    ...draft,
    audioUri: persistedAudioUri,
    photoUri: persistedPhotoUri,
  };

  const report: WorkerSafetyReport = {
    id: reportId,
    trackingId,
    description: draft.description.trim(),
    language: mapReportLanguage(draft.reportLanguage),
    site: draft.site ?? "Not provided",
    areaOrEquipment: draft.area?.trim() || "Not provided",
    submittedAt: now,
    status: "submitted",
    reportingMethod: draft.reportingMethod,
    photoUri: persistedPhotoUri,
    audioUri: persistedAudioUri,
    aiAnalysis: draft.analysis,
    detectedLanguage:
      typeof draft.detectedLanguage === "string"
        ? draft.detectedLanguage
        : undefined,
    syncStatus: "queued",
  };
  const queueItem: OfflineQueueItem = {
    id: `queue-${reportId}`,
    clientReportId: reportId,
    type: draft.reportingMethod === "voice" ? "voice_report" : "text_report",
    status: "pending",
    createdAt: now,
    retryCount: 0,
    reportDraft: queuedDraft,
  };

  await saveReport(report);
  await addToQueue(queueItem);

  return report;
}

export async function getReports(): Promise<WorkerSafetyReport[]> {
  await wait();
  return getPersistedReports();
}

export async function getReportById(
  id: string,
): Promise<WorkerSafetyReport | undefined> {
  await wait();
  return getPersistedReportById(id);
}

function mapReportLanguage(
  language: ReportDraft["reportLanguage"],
): ReportLanguage {
  if (language === "hi") {
    return "hindi";
  }

  if (language === "as") {
    return "assamese";
  }

  return "english";
}

export async function getReportStatus(
  id: string,
): Promise<{ status: ReportStatus; steps: ReportStatusStep[] } | undefined> {
  const report = await getReportById(id);

  if (!report) {
    return undefined;
  }

  return {
    status: report.status,
    steps: getReportStatusSteps(report.status),
  };
}
