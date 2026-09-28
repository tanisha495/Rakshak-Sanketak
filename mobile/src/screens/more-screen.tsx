import { MaterialIcons } from "@expo/vector-icons";
import { Link, type Href } from "expo-router";
import type { ComponentProps, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppHeader, ScreenContainer } from "@/components";
import { appVersion, colors, radius, spacing, typography } from "@/constants";
import { useNetworkStatus } from "@/hooks/use-network-status";
import type { AppLanguage, TranslationKey } from "@/i18n";
import { useLanguage } from "@/i18n/use-language";

const languageLabels: Record<AppLanguage, string> = {
  en: "English",
  hi: "हिन्दी",
  as: "অসমীয়া",
};

export function MoreScreen() {
  const { language, t } = useLanguage();
  const { isOnline, isUnknown } = useNetworkStatus();
  const isOffline = !isOnline && !isUnknown;
  const connectionValue =
    isUnknown
      ? t("more.connectionChecking")
      : isOffline
        ? t("more.offline")
        : t("more.online");
  const connectionDescription = isOffline
    ? t("more.offlineDescription")
    : t("more.onlineDescription");

  return (
    <ScreenContainer style={styles.container}>
      <AppHeader title={t("more.title")} subtitle={t("more.subtitle")} />

      <SettingsSection title={t("more.sections.preferences")}>
        <SettingsRow
          showDivider
          href="/more/language"
          icon={<MaterialIcons color={colors.primary} name="language" size={24} />}
          subtitle={t("more.languageSubtitle")}
          title={t("more.language")}
          value={languageLabels[language]}
        />
        <SettingsRow
          href="/more/offline"
          icon={
            <View style={styles.connectionIcon}>
              <View
                style={[
                  styles.statusDot,
                  isOffline ? styles.statusDotOffline : styles.statusDotOnline,
                ]}
              />
              <MaterialIcons
                color={isOffline ? colors.warning : colors.primary}
                name={isOffline ? "signal-wifi-off" : "wifi"}
                size={22}
              />
            </View>
          }
          subtitle={connectionDescription}
          title={t("more.connection")}
          value={connectionValue}
        />
      </SettingsSection>

      <SettingsSection title={t("more.sections.reporting")}>
        <SettingsRow
          href="/more/reporting-guide"
          icon={<MaterialIcons color={colors.primary} name="description" size={24} />}
          subtitle={t("more.howToReportSubtitle")}
          title={t("more.howToReport")}
        />
      </SettingsSection>

      <SettingsSection title={t("more.sections.privacy")}>
        <SettingsRow
          showDivider
          href="/more/anonymous-reporting"
          icon={<MaterialIcons color={colors.primary} name="shield" size={24} />}
          subtitle={t("more.anonymousReportingSubtitle")}
          title={t("more.anonymousReporting")}
        />
        <SettingsRow
          href="/more/data-privacy"
          icon={<MaterialIcons color={colors.primary} name="lock-outline" size={24} />}
          subtitle={t("more.dataPrivacySubtitle")}
          title={t("more.dataPrivacy")}
        />
      </SettingsSection>

      <SettingsSection title={t("more.sections.app")}>
        <SettingsRow
          showDivider
          href="/more/about"
          icon={<MaterialIcons color={colors.primary} name="info-outline" size={24} />}
          title={t("more.about")}
        />
        <SettingsRow
          icon={<MaterialIcons color={colors.textMuted} name="smartphone" size={24} />}
          title={t("more.version")}
          value={appVersion}
        />
      </SettingsSection>
    </ScreenContainer>
  );
}

function SettingsSection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

interface SettingsRowProps {
  href?: Href;
  icon: ReactNode;
  showDivider?: boolean;
  subtitle?: string;
  title: string;
  value?: string;
}

function SettingsRow({
  href,
  icon,
  showDivider = false,
  subtitle,
  title,
  value,
}: SettingsRowProps) {
  const row = (
    <Pressable
      accessibilityRole={href ? "button" : "text"}
      disabled={!href}
      style={({ pressed }) => [
        styles.row,
        showDivider ? styles.rowDivider : null,
        pressed && href ? styles.rowPressed : null,
      ]}
    >
      <View style={styles.rowIcon}>{icon}</View>
      <View style={styles.rowText}>
        <Text numberOfLines={1} style={styles.rowTitle}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={2} style={styles.rowSubtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.rowRight}>
        {value ? (
          <Text numberOfLines={1} style={styles.rowValue}>
            {value}
          </Text>
        ) : null}
        {href ? (
          <MaterialIcons
            color={colors.textMuted}
            name="chevron-right"
            size={24}
            style={styles.chevron}
          />
        ) : null}
      </View>
    </Pressable>
  );

  if (!href) {
    return row;
  }

  return (
    <Link href={href} asChild>
      {row as ComponentProps<typeof Link>["children"]}
    </Link>
  );
}

const styles = StyleSheet.create({
  connectionIcon: {
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    gap: spacing.xl,
    paddingBottom: 112,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    width: "100%",
  },
  rowDivider: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  rowIcon: {
    alignItems: "center",
    backgroundColor: colors.surfaceGreen,
    borderRadius: radius.md,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  rowPressed: {
    opacity: 0.72,
  },
  rowSubtitle: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 19,
  },
  rowText: {
    flex: 1,
    gap: spacing.xs,
    marginLeft: spacing.md,
    minWidth: 0,
  },
  rowTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "800",
  },
  rowRight: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 0,
    marginLeft: spacing.sm,
  },
  rowValue: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: "800",
    textAlign: "right",
  },
  chevron: {
    marginLeft: spacing.xs,
  },
  section: {
    gap: spacing.sm,
  },
  sectionCard: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  statusDot: {
    borderRadius: radius.pill,
    height: 8,
    position: "absolute",
    right: 5,
    top: 6,
    width: 8,
    zIndex: 1,
  },
  statusDotOffline: {
    backgroundColor: colors.warning,
  },
  statusDotOnline: {
    backgroundColor: colors.success,
  },
});
