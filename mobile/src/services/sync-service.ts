import { analysisService } from "@/services/analysis-service";
import { processVoiceReport } from "@/services/voice-report-service";
import type { OfflineQueueItem, WorkerSafetyReport } from "@/types";
import { getIsOnline } from "./network-service";
import {
  getQueue,
  removeFromQueue,
  updateQueueItem,
} from "./offline-queue-service";
import {
  getReportById,
  saveReport,
  updateReportSyncStatus,
} from "./report-service";
import { submitReportToBackend } from "./remote-report-service";

let syncInProgress = false;

export async function syncPendingReports(options?: {
  includeFailed?: boolean;
}): Promise<{ processed: number; failed: number }> {
  if (syncInProgress) {
    return { failed: 0, processed: 0 };
  }

  const online = await getIsOnline();

  if (!online) {
    return { failed: 0, processed: 0 };
  }

  syncInProgress = true;
  let processed = 0;
  let failed = 0;

  try {
    const queue = (await getQueue()).filter((item) => {
      if (item.status === "pending") {
        return true;
      }

      return options?.includeFailed && item.status === "failed";
    });

    for (const item of queue) {
      try {
        await processQueueItem(item);
        processed += 1;
      } catch (error) {
        failed += 1;
        await updateQueueItem(item.id, {
          lastError: getErrorMessage(error),
          retryCount: item.retryCount + 1,
          status: "failed",
        });
        await updateReportSyncStatus(
          item.clientReportId,
          "failed",
          getErrorMessage(error),
        );
      }
    }
  } finally {
    syncInProgress = false;
  }

  return { failed, processed };
}

async function processQueueItem(item: OfflineQueueItem): Promise<void> {
  await updateQueueItem(item.id, { status: "processing" });
  await updateReportSyncStatus(item.clientReportId, "syncing");

  const report = await getReportById(item.clientReportId);

  if (!report) {
    throw new Error("Local report record is missing.");
  }

  const syncedReport =
    item.type === "voice_report"
      ? await processVoiceQueueItem(item, report)
      : await processTextQueueItem(item, report);

  const remoteResult = await submitReportToBackend(syncedReport);

  await saveReport({
    ...syncedReport,
    ...remoteResult,
    syncError: undefined,
    syncStatus: "synced",
    syncedAt: new Date().toISOString(),
  });
  await removeFromQueue(item.id);
}

async function processTextQueueItem(
  item: OfflineQueueItem,
  report: WorkerSafetyReport,
): Promise<WorkerSafetyReport> {
  const analysis =
    item.reportDraft.analysis ??
    (await analysisService.analyseReport(item.reportDraft));

  return {
    ...report,
    aiAnalysis: analysis,
    description: item.reportDraft.description.trim(),
  };
}

async function processVoiceQueueItem(
  item: OfflineQueueItem,
  report: WorkerSafetyReport,
): Promise<WorkerSafetyReport> {
  const queuedDescription = item.reportDraft.description.trim();
  const existingDescription = report.description.trim();
  const existingAnalysis = item.reportDraft.analysis ?? report.aiAnalysis;

  if ((queuedDescription || existingDescription) && existingAnalysis) {
    return {
      ...report,
      aiAnalysis: existingAnalysis,
      audioUri: item.reportDraft.audioUri ?? report.audioUri,
      description: queuedDescription || existingDescription,
      detectedLanguage:
        typeof item.reportDraft.detectedLanguage === "string"
          ? item.reportDraft.detectedLanguage
          : report.detectedLanguage,
    };
  }

  if (!item.reportDraft.audioUri) {
    throw new Error("Queued voice report is missing audio.");
  }

  const voiceReport = await processVoiceReport(
    item.reportDraft.audioUri,
    item.reportDraft.reportLanguage,
  );

  return {
    ...report,
    aiAnalysis: voiceReport.analysis,
    audioUri: item.reportDraft.audioUri,
    description: voiceReport.transcript,
    detectedLanguage:
      typeof voiceReport.detectedLanguage === "string"
        ? voiceReport.detectedLanguage
        : undefined,
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Sync failed.";
}
