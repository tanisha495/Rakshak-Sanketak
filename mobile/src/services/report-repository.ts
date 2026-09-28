import AsyncStorage from "@react-native-async-storage/async-storage";

import { mockReports } from "@/data";
import type { ReportStatus, SyncStatus, WorkerSafetyReport } from "@/types";

export const submittedReportsStorageKey = "sanketak_submitted_reports";
const validStatuses: ReportStatus[] = [
  "submitted",
  "under_review",
  "action_assigned",
  "actioned",
  "verified",
];
const validSyncStatuses: SyncStatus[] = ["queued", "syncing", "synced", "failed"];

export async function getReports(): Promise<WorkerSafetyReport[]> {
  const storedReports = await getStoredReports();
  const storedIds = new Set(storedReports.map((report) => report.id));

  return [
    ...storedReports,
    ...mockReports.filter((report) => !storedIds.has(report.id)),
  ].sort(
    (a, b) =>
      new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
  );
}

export async function saveReport(
  report: WorkerSafetyReport,
): Promise<WorkerSafetyReport> {
  const storedReports = await getStoredReports();
  const nextReports = [
    report,
    ...storedReports.filter((item) => item.id !== report.id),
  ];

  await AsyncStorage.setItem(
    submittedReportsStorageKey,
    JSON.stringify(nextReports),
  );

  return report;
}

export async function getReportById(
  id: string,
): Promise<WorkerSafetyReport | undefined> {
  const storedReports = await getStoredReports();

  return (
    storedReports.find((report) => report.id === id) ??
    mockReports.find((report) => report.id === id)
  );
}

export async function getReportByTrackingToken(
  token: string,
): Promise<WorkerSafetyReport | undefined> {
  const reports = await getReports();

  return reports.find((report) => report.trackingId === token);
}

export async function updateReportStatus(
  id: string,
  status: ReportStatus,
): Promise<WorkerSafetyReport | undefined> {
  const storedReports = await getStoredReports();
  const existingReport =
    storedReports.find((report) => report.id === id) ??
    mockReports.find((report) => report.id === id);

  if (!existingReport) {
    return undefined;
  }

  const updatedReport: WorkerSafetyReport = {
    ...existingReport,
    status,
  };

  await saveReport(updatedReport);

  return updatedReport;
}

export async function updateReportSyncStatus(
  id: string,
  syncStatus: SyncStatus,
  syncError?: string,
): Promise<WorkerSafetyReport | undefined> {
  const existingReport = await getReportById(id);

  if (!existingReport) {
    return undefined;
  }

  const updatedReport: WorkerSafetyReport = {
    ...existingReport,
    syncError,
    syncStatus,
    syncedAt: syncStatus === "synced" ? new Date().toISOString() : existingReport.syncedAt,
  };

  await saveReport(updatedReport);
  return updatedReport;
}

async function getStoredReports(): Promise<WorkerSafetyReport[]> {
  const value = await AsyncStorage.getItem(submittedReportsStorageKey);

  if (!value) {
    return [];
  }

  try {
    const parsedValue: unknown = JSON.parse(value);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue
      .filter(isWorkerSafetyReportLike)
      .map(normalizeStoredReport);
  } catch {
    return [];
  }
}

function isWorkerSafetyReportLike(value: unknown): value is WorkerSafetyReport {
  if (!value || typeof value !== "object") {
    return false;
  }

  const report = value as Partial<WorkerSafetyReport>;

  return (
    typeof report.id === "string" &&
    typeof report.trackingId === "string" &&
    typeof report.description === "string" &&
    typeof report.submittedAt === "string" &&
    normalizeReportStatus(report.status) !== undefined
  );
}

function normalizeStoredReport(report: WorkerSafetyReport): WorkerSafetyReport {
  return {
    ...report,
    status: normalizeReportStatus(report.status) ?? "submitted",
    syncStatus: normalizeSyncStatus(report.syncStatus),
  };
}

function normalizeReportStatus(status: unknown): ReportStatus | undefined {
  if (status === "action_in_progress") {
    return "action_assigned";
  }

  if (validStatuses.includes(status as ReportStatus)) {
    return status as ReportStatus;
  }

  return undefined;
}

function normalizeSyncStatus(status: unknown): SyncStatus {
  if (validSyncStatuses.includes(status as SyncStatus)) {
    return status as SyncStatus;
  }

  return "synced";
}
