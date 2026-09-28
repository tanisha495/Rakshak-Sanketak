import { MaterialIcons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import {
  AppButton,
  AppHeader,
  EmptyState,
  ScreenContainer,
  StatusBadge,
} from "@/components";
import { colors, radius, spacing, typography } from "@/constants";
import { useNetworkStatus } from "@/hooks/use-network-status";
import type { TranslationKey } from "@/i18n";
import {
  translateAnalysisList,
  translateAnalysisValue,
} from "@/i18n/report-analysis";
import { useLanguage } from "@/i18n/use-language";
import {
  getReportById,
  getReportStatus,
  syncPendingReports,
  updateReportStatus,
} from "@/services";
import type {
  ReportStatus,
  ReportStatusStep,
  SyncStatus,
  WorkerSafetyReport,
} from "@/types";
import { formatReportDate } from "@/utils";

const demoStatuses: ReportStatus[] = [
  "submitted",
  "under_review",
  "action_assigned",
  "actioned",
  "verified",
];

export function ReportDetailsScreen() {
  const { t } = useLanguage();
  const { isOnline } = useNetworkStatus();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [report, setReport] = useState<WorkerSafetyReport | undefined>();
  const [steps, setSteps] = useState<ReportStatusStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const loadReport = useCallback(() => {
    let mounted = true;
    setLoading(true);

    Promise.all([getReportById(id), getReportStatus(id)])
      .then(([reportResult, statusResult]) => {
        if (mounted) {
          setReport(reportResult);
          setSteps(statusResult?.steps ?? []);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [id]);

  useFocusEffect(loadReport);

  const handleRetrySync = async () => {
    await syncPendingReports({ includeFailed: true });
    loadReport();
  };

  const handleDemoStatusChange = async (status: ReportStatus) => {
    if (!report || updatingStatus) {
      return;
    }

    setUpdatingStatus(true);

    try {
      const updatedReport = await updateReportStatus(report.id, status);
      const statusResult = await getReportStatus(report.id);

      setReport(updatedReport);
      setSteps(statusResult?.steps ?? []);
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <ScreenContainer>
        <AppHeader showBack title={t("reportStatus.title")} />
        <Text style={styles.muted}>{t("common.loadingReport")}</Text>
      </ScreenContainer>
    );
  }

  if (!report) {
    return (
      <ScreenContainer>
        <AppHeader showBack title={t("reportStatus.title")} />
        <EmptyState
          action={
            <AppButton
              onPress={() => router.replace("/reports")}
              title={t("reportStatus.backToReports")}
            />
          }
          message={t("reportDetails.notFoundMessage")}
          title={t("reportStatus.notFound")}
        />
      </ScreenContainer>
    );
  }

  const syncStatus = report.syncStatus ?? "synced";
  const isSynced = syncStatus === "synced";
  const statusDescriptionKey = getStatusDescriptionKey(report.status);
  const methodLabel = t(getMethodLabelKey(report.reportingMethod));
  const photoIsPreviewable = isPreviewableLocalPhoto(report.photoUri);
  const statusDescription = isSynced
    ? t(statusDescriptionKey)
    : getSyncStatusDescription(syncStatus, t);

  return (
    <ScreenContainer>
      <AppHeader
        showBack
        subtitle={t("reportStatus.subtitle")}
        title={t("reportStatus.title")}
      />

      <View style={styles.heroCard}>
        <Text style={styles.label}>{t("reportStatus.trackingId")}</Text>
        <Text selectable style={styles.trackingId}>
          {report.trackingId}
        </Text>
        <View style={styles.statusLine}>
          {isSynced ? (
            <StatusBadge status={report.status} />
          ) : (
            <SyncBadge syncStatus={syncStatus} />
          )}
          <Text style={styles.submittedOn}>
            {t("reportStatus.submittedOn")} {formatReportDate(report.submittedAt)}
          </Text>
        </View>
        <Text style={styles.statusDescription}>{statusDescription}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t("reportStatus.timelineTitle")}</Text>
        {isSynced ? (
          <View style={styles.timeline}>
            {steps.map((step) => (
              <TimelineRow
                active={step.active}
                completed={step.completed}
                key={step.id}
                label={t(getTimelineLabelKey(step.id))}
              />
            ))}
          </View>
        ) : (
          <View style={styles.timeline}>
            <TimelineRow active completed label={t("offline.savedOnDevice")} />
            <TimelineRow label={t("offline.sentToSafetyTeam")} />
            <TimelineRow label={t("reportStatus.timeline.reviewed")} />
            <TimelineRow label={t("reportStatus.timeline.action_assigned")} />
            <TimelineRow label={t("reportStatus.timeline.actioned")} />
            <TimelineRow label={t("reportStatus.timeline.verified")} />
          </View>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t("reportStatus.yourReport")}</Text>
          <Text style={styles.methodTag}>{methodLabel}</Text>
        </View>
        {report.description ? (
          <Text selectable style={styles.description}>
            {report.description}
          </Text>
        ) : (
          <>
            <Text style={styles.description}>{t("offline.voiceSaved")}</Text>
            <Text style={styles.muted}>{t("offline.voiceSavedDescription")}</Text>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t("reportStatus.location")}</Text>
        <DetailRow label={t("reportStatus.site")} value={report.site} />
        {report.areaOrEquipment && report.areaOrEquipment !== "Not provided" ? (
          <DetailRow
            label={t("reportStatus.area")}
            value={report.areaOrEquipment}
          />
        ) : null}
      </View>

      {report.aiAnalysis ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {t("reportStatus.safetyInterpretation")}
          </Text>
          <DetailRow
            label={t("reportStatus.activity")}
            value={translateAnalysisValue(report.aiAnalysis.activity, t)}
          />
          <DetailRow
            label={t("reportStatus.hazard")}
            value={translateAnalysisValue(report.aiAnalysis.hazard, t)}
          />
          <DetailRow
            label={t("reportStatus.safetyConcern")}
            value={translateAnalysisValue(report.aiAnalysis.barrierFailure, t)}
          />
          <DetailRow
            label={t("reportStatus.lifeSavingRule")}
            value={translateAnalysisList(report.aiAnalysis.lifeSavingRules, t)}
          />
          <DetailRow
            label={t("reportStatus.potentialConsequence")}
            value={translateAnalysisValue(
              report.aiAnalysis.potentialConsequence,
              t,
            )}
          />
        </View>
      ) : !isSynced ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("offline.analysisPending")}</Text>
          <Text style={styles.muted}>
            {t("offline.analysisPendingDescription")}
          </Text>
        </View>
      ) : null}

      {report.photoUri ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {t("reportStatus.supportingPhoto")}
          </Text>
          {photoIsPreviewable ? (
            <Image source={{ uri: report.photoUri }} style={styles.photoPreview} />
          ) : (
            <Text style={styles.muted}>
              {t("reportStatus.photoUnavailable")}
            </Text>
          )}
        </View>
      ) : null}

      <View style={styles.loopCard}>
        <View style={styles.loopIcon}>
          <MaterialIcons color={colors.primary} name="shield" size={28} />
        </View>
        <View style={styles.loopCopy}>
          <Text style={styles.loopTitle}>{t("reportStatus.whatNext")}</Text>
          <Text style={styles.loopText}>{statusDescription}</Text>
        </View>
      </View>

      {!isSynced ? (
        <AppButton
          disabled={!isOnline}
          onPress={handleRetrySync}
          style={styles.retryButton}
          title={t("offline.syncNow")}
        />
      ) : null}

      {__DEV__ && isSynced ? (
        <View style={styles.demoCard}>
          <Text style={styles.demoTitle}>{t("reportStatus.demoTitle")}</Text>
          <View style={styles.demoOptions}>
            {demoStatuses.map((status) => {
              const selected = report.status === status;

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  disabled={updatingStatus}
                  key={status}
                  onPress={() => handleDemoStatusChange(status)}
                  style={({ pressed }) => [
                    styles.demoChip,
                    selected ? styles.demoChipSelected : null,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.demoChipText,
                      selected ? styles.demoChipTextSelected : null,
                    ]}
                  >
                    {t(getStatusLabelKey(status))}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </ScreenContainer>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text selectable style={styles.detailValue}>
        {value}
      </Text>
    </View>
  );
}

function TimelineRow({
  active = false,
  completed = false,
  label,
}: {
  active?: boolean;
  completed?: boolean;
  label: string;
}) {
  return (
    <View style={styles.timelineRow}>
      <View
        style={[
          styles.timelineDot,
          completed || active ? styles.dotActive : null,
        ]}
      >
        {completed || active ? (
          <MaterialIcons color={colors.white} name="check" size={15} />
        ) : null}
      </View>
      <Text style={[styles.timelineLabel, active ? styles.timelineActive : null]}>
        {label}
      </Text>
    </View>
  );
}

function SyncBadge({ syncStatus }: { syncStatus: SyncStatus }) {
  const { t } = useLanguage();
  const failed = syncStatus === "failed";
  const syncing = syncStatus === "syncing";
  const label = failed
    ? t("offline.sendFailed")
    : syncing
      ? t("offline.sending")
      : t("offline.waitingToSend");

  return (
    <View
      style={[
        styles.syncBadge,
        failed ? styles.syncBadgeFailed : syncing ? styles.syncBadgeInfo : null,
      ]}
    >
      <Text
        style={[
          styles.syncBadgeText,
          failed
            ? styles.syncBadgeTextFailed
            : syncing
              ? styles.syncBadgeTextInfo
              : null,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function getTimelineLabelKey(stepId: ReportStatusStep["id"]): TranslationKey {
  return `reportStatus.timeline.${stepId}`;
}

function getStatusDescriptionKey(status: ReportStatus): TranslationKey {
  return `reportStatus.description.${status}`;
}

function getStatusLabelKey(status: ReportStatus): TranslationKey {
  return `reportStatus.${status}`;
}

function getMethodLabelKey(
  method: WorkerSafetyReport["reportingMethod"],
): TranslationKey {
  if (method === "voice") {
    return "reportStatus.reportedByVoice";
  }

  if (method === "photo") {
    return "submit.photo";
  }

  return "reportStatus.typedReport";
}

function getSyncStatusDescription(
  syncStatus: SyncStatus,
  t: (key: TranslationKey) => string,
): string {
  if (syncStatus === "failed") {
    return t("offline.sendFailedDescription");
  }

  if (syncStatus === "syncing") {
    return t("offline.sendingDescription");
  }

  return t("offline.savedDescription");
}

function isPreviewableLocalPhoto(uri?: string): boolean {
  return Boolean(
    uri &&
      (uri.startsWith("file:") ||
        uri.startsWith("content:") ||
        uri.startsWith("ph:") ||
        uri.startsWith("assets-library:")),
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  description: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 24,
  },
  demoCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  demoChip: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  demoChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  demoChipText: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "800",
  },
  demoChipTextSelected: {
    color: colors.white,
  },
  demoOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  demoTitle: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "800",
  },
  detailRow: {
    gap: spacing.xs,
  },
  detailValue: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "700",
    lineHeight: 23,
  },
  dotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  heroCard: {
    backgroundColor: colors.surfaceGreen,
    borderRadius: radius.lg,
    gap: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  label: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "900",
  },
  loopCard: {
    alignItems: "flex-start",
    backgroundColor: colors.surfaceGreen,
    borderRadius: radius.lg,
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  loopCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  loopIcon: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  loopText: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 23,
  },
  loopTitle: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: "900",
  },
  methodTag: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: "900",
  },
  muted: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 23,
  },
  photoPreview: {
    aspectRatio: 1.5,
    borderRadius: radius.md,
    width: "100%",
  },
  pressed: {
    opacity: 0.78,
  },
  retryButton: {
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: colors.text,
    flex: 1,
    fontSize: typography.subheading,
    fontWeight: "900",
  },
  statusDescription: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 23,
  },
  statusLine: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  submittedOn: {
    color: colors.textMuted,
    flex: 1,
    fontSize: typography.caption,
    lineHeight: 20,
  },
  syncBadge: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  syncBadgeFailed: {
    backgroundColor: colors.dangerSoft,
  },
  syncBadgeInfo: {
    backgroundColor: colors.infoSoft,
  },
  syncBadgeText: {
    color: colors.warning,
    fontSize: typography.small,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  syncBadgeTextFailed: {
    color: colors.danger,
  },
  syncBadgeTextInfo: {
    color: colors.info,
  },
  timeline: {
    gap: spacing.md,
  },
  timelineActive: {
    color: colors.primary,
    fontWeight: "900",
  },
  timelineDot: {
    alignItems: "center",
    backgroundColor: colors.border,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 26,
    justifyContent: "center",
    width: 26,
  },
  timelineLabel: {
    color: colors.text,
    flex: 1,
    fontSize: typography.body,
    fontWeight: "700",
  },
  timelineRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  trackingId: {
    color: colors.text,
    fontSize: 32,
    fontVariant: ["tabular-nums"],
    fontWeight: "900",
    letterSpacing: 0,
  },
});
