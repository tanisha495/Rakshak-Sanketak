import { MaterialIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppButton, EmptyState, StatusBadge } from "@/components";
import { colors, radius, spacing, typography } from "@/constants";
import { useLanguage } from "@/i18n/use-language";
import { getReportById } from "@/services";
import type { WorkerSafetyReport } from "@/types";

export function SubmissionSuccessScreen() {
  const { t } = useLanguage();
  const { reportId } = useLocalSearchParams<{ reportId?: string }>();
  const [report, setReport] = useState<WorkerSafetyReport | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    if (!reportId) {
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    getReportById(reportId)
      .then((nextReport) => {
        if (mounted) {
          setReport(nextReport);
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
  }, [reportId]);

  const viewReports = () => {
    router.replace("/reports");
  };

  const backHome = () => {
    router.replace("/home");
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.loadingText}>{t("common.loadingReport")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!report) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <EmptyState
            action={
              <AppButton onPress={backHome} title={t("success.backHome")} />
            }
            message={t("reportDetails.notFoundMessage")}
            title={t("reportDetails.notFoundTitle")}
          />
        </View>
      </SafeAreaView>
    );
  }
  const isQueued = report.syncStatus === "queued" || report.syncStatus === "failed";
  const isSyncing = report.syncStatus === "syncing";
  const statusText = isQueued
    ? t("offline.waitingToSend")
    : isSyncing
      ? t("offline.sending")
      : undefined;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.hero}>
          <View style={styles.checkCircle}>
            <MaterialIcons color={colors.white} name="check" size={70} />
          </View>
          <Text style={styles.heading}>
            {isQueued ? t("offline.savedTitle") : t("success.heading")}
          </Text>
          <Text style={styles.subtitle}>
            {isQueued ? t("offline.savedDescription") : t("success.subtitle")}
          </Text>
        </View>

        <View style={styles.trackingCard}>
          <Text style={styles.cardLabel}>{t("success.trackingId")}</Text>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.78}
            numberOfLines={1}
            style={styles.trackingId}
          >
            {report.trackingId}
          </Text>
          <Text style={styles.trackingSubtitle}>
            {t("success.trackingSubtitle")}
          </Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>{t("success.status")}</Text>
          {statusText ? (
            <View style={styles.syncBadge}>
              <Text style={styles.syncBadgeText}>{statusText}</Text>
            </View>
          ) : (
            <StatusBadge status={report.status} />
          )}
        </View>

        <View style={styles.nextCard}>
          <View style={styles.nextIcon}>
            <MaterialIcons
              color={colors.primary}
              name="info-outline"
              size={30}
            />
          </View>
          <View style={styles.nextCopy}>
            <Text style={styles.nextTitle}>{t("success.whatNext")}</Text>
            <Text style={styles.nextText}>
              {isQueued
                ? t("offline.savedDescription")
                : t("success.whatNextDescription")}
            </Text>
            <Text style={styles.nextText}>{t("success.trackProgress")}</Text>
          </View>
        </View>

        <View style={styles.assuranceList}>
          <AssuranceRow text={t("success.anonymousAssurance")} />
          <AssuranceRow text={t("success.statusAssurance")} />
          <AssuranceRow text={t("success.preventionAssurance")} />
        </View>

        <View style={styles.actions}>
          <AppButton
            onPress={viewReports}
            style={styles.actionButton}
            title={t("success.viewReports")}
          />
          <AppButton
            onPress={backHome}
            style={styles.actionButton}
            title={t("success.backHome")}
            variant="outline"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function AssuranceRow({ text }: { text: string }) {
  return (
    <View style={styles.assuranceRow}>
      <View style={styles.assuranceIcon}>
        <MaterialIcons color={colors.white} name="check" size={22} />
      </View>
      <Text style={styles.assuranceText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    borderRadius: radius.lg,
    minHeight: 58,
  },
  actions: {
    gap: spacing.md,
    marginTop: "auto",
  },
  assuranceIcon: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  assuranceList: {
    gap: spacing.md,
  },
  assuranceRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  assuranceText: {
    color: colors.text,
    flex: 1,
    fontSize: typography.body,
    lineHeight: 24,
  },
  cardLabel: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "800",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.xl,
  },
  checkCircle: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 112,
    justifyContent: "center",
    width: 112,
  },
  content: {
    flexGrow: 1,
    gap: spacing.lg,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
  },
  heading: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: "900",
    textAlign: "center",
  },
  hero: {
    alignItems: "center",
    gap: spacing.md,
    paddingTop: spacing.xl,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: typography.body,
    textAlign: "center",
  },
  nextCard: {
    alignItems: "flex-start",
    backgroundColor: colors.surfaceGreen,
    borderRadius: radius.lg,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg,
  },
  nextCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  nextIcon: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  nextText: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 23,
  },
  nextTitle: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: "900",
  },
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  statusLabel: {
    color: colors.textMuted,
    fontSize: typography.body,
    fontWeight: "800",
  },
  statusRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: spacing.lg,
  },
  subtitle: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 24,
    textAlign: "center",
  },
  syncBadge: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  syncBadgeText: {
    color: colors.warning,
    fontSize: typography.small,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  trackingCard: {
    backgroundColor: colors.surfaceGreen,
    borderRadius: radius.lg,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  trackingId: {
    color: colors.text,
    fontSize: 32,
    fontVariant: ["tabular-nums"],
    fontWeight: "900",
    letterSpacing: 0,
  },
  trackingSubtitle: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 20,
  },
});
