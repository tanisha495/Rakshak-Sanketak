import { MaterialIcons } from "@expo/vector-icons";
import { Link, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppButton, EmptyState, StatusBadge } from "@/components";
import { colors, radius, spacing, touchTarget, typography } from "@/constants";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { useLanguage } from "@/i18n/use-language";
import { getReports, syncPendingReports } from "@/services";
import type { ReportStatus, WorkerSafetyReport } from "@/types";
import { formatReportDate } from "@/utils";

type ReportFilter = "all" | "under_review" | "actioned";

export function ReportsScreen() {
  const { t } = useLanguage();
  const { isOnline } = useNetworkStatus();
  const [reports, setReports] = useState<WorkerSafetyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<ReportFilter>("all");

  const loadReports = useCallback((showRefresh = false) => {
    let mounted = true;

    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    getReports()
      .then((items) => {
        if (mounted) {
          setReports(items);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
          setRefreshing(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useFocusEffect(loadReports);

  const filteredReports = useMemo(
    () =>
      reports.filter((report) => {
        if (selectedFilter === "all") {
          return true;
        }

        if (selectedFilter === "actioned") {
          return ["action_assigned", "actioned", "verified"].includes(
            report.status,
          );
        }

        return report.status === selectedFilter;
      }),
    [reports, selectedFilter],
  );
  const pendingCount = useMemo(
    () =>
      reports.filter(
        (report) =>
          report.syncStatus === "queued" ||
          report.syncStatus === "syncing" ||
          report.syncStatus === "failed",
      ).length,
    [reports],
  );

  const handleSyncNow = async () => {
    await syncPendingReports({ includeFailed: true });
    loadReports(true);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={styles.muted}>{t("reports.loading")}</Text>
            </View>
          ) : (
            <EmptyState
              action={
                <AppButton
                  href="/report/voice"
                  title={t("reports.reportSomething")}
                />
              }
              message={t("reports.emptySubtitle")}
              title={t("reports.emptyTitle")}
            />
          )
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleBlock}>
              <Text style={styles.title}>{t("reports.title")}</Text>
              <Text style={styles.subtitle}>{t("reports.subtitle")}</Text>
            </View>
            <View style={styles.filters}>
              <FilterChip
                active={selectedFilter === "all"}
                label={t("reports.filterAll")}
                onPress={() => setSelectedFilter("all")}
              />
              <FilterChip
                active={selectedFilter === "under_review"}
                label={t("reports.filterUnderReview")}
                onPress={() => setSelectedFilter("under_review")}
              />
              <FilterChip
                active={selectedFilter === "actioned"}
                label={t("reports.filterActioned")}
                onPress={() => setSelectedFilter("actioned")}
              />
            </View>
            {pendingCount > 0 ? (
              <View style={styles.syncSummary}>
                <View style={styles.syncSummaryCopy}>
                  <Text style={styles.syncSummaryTitle}>
                    {t("offline.pendingReports")}
                  </Text>
                  <Text style={styles.syncSummaryText}>
                    {t("offline.pendingReportsCount").replace(
                      "{count}",
                      String(pendingCount),
                    )}
                  </Text>
                </View>
                <AppButton
                  disabled={!isOnline}
                  onPress={handleSyncNow}
                  title={t("offline.syncNow")}
                  variant="secondary"
                />
              </View>
            ) : null}
          </View>
        }
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        data={loading ? [] : filteredReports}
        ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
        keyExtractor={(report) => report.id}
        refreshControl={
          <RefreshControl
            onRefresh={() => loadReports(true)}
            refreshing={refreshing}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => <ReportCard report={item} />}
      />
    </SafeAreaView>
  );
}

function FilterChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        active ? styles.filterChipActive : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <Text
        style={[
          styles.filterLabel,
          active ? styles.filterLabelActive : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ReportCard({ report }: { report: WorkerSafetyReport }) {
  const { t } = useLanguage();
  const locationText = formatReportLocation(report);

  return (
    <Link
      asChild
      href={{
        pathname: "/report-details/[id]",
        params: { id: report.id },
      }}
    >
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
      >
        <View style={styles.cardTopRow}>
          <View style={styles.cardTitleGroup}>
            <View style={styles.trackingLine}>
              <MaterialIcons
                color={colors.primary}
                name={getReportMethodIcon(report.reportingMethod)}
                size={18}
              />
              <Text selectable style={styles.trackingId}>
                {report.trackingId}
              </Text>
            </View>
            <Text numberOfLines={2} style={styles.description}>
              {report.description}
            </Text>
          </View>
          {report.syncStatus && report.syncStatus !== "synced" ? (
            <SyncBadge syncStatus={report.syncStatus} />
          ) : (
            <StatusBadge status={report.status} />
          )}
        </View>

        <View style={styles.cardMetaRow}>
          <View style={styles.metaBlock}>
            {locationText ? (
              <Text numberOfLines={1} style={styles.metaText}>
                {locationText}
              </Text>
            ) : null}
            <Text style={styles.metaText}>
              {formatReportDate(report.submittedAt)}
            </Text>
          </View>
          <View style={styles.detailsLink}>
            <Text style={styles.detailsText}>{t("reports.viewDetails")}</Text>
            <MaterialIcons color={colors.text} name="chevron-right" size={26} />
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

function formatReportLocation(report: WorkerSafetyReport): string {
  const area =
    report.areaOrEquipment && report.areaOrEquipment !== "Not provided"
      ? report.areaOrEquipment
      : "";

  return [report.site, area].filter(Boolean).join(" · ");
}

function SyncBadge({ syncStatus }: { syncStatus: NonNullable<WorkerSafetyReport["syncStatus"]> }) {
  const { t } = useLanguage();
  const style =
    syncStatus === "failed"
      ? { backgroundColor: colors.dangerSoft, color: colors.danger }
      : syncStatus === "syncing"
        ? { backgroundColor: colors.infoSoft, color: colors.info }
        : { backgroundColor: colors.warningSoft, color: colors.warning };
  const label =
    syncStatus === "failed"
      ? t("offline.sendFailed")
      : syncStatus === "syncing"
        ? t("offline.sending")
        : t("offline.waitingToSend");

  return (
    <View style={[styles.syncBadge, { backgroundColor: style.backgroundColor }]}>
      <Text style={[styles.syncBadgeText, { color: style.color }]}>{label}</Text>
    </View>
  );
}

function getReportMethodIcon(
  method: WorkerSafetyReport["reportingMethod"],
): keyof typeof MaterialIcons.glyphMap {
  if (method === "voice") {
    return "mic";
  }

  if (method === "photo") {
    return "photo-camera";
  }

  return "article";
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    boxShadow: "0 8px 20px rgba(23, 33, 27, 0.06)",
    gap: spacing.lg,
    padding: spacing.lg,
  },
  cardMetaRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  cardTitleGroup: {
    flex: 1,
    gap: spacing.sm,
  },
  cardTopRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  content: {
    flexGrow: 1,
    gap: spacing.lg,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  description: {
    color: colors.text,
    fontSize: typography.caption,
    lineHeight: 20,
  },
  detailsLink: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
  },
  detailsText: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "800",
  },
  filterChip: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    justifyContent: "center",
    minHeight: touchTarget.minHeight,
    paddingHorizontal: spacing.lg,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
  },
  filterLabel: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: "800",
  },
  filterLabelActive: {
    color: colors.white,
  },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  header: {
    gap: spacing.md,
  },
  itemSeparator: {
    height: spacing.md,
  },
  loadingState: {
    alignItems: "center",
    gap: spacing.md,
    justifyContent: "center",
    minHeight: 220,
  },
  metaBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  metaText: {
    color: colors.textMuted,
    fontSize: typography.small,
    lineHeight: 18,
  },
  muted: {
    color: colors.textMuted,
    fontSize: typography.body,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.78,
  },
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 23,
  },
  syncBadge: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  syncBadgeText: {
    fontSize: typography.small,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  syncSummary: {
    alignItems: "center",
    backgroundColor: colors.surfaceGreen,
    borderRadius: radius.lg,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
  },
  syncSummaryCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  syncSummaryText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 20,
  },
  syncSummaryTitle: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: "900",
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: "900",
    lineHeight: 34,
  },
  titleBlock: {
    gap: spacing.xs,
  },
  trackingId: {
    color: colors.text,
    fontSize: typography.subheading,
    fontVariant: ["tabular-nums"],
    fontWeight: "900",
  },
  trackingLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
  },
});
