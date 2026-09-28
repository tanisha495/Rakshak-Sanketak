import { MaterialIcons } from "@expo/vector-icons";
import { Link, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppButton, EmptyState } from "@/components";
import { colors, radius, spacing, typography } from "@/constants";
import { useNetworkStatus } from "@/hooks/use-network-status";
import type { TranslationKey } from "@/i18n";
import { useLanguage } from "@/i18n/use-language";
import {
  getCachedSafetyAlerts,
  getCachedSafetyAlertsUpdatedAt,
  getSafetyAlerts,
} from "@/services";
import type { SafetyAlert, SafetyAlertSeverity } from "@/types";

type AlertFilter = "all" | "critical" | "warning" | "life_saving_rule";
type AlertState = "loading" | "success" | "error";

export function AlertsScreen() {
  const { t } = useLanguage();
  const { isOnline } = useNetworkStatus();
  const [alerts, setAlerts] = useState<SafetyAlert[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | undefined>();
  const [alertState, setAlertState] = useState<AlertState>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<AlertFilter>("all");

  const loadAlerts = useCallback((showRefresh = false) => {
    let mounted = true;

    if (showRefresh) {
      setRefreshing(true);
    } else {
      setAlertState("loading");
    }

    const load = isOnline ? getSafetyAlerts : getCachedSafetyAlerts;

    load()
      .then((items) => {
        if (mounted) {
          setAlerts(items);
          setAlertState("success");
        }
      })
      .catch(() => {
        if (mounted) {
          setAlertState("error");
        }
      })
      .finally(() => {
        if (mounted) {
          setRefreshing(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [isOnline]);

  useFocusEffect(loadAlerts);

  useFocusEffect(
    useCallback(() => {
      getCachedSafetyAlertsUpdatedAt().then(setLastUpdatedAt);
    }, []),
  );

  const newestCriticalAlert = useMemo(
    () => alerts.find((alert) => alert.severity === "critical"),
    [alerts],
  );

  const filteredAlerts = useMemo(
    () =>
      alerts.filter((alert) => {
        if (selectedFilter === "all") {
          return true;
        }

        if (selectedFilter === "life_saving_rule") {
          return alert.category === "life_saving_rule";
        }

        return alert.severity === selectedFilter;
      }),
    [alerts, selectedFilter],
  );

  const recentAlerts = useMemo(
    () =>
      filteredAlerts.filter((alert) =>
        selectedFilter === "all" && newestCriticalAlert
          ? alert.id !== newestCriticalAlert.id
          : true,
      ),
    [filteredAlerts, newestCriticalAlert, selectedFilter],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        ListEmptyComponent={
          alertState === "loading" ? (
            <View style={styles.loadingState}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={styles.muted}>{t("alerts.loading")}</Text>
            </View>
          ) : alertState === "error" ? (
            <EmptyState
              action={
                <AppButton
                  onPress={() => loadAlerts()}
                  title={t("alerts.tryAgain")}
                />
              }
              message={t("alerts.errorSubtitle")}
              title={t("alerts.errorTitle")}
            />
          ) : (
            <EmptyState
              message={t("alerts.emptySubtitle")}
              title={t("alerts.emptyTitle")}
            />
          )
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleLine}>
              <View style={styles.titleBlock}>
                <Text style={styles.screenTitle}>{t("alerts.title")}</Text>
                <Text style={styles.subtitle}>{t("alerts.subtitle")}</Text>
              </View>
              <View style={styles.headerIcon}>
                <MaterialIcons
                  color={colors.primary}
                  name="notifications-none"
                  size={30}
                />
              </View>
            </View>

            <ScrollView
              contentContainerStyle={styles.filters}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              <FilterChip
                active={selectedFilter === "all"}
                label={t("alerts.filters.all")}
                onPress={() => setSelectedFilter("all")}
              />
              <FilterChip
                active={selectedFilter === "critical"}
                label={t("alerts.filters.critical")}
                onPress={() => setSelectedFilter("critical")}
              />
              <FilterChip
                active={selectedFilter === "warning"}
                label={t("alerts.filters.warnings")}
                onPress={() => setSelectedFilter("warning")}
              />
              <FilterChip
                active={selectedFilter === "life_saving_rule"}
                label={t("alerts.filters.lifeSavingRules")}
                onPress={() => setSelectedFilter("life_saving_rule")}
              />
            </ScrollView>

            {!isOnline ? (
              <View style={styles.offlineCard}>
                <MaterialIcons
                  color={colors.warning}
                  name="signal-wifi-off"
                  size={24}
                />
                <View style={styles.offlineCopy}>
                  <Text style={styles.offlineTitle}>
                    {t("offline.alertsCached")}
                  </Text>
                  <Text style={styles.offlineText}>
                    {alerts.length === 0
                      ? t("offline.alertsUnavailable")
                      : `${t("offline.alertsCachedDescription")} ${
                          lastUpdatedAt
                            ? t("offline.lastUpdated").replace(
                                "{date}",
                                formatAlertTime(lastUpdatedAt),
                              )
                            : ""
                        }`}
                  </Text>
                </View>
              </View>
            ) : null}

            {alertState === "success" &&
            selectedFilter === "all" &&
            newestCriticalAlert ? (
              <View style={styles.priorityBlock}>
                <Text style={styles.sectionLabel}>
                  {t("alerts.criticalAlert")}
                </Text>
                <AlertCard alert={newestCriticalAlert} priority />
              </View>
            ) : null}

            {alertState === "success" && recentAlerts.length > 0 ? (
              <Text style={styles.sectionLabel}>{t("alerts.recentAlerts")}</Text>
            ) : null}
          </View>
        }
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        data={alertState === "success" ? recentAlerts : []}
        ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
        keyExtractor={(alert) => alert.id}
        refreshControl={
          <RefreshControl
            onRefresh={() => loadAlerts(true)}
            refreshing={refreshing}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => <AlertCard alert={item} />}
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

function AlertCard({
  alert,
  priority = false,
}: {
  alert: SafetyAlert;
  priority?: boolean;
}) {
  const { t } = useLanguage();
  const tone = getSeverityTone(alert.severity);

  return (
    <Link
      asChild
      href={{
        pathname: "/alerts/[id]",
        params: { id: alert.id },
      }}
    >
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.card,
          priority ? styles.priorityCard : null,
          { backgroundColor: tone.backgroundColor, borderColor: tone.borderColor },
          pressed ? styles.pressed : null,
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: tone.iconBackground }]}>
          <MaterialIcons color={tone.color} name={tone.icon} size={30} />
        </View>

        <View style={styles.cardCopy}>
          <View style={styles.cardTitleLine}>
            <Text
              style={[
                styles.severityPill,
                { backgroundColor: tone.color },
              ]}
            >
              {t(getSeverityKey(alert.severity))}
            </Text>
            <Text style={[styles.alertTitle, { color: tone.color }]}>
              {alert.title}
            </Text>
            {!alert.isRead ? (
              <Text style={styles.newPill}>{t("alerts.new")}</Text>
            ) : null}
          </View>
          <Text numberOfLines={priority ? 4 : 2} style={styles.description}>
            {alert.description}
          </Text>
          <Text style={styles.meta}>
            {t(getCategoryKey(alert.category))} · {formatAlertTime(alert.createdAt)}
          </Text>
        </View>

        <MaterialIcons color={colors.textMuted} name="chevron-right" size={28} />
      </Pressable>
    </Link>
  );
}

function getSeverityTone(severity: SafetyAlertSeverity): {
  backgroundColor: string;
  borderColor: string;
  color: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  iconBackground: string;
} {
  if (severity === "critical") {
    return {
      backgroundColor: "#FFF0F0",
      borderColor: "#F8C9C9",
      color: colors.danger,
      icon: "warning-amber",
      iconBackground: colors.white,
    };
  }

  if (severity === "warning") {
    return {
      backgroundColor: "#FFF8E6",
      borderColor: "#F5DF9A",
      color: colors.warning,
      icon: "notifications",
      iconBackground: colors.white,
    };
  }

  return {
    backgroundColor: colors.infoSoft,
    borderColor: "#CFE0FF",
    color: colors.info,
    icon: "article",
    iconBackground: colors.white,
  };
}

function getCategoryKey(category: SafetyAlert["category"]): TranslationKey {
  if (category === "life_saving_rule") {
    return "alerts.category.lifeSavingRule";
  }

  if (category === "site_advisory") {
    return "alerts.category.siteAdvisory";
  }

  if (category === "recurring_pattern") {
    return "alerts.category.recurringPattern";
  }

  return "alerts.category.hazard";
}

function getSeverityKey(severity: SafetyAlertSeverity): TranslationKey {
  if (severity === "critical") {
    return "alerts.severity.critical";
  }

  if (severity === "warning") {
    return "alerts.severity.warning";
  }

  return "alerts.severity.info";
}

function formatAlertTime(value: string): string {
  const createdAt = new Date(value);
  const diffMs = Date.now() - createdAt.getTime();
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (diffMs < hourMs) {
    return `${Math.max(1, Math.floor(diffMs / minuteMs))} min ago`;
  }

  if (diffMs < dayMs) {
    return `${Math.floor(diffMs / hourMs)}h ago`;
  }

  if (diffMs < dayMs * 2) {
    return "Yesterday";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(createdAt);
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg,
  },
  cardCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  cardTitleLine: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  content: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  description: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 23,
  },
  filterChip: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    justifyContent: "center",
    minHeight: 48,
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
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  header: {
    gap: spacing.lg,
    paddingBottom: spacing.lg,
  },
  headerIcon: {
    alignItems: "center",
    backgroundColor: colors.surfaceGreen,
    borderRadius: radius.pill,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  iconWrap: {
    alignItems: "center",
    borderRadius: radius.pill,
    height: 54,
    justifyContent: "center",
    width: 54,
  },
  itemSeparator: {
    height: spacing.md,
  },
  offlineCard: {
    alignItems: "flex-start",
    backgroundColor: colors.warningSoft,
    borderRadius: radius.lg,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
  },
  offlineCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  offlineText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 20,
  },
  offlineTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "900",
  },
  loadingState: {
    alignItems: "center",
    gap: spacing.md,
    justifyContent: "center",
    minHeight: 220,
  },
  meta: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "700",
  },
  muted: {
    color: colors.textMuted,
    fontSize: typography.body,
    textAlign: "center",
  },
  newPill: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    color: colors.white,
    fontSize: typography.small,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  pressed: {
    opacity: 0.78,
  },
  priorityBlock: {
    gap: spacing.sm,
  },
  priorityCard: {
    paddingVertical: spacing.xl,
  },
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  screenTitle: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: "900",
  },
  sectionLabel: {
    color: colors.text,
    fontSize: typography.subheading,
    fontWeight: "900",
  },
  severityPill: {
    borderRadius: radius.pill,
    color: colors.white,
    fontSize: typography.small,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 23,
  },
  titleBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  titleLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  alertTitle: {
    flexShrink: 1,
    fontSize: typography.subheading,
    fontWeight: "900",
  },
});
