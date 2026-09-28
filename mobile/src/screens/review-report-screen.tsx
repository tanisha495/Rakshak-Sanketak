import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppButton } from "@/components";
import { colors, radius, spacing, touchTarget, typography } from "@/constants";
import { useNetworkStatus } from "@/hooks/use-network-status";
import {
  translateAnalysisList,
  translateAnalysisValue,
} from "@/i18n/report-analysis";
import { useLanguage } from "@/i18n/use-language";
import type { ReportAnalysis } from "@/report-draft";
import { useReportDraft } from "@/report-draft";
import { analysisService } from "@/services/analysis-service";

type AnalysisState = "loading" | "success" | "error" | "offline";

export function ReviewReportScreen() {
  const { t } = useLanguage();
  const { isOnline, isUnknown } = useNetworkStatus();
  const { draft, updateDraft } = useReportDraft();
  const [analysis, setAnalysis] = useState<ReportAnalysis | undefined>(
    draft.analysis,
  );
  const [analysisState, setAnalysisState] = useState<AnalysisState>(
    draft.analysis ? "success" : isOnline || isUnknown ? "loading" : "offline",
  );

  const runAnalysis = useCallback(() => {
    let mounted = true;

    if (!isOnline) {
      setAnalysisState("offline");
      return () => {
        mounted = false;
      };
    }

    setAnalysisState("loading");

    analysisService
      .analyseReport(draft)
      .then((nextAnalysis) => {
        if (!mounted) {
          return;
        }

        setAnalysis(nextAnalysis);
        updateDraft({ analysis: nextAnalysis });
        setAnalysisState("success");
      })
      .catch(() => {
        if (mounted) {
          setAnalysisState("error");
        }
      });

    return () => {
      mounted = false;
    };
  }, [draft, isOnline, updateDraft]);

  useEffect(() => {
    if (draft.analysis) {
      return;
    }

    return runAnalysis();
  }, [draft.analysis, runAnalysis]);

  const handleEditReport = () => {
    if (draft.reportingMethod === "text") {
      router.push("/report/text");
      return;
    }

    router.back();
  };

  const handleLooksCorrect = () => {
    if (analysis) {
      updateDraft({ analysis });
    }

    router.push("/report/photo");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.header}>
          <Pressable
            accessibilityLabel={t("common.goBack")}
            accessibilityRole="button"
            hitSlop={spacing.md}
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <MaterialIcons color={colors.text} name="chevron-left" size={34} />
          </Pressable>
          <Text style={styles.title}>{t("review.title")}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {analysisState === "loading" ? (
          <LoadingState />
        ) : analysisState === "offline" ? (
          <OfflinePendingState />
        ) : analysisState === "error" || !analysis ? (
          <ErrorState onEdit={handleEditReport} onRetry={runAnalysis} />
        ) : (
          <>
            <View style={styles.messageCard}>
              <View style={styles.messageIcon}>
                <MaterialIcons color={colors.white} name="info-outline" size={28} />
              </View>
              <Text style={styles.messageText}>{t("review.understoodAs")}</Text>
            </View>

            <View style={styles.analysisCard}>
              <AnalysisRow
                icon="precision-manufacturing"
                label={t("review.activity")}
                value={translateAnalysisValue(analysis.activity, t)}
              />
              <AnalysisRow
                icon="warning-amber"
                iconColor={colors.warning}
                label={t("review.hazard")}
                value={translateAnalysisValue(analysis.hazard, t)}
              />
              <AnalysisRow
                icon="groups"
                label={t("review.exposure")}
                value={translateAnalysisValue(analysis.exposure, t)}
              />
              <AnalysisRow
                icon="verified-user"
                label={t("review.safetyConcern")}
                meta={t("review.barrierFailure")}
                value={translateAnalysisValue(analysis.barrierFailure, t)}
              />
              <AnalysisRow
                icon="medical-services"
                iconColor={colors.danger}
                label={t("review.potentialConsequence")}
                value={translateAnalysisValue(analysis.potentialConsequence, t)}
              />
              <AnalysisRow
                icon="article"
                label={t("review.lifeSavingRule")}
                last
                value={translateAnalysisList(analysis.lifeSavingRules, t)}
              />
            </View>

            <View style={styles.originalSection}>
              <Text style={styles.sectionTitle}>{t("review.originalReport")}</Text>
              <View style={styles.originalCard}>
                <Text style={styles.originalText}>"{draft.description}"</Text>
              </View>
            </View>

            {draft.site || draft.area ? (
              <View style={styles.contextCard}>
                {draft.site ? (
                  <ContextLine label={t("review.site")} value={draft.site} />
                ) : null}
                {draft.area ? (
                  <ContextLine label={t("review.area")} value={draft.area} />
                ) : null}
              </View>
            ) : null}

            <View style={styles.actions}>
              <AppButton
                onPress={handleEditReport}
                style={styles.secondaryButton}
                title={t("review.edit")}
                variant="outline"
              />
              <AppButton
                onPress={handleLooksCorrect}
                style={styles.primaryButton}
                title={t("review.looksCorrect")}
              />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );

  function LoadingState() {
    return (
      <View style={styles.loadingCard}>
        <ActivityIndicator color={colors.primary} size="large" />
        <View style={styles.loadingCopy}>
          <Text style={styles.loadingTitle}>{t("review.analysing")}</Text>
          <Text style={styles.loadingSubtitle}>{t("review.analysingSubtitle")}</Text>
        </View>
      </View>
    );
  }

  function ErrorState({
    onEdit,
    onRetry,
  }: {
    onEdit: () => void;
    onRetry: () => void;
  }) {
    return (
      <View style={styles.errorCard}>
        <View style={styles.errorIcon}>
          <MaterialIcons color={colors.danger} name="error-outline" size={36} />
        </View>
        <Text style={styles.errorTitle}>{t("review.errorTitle")}</Text>
        <Text style={styles.errorText}>{t("review.errorSubtitle")}</Text>
        <View style={styles.errorActions}>
          <AppButton
            onPress={onEdit}
            style={styles.errorButton}
            title={t("review.edit")}
            variant="outline"
          />
          <AppButton
            onPress={onRetry}
            style={styles.errorButton}
            title={t("review.tryAgain")}
          />
        </View>
      </View>
    );
  }

  function OfflinePendingState() {
    return (
      <>
        <View style={styles.messageCard}>
          <View style={styles.messageIcon}>
            <MaterialIcons color={colors.white} name="schedule" size={28} />
          </View>
          <Text style={styles.messageText}>{t("offline.analysisPending")}</Text>
        </View>

        <View style={styles.originalSection}>
          <Text style={styles.sectionTitle}>{t("review.originalReport")}</Text>
          <View style={styles.originalCard}>
            <Text style={styles.originalText}>"{draft.description}"</Text>
          </View>
        </View>

        {draft.site || draft.area ? (
          <View style={styles.contextCard}>
            {draft.site ? (
              <ContextLine label={t("review.site")} value={draft.site} />
            ) : null}
            {draft.area ? (
              <ContextLine label={t("review.area")} value={draft.area} />
            ) : null}
          </View>
        ) : null}

        <View style={styles.pendingCard}>
          <MaterialIcons color={colors.primary} name="cloud-off" size={32} />
          <Text style={styles.pendingTitle}>{t("offline.analysisPending")}</Text>
          <Text style={styles.pendingText}>
            {t("offline.analysisPendingDescription")}
          </Text>
        </View>

        <View style={styles.actions}>
          <AppButton
            onPress={handleEditReport}
            style={styles.secondaryButton}
            title={t("review.edit")}
            variant="outline"
          />
          <AppButton
            onPress={handleLooksCorrect}
            style={styles.primaryButton}
            title={t("common.continue")}
          />
        </View>
      </>
    );
  }
}

function AnalysisRow({
  icon,
  iconColor = colors.primary,
  label,
  last = false,
  meta,
  value,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  iconColor?: string;
  label: string;
  last?: boolean;
  meta?: string;
  value: string;
}) {
  return (
    <View style={[styles.analysisRow, last ? styles.analysisRowLast : null]}>
      <View style={styles.rowIconWrap}>
        <MaterialIcons color={iconColor} name={icon} size={31} />
      </View>
      <View style={styles.rowCopy}>
        <View style={styles.rowLabelLine}>
          <Text style={styles.rowLabel}>{label}</Text>
          {meta ? <Text style={styles.rowMeta}>({meta})</Text> : null}
        </View>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

function ContextLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.contextLine}>
      <Text style={styles.contextLabel}>{label}</Text>
      <Text style={styles.contextValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  analysisCard: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    boxShadow: "0 8px 22px rgba(23, 33, 27, 0.08)",
    overflow: "hidden",
  },
  analysisRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  analysisRowLast: {
    borderBottomWidth: 0,
  },
  backButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: touchTarget.minHeight,
    width: 48,
  },
  content: {
    flexGrow: 1,
    gap: spacing.lg,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  contextCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  contextLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "800",
  },
  contextLine: {
    gap: spacing.xs,
  },
  contextValue: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "700",
  },
  errorActions: {
    flexDirection: "row",
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  errorButton: {
    flex: 1,
  },
  errorCard: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.xl,
  },
  errorIcon: {
    alignItems: "center",
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.pill,
    height: 68,
    justifyContent: "center",
    width: 68,
  },
  errorText: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 24,
    textAlign: "center",
  },
  errorTitle: {
    color: colors.text,
    fontSize: typography.subheading,
    fontWeight: "900",
    textAlign: "center",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerSpacer: {
    width: 48,
  },
  loadingCard: {
    alignItems: "center",
    backgroundColor: colors.surfaceGreen,
    borderRadius: radius.lg,
    gap: spacing.lg,
    justifyContent: "center",
    minHeight: 260,
    padding: spacing.xl,
  },
  loadingCopy: {
    gap: spacing.sm,
  },
  loadingSubtitle: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 24,
    textAlign: "center",
  },
  loadingTitle: {
    color: colors.primaryDark,
    fontSize: typography.subheading,
    fontWeight: "900",
    textAlign: "center",
  },
  messageCard: {
    alignItems: "center",
    backgroundColor: colors.surfaceGreen,
    borderRadius: radius.lg,
    flexDirection: "row",
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  messageIcon: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  messageText: {
    color: colors.text,
    flex: 1,
    fontSize: typography.body,
    lineHeight: 24,
  },
  originalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  originalSection: {
    gap: spacing.md,
  },
  originalText: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 26,
  },
  pendingCard: {
    alignItems: "center",
    backgroundColor: colors.surfaceGreen,
    borderRadius: radius.lg,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  pendingText: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 23,
    textAlign: "center",
  },
  pendingTitle: {
    color: colors.primaryDark,
    fontSize: typography.subheading,
    fontWeight: "900",
    textAlign: "center",
  },
  primaryButton: {
    borderRadius: radius.lg,
    flex: 1.25,
    minHeight: 58,
  },
  rowCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  rowIconWrap: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  rowLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "800",
  },
  rowLabelLine: {
    alignItems: "baseline",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  rowMeta: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  rowValue: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "700",
    lineHeight: 23,
  },
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  secondaryButton: {
    borderRadius: radius.lg,
    flex: 0.85,
    minHeight: 58,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.subheading,
    fontWeight: "900",
  },
  title: {
    color: colors.text,
    flex: 1,
    fontSize: typography.heading,
    fontWeight: "900",
    textAlign: "center",
  },
});
