import { MaterialIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AppButton, AppHeader, EmptyState, ScreenContainer } from "@/components";
import { colors, radius, spacing, typography } from "@/constants";
import type { TranslationKey } from "@/i18n";
import { useLanguage } from "@/i18n/use-language";
import { getSafetyAlertById, markSafetyAlertRead } from "@/services";
import type { SafetyAlert, SafetyAlertSeverity } from "@/types";

export function AlertDetailsScreen() {
  const { t } = useLanguage();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [alert, setAlert] = useState<SafetyAlert | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    getSafetyAlertById(id)
      .then((nextAlert) => {
        if (mounted) {
          setAlert(nextAlert);
        }

        if (nextAlert) {
          return markSafetyAlertRead(nextAlert.id);
        }

        return undefined;
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

  const tone = useMemo(
    () => getSeverityTone(alert?.severity ?? "info"),
    [alert?.severity],
  );

  if (loading) {
    return (
      <ScreenContainer>
        <AppHeader showBack title={t("alertDetails.title")} />
        <Text style={styles.muted}>{t("alerts.loading")}</Text>
      </ScreenContainer>
    );
  }

  if (!alert) {
    return (
      <ScreenContainer>
        <AppHeader showBack title={t("alertDetails.title")} />
        <EmptyState
          action={
            <AppButton
              onPress={() => router.replace("/alerts")}
              title={t("alertDetails.backToAlerts")}
            />
          }
          message={t("alertDetails.notFoundSubtitle")}
          title={t("alertDetails.notFound")}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <AppHeader showBack title={t("alertDetails.title")} />

      <View
        style={[
          styles.heroCard,
          { backgroundColor: tone.backgroundColor, borderColor: tone.borderColor },
        ]}
      >
        <View style={[styles.heroIcon, { backgroundColor: tone.iconBackground }]}>
          <MaterialIcons color={tone.color} name={tone.icon} size={36} />
        </View>
        <View style={styles.heroCopy}>
          <Text style={[styles.severity, { color: tone.color }]}>
            {t(getSeverityKey(alert.severity))}
          </Text>
          <Text selectable style={styles.title}>
            {alert.title}
          </Text>
          <Text style={styles.description}>{alert.description}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t("alertDetails.whatShouldYouDo")}</Text>
        <Text style={styles.bodyText}>
          {alert.actionText ?? t("alertDetails.defaultAction")}
        </Text>
      </View>

      {alert.lifeSavingRule ? (
        <View style={styles.ruleCard}>
          <View style={styles.ruleIcon}>
            <MaterialIcons color={colors.primary} name="verified-user" size={30} />
          </View>
          <View style={styles.ruleCopy}>
            <Text style={styles.ruleLabel}>
              {t("alertDetails.lifeSavingRule")}
            </Text>
            <Text style={styles.ruleValue}>{alert.lifeSavingRule}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t("alertDetails.details")}</Text>
        <DetailRow
          label={t("alertDetails.severity")}
          value={t(getSeverityKey(alert.severity))}
        />
        <DetailRow
          label={t("alertDetails.category")}
          value={t(getCategoryKey(alert.category))}
        />
        {alert.site ? (
          <DetailRow label={t("alertDetails.site")} value={alert.site} />
        ) : null}
        {alert.area ? (
          <DetailRow label={t("alertDetails.area")} value={alert.area} />
        ) : null}
        <DetailRow
          label={t("alertDetails.published")}
          value={formatAlertDate(alert.createdAt)}
        />
      </View>
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

function getSeverityKey(severity: SafetyAlertSeverity): TranslationKey {
  if (severity === "critical") {
    return "alerts.severity.critical";
  }

  if (severity === "warning") {
    return "alerts.severity.warning";
  }

  return "alerts.severity.info";
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

function formatAlertDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

const styles = StyleSheet.create({
  bodyText: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 24,
  },
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
  heroCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  heroCopy: {
    flex: 1,
    gap: spacing.sm,
  },
  heroIcon: {
    alignItems: "center",
    borderRadius: radius.pill,
    height: 64,
    justifyContent: "center",
    width: 64,
  },
  muted: {
    color: colors.textMuted,
    fontSize: typography.body,
  },
  ruleCard: {
    alignItems: "center",
    backgroundColor: colors.surfaceGreen,
    borderRadius: radius.lg,
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  ruleCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  ruleIcon: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  ruleLabel: {
    color: colors.primaryDark,
    fontSize: typography.caption,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  ruleValue: {
    color: colors.text,
    fontSize: typography.subheading,
    fontWeight: "900",
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.subheading,
    fontWeight: "900",
  },
  severity: {
    fontSize: typography.caption,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: "900",
    lineHeight: 29,
  },
});
