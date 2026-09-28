import type { ReportDraft } from "@/report-draft";

export type OfflineQueueItemType = "text_report" | "voice_report";
export type OfflineQueueItemStatus = "pending" | "processing" | "failed";

export interface OfflineQueueItem {
  id: string;
  clientReportId: string;
  type: OfflineQueueItemType;
  status: OfflineQueueItemStatus;
  createdAt: string;
  retryCount: number;
  lastError?: string;
  reportDraft: ReportDraft;
}
