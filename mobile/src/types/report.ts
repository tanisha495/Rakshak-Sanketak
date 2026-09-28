export type ReportLanguage = "english" | "hindi" | "assamese" | "mixed";

export type ReportStatus =
  | "submitted"
  | "under_review"
  | "action_assigned"
  | "actioned"
  | "verified";

export type ReportingMethod = "voice" | "text" | "photo";
export type SyncStatus = "queued" | "syncing" | "synced" | "failed";

export interface SifAnalysis {
  activity: string;
  hazard: string;
  exposure: string;
  barrierFailure: string;
  potentialConsequence: string;
  lifeSavingRules: string[];
}

export interface WorkerSafetyReport {
  id: string;
  trackingId: string;
  description: string;
  language: ReportLanguage;
  site: string;
  areaOrEquipment: string;
  submittedAt: string;
  status: ReportStatus;
  reportingMethod: ReportingMethod;
  photoUri?: string;
  audioUri?: string;
  aiAnalysis?: SifAnalysis;
  syncStatus?: SyncStatus;
  syncedAt?: string;
  syncError?: string;
  detectedLanguage?: string;
  remoteReportId?: string;
  remotePhotoPath?: string;
  remoteAudioPath?: string;
}

export interface SubmitReportInput {
  description: string;
  language: ReportLanguage;
  site: string;
  areaOrEquipment: string;
  reportingMethod: ReportingMethod;
  photoUri?: string;
}

export interface ReportStatusStep {
  id: "submitted" | "reviewed" | "action_assigned" | "actioned" | "verified";
  label: string;
  completed: boolean;
  active: boolean;
}
