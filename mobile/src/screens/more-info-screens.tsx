import { MaterialIcons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppHeader, ScreenContainer } from "@/components";
import { appVersion, colors, radius, spacing, typography } from "@/constants";
import { useNetworkStatus } from "@/hooks/use-network-status";
import type { AppLanguage, TranslationKey } from "@/i18n";
import { useLanguage } from "@/i18n/use-language";
import { getPendingCount, syncPendingReports } from "@/services";

const languageOptions: Array<{
  code: AppLanguage;
  nativeName: string;
  englishName: string;
}> = [
  { code: "en", nativeName: "English", englishName: "English" },
  { code: "hi", nativeName: "हिन्दी", englishName: "Hindi" },
  { code: "as", nativeName: "অসমীয়া", englishName: "Assamese" },
];

export function LanguageSettingsScreen() {
  const { language, setLanguage, t } = useLanguage();

  const handleSelectLanguage = async (nextLanguage: AppLanguage) => {
    await setLanguage(nextLanguage);
  };

  return (
    <ScreenContainer style={styles.container}>
      <AppHeader showBack title={t("languageSettings.title")} />
      <Text style={styles.heading}>{t("languageSettings.heading")}</Text>

      <View style={styles.optionGroup}>
        {languageOptions.map((option) => {
          const selected = language === option.code;

          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={option.code}
              onPress={() => handleSelectLanguage(option.code)}
              style={({ pressed }) => [
                styles.languageCard,
                selected ? styles.languageCardSelected : null,
                pressed ? styles.pressed : null,
              ]}
            >
              <View style={styles.languageText}>
                <Text style={styles.languageNative}>{option.nativeName}</Text>
                <Text style={styles.languageEnglish}>{option.englishName}</Text>
              </View>
              <View style={[styles.checkCircle, selected ? styles.checkCircleSelected : null]}>
                {selected ? (
                  <MaterialIcons color={colors.white} name="check" size={18} />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </ScreenContainer>
  );
}

export function OfflineUseScreen() {
  const { t } = useLanguage();
  const { isOnline } = useNetworkStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const isOffline = !isOnline;

  const loadPendingCount = useCallback(() => {
    getPendingCount().then(setPendingCount);
  }, []);

  useEffect(() => {
    loadPendingCount();
  }, [loadPendingCount]);

  const handleSyncNow = async () => {
    if (!isOnline || syncing || pendingCount === 0) {
      return;
    }

    setSyncing(true);
    try {
      await syncPendingReports({ includeFailed: true });
      loadPendingCount();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <ScreenContainer style={styles.container}>
      <AppHeader showBack title={t("offline.title")} />
      <InfoHero
        icon={isOffline ? "signal-wifi-off" : "wifi"}
        subtitle={
          isOffline ? t("more.offlineDescription") : t("more.onlineDescription")
        }
        title={isOffline ? t("more.offline") : t("more.online")}
        tone={isOffline ? "warning" : "success"}
      />
      <Text style={styles.body}>{t("offline.subtitle")}</Text>

      <InfoCard title={t("offline.available")}>
        <Bullet text={t("offline.availableSavedReports")} />
        <Bullet text={t("offline.availableTypedDraft")} />
        <Bullet text={t("offline.availableVoiceReports")} />
        <Bullet text={t("offline.availablePhotos")} />
        <Bullet text={t("offline.availableLoadedInfo")} />
      </InfoCard>

      <InfoCard title={t("offline.requiresConnection")}>
        <Bullet text={t("offline.requiresVoice")} />
        <Bullet text={t("offline.requiresAnalysis")} />
        <Bullet text={t("offline.requiresAlerts")} />
        <Bullet text={t("offline.requiresSubmission")} />
      </InfoCard>

      <InfoCard title={t("offline.pendingReports")}>
        <Text style={styles.body}>
          {pendingCount === 0
            ? t("offline.allSynced")
            : t("offline.pendingReportsCount").replace(
                "{count}",
                String(pendingCount),
              )}
        </Text>
        {pendingCount > 0 ? (
          <Pressable
            accessibilityRole="button"
            disabled={!isOnline || syncing}
            onPress={handleSyncNow}
            style={({ pressed }) => [
              styles.syncButton,
              !isOnline || syncing ? styles.syncButtonDisabled : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.syncButtonText}>
              {syncing ? t("offline.syncing") : t("offline.syncNow")}
            </Text>
          </Pressable>
        ) : null}
      </InfoCard>
    </ScreenContainer>
  );
}

export function ReportingGuideScreen() {
  const { t } = useLanguage();

  return (
    <ScreenContainer style={styles.container}>
      <AppHeader showBack title={t("reportingGuide.title")} />
      <Text style={styles.heading}>{t("reportingGuide.heading")}</Text>
      <Text style={styles.body}>{t("reportingGuide.intro")}</Text>

      <InfoCard title={t("reportingGuide.prompts")}>
        <NumberedPrompt index={1} text={t("reportingGuide.whatHappening")} />
        <NumberedPrompt index={2} text={t("reportingGuide.whatUnsafe")} />
        <NumberedPrompt index={3} text={t("reportingGuide.where")} />
        <NumberedPrompt index={4} text={t("reportingGuide.whatCouldHappen")} />
      </InfoCard>

      <View style={styles.exampleCard}>
        <Text style={styles.exampleLabel}>{t("reportingGuide.goodReport")}</Text>
        <Text style={styles.exampleText}>{t("reportingGuide.example")}</Text>
        <Text style={styles.body}>{t("reportingGuide.exampleExplanation")}</Text>
      </View>

      <InfoCard title={t("reportingGuide.helpful")}>
        <Bullet text={t("reportingGuide.helpfulSpecific")} />
        <Bullet text={t("reportingGuide.helpfulLocation")} />
        <Bullet text={t("reportingGuide.helpfulCondition")} />
        <Bullet text={t("reportingGuide.helpfulNearMiss")} />
      </InfoCard>

      <InfoCard title={t("reportingGuide.avoid")}>
        <Bullet text={t("reportingGuide.avoidAccusations")} />
        <Bullet text={t("reportingGuide.avoidNames")} />
        <Bullet text={t("reportingGuide.avoidPersonalInfo")} />
      </InfoCard>
    </ScreenContainer>
  );
}

export function AnonymousReportingScreen() {
  const { t } = useLanguage();

  return (
    <ScreenContainer style={styles.container}>
      <AppHeader showBack title={t("privacy.anonymousTitle")} />
      <InfoHero
        icon="shield"
        subtitle={t("privacy.anonymousDescription")}
        title={t("privacy.anonymousHeading")}
        tone="success"
      />
      <InfoCard>
        <Text style={styles.body}>{t("privacy.operationalInfo")}</Text>
      </InfoCard>
      <InfoCard title={t("privacy.trackingTitle")}>
        <Text style={styles.body}>{t("privacy.trackingDescription")}</Text>
      </InfoCard>
      <InfoCard>
        <View style={styles.inlineNote}>
          <MaterialIcons color={colors.primary} name="photo-camera" size={24} />
          <Text style={styles.body}>{t("privacy.photoNote")}</Text>
        </View>
      </InfoCard>
    </ScreenContainer>
  );
}

export function DataPrivacyScreen() {
  const { t } = useLanguage();

  return (
    <ScreenContainer style={styles.container}>
      <AppHeader showBack title={t("dataPrivacy.title")} />
      <InfoHero
        icon="lock-outline"
        subtitle={t("dataPrivacy.description")}
        title={t("dataPrivacy.prototypeNotice")}
        tone="success"
      />
      <InfoCard title={t("dataPrivacy.mayInclude")}>
        <Bullet text={t("dataPrivacy.observationDescription")} />
        <Bullet text={t("dataPrivacy.site")} />
        <Bullet text={t("dataPrivacy.area")} />
        <Bullet text={t("dataPrivacy.reportLanguage")} />
        <Bullet text={t("dataPrivacy.supportingPhoto")} />
        <Bullet text={t("dataPrivacy.voiceRecording")} />
        <Bullet text={t("dataPrivacy.safetyAnalysis")} />
        <Bullet text={t("dataPrivacy.trackingStatus")} />
      </InfoCard>
      <InfoCard title={t("dataPrivacy.purpose")}>
        <Text style={styles.body}>{t("dataPrivacy.purposeDescription")}</Text>
      </InfoCard>
    </ScreenContainer>
  );
}

export function AboutSanketakScreen() {
  const { t } = useLanguage();

  return (
    <ScreenContainer style={styles.container}>
      <AppHeader showBack title={t("about.title")} />
      <View style={styles.aboutHero}>
        <View style={styles.brandMark}>
          <MaterialIcons color={colors.primary} name="health-and-safety" size={42} />
        </View>
        <Text style={styles.aboutName}>Sanketak</Text>
        <Text style={styles.aboutTagline}>{t("about.tagline")}</Text>
      </View>

      <InfoCard>
        <Text style={styles.body}>{t("about.description")}</Text>
      </InfoCard>

      <View style={styles.pillRow}>
        <InfoPill label={t("about.report")} />
        <InfoPill label={t("about.prevent")} />
        <InfoPill label={t("about.protect")} />
      </View>

      <InfoCard>
        <Text style={styles.body}>{t("about.prototype")}</Text>
      </InfoCard>

      <View style={styles.versionRow}>
        <Text style={styles.versionLabel}>{t("more.version")}</Text>
        <Text style={styles.versionValue}>{appVersion}</Text>
      </View>
    </ScreenContainer>
  );
}

function InfoHero({
  icon,
  subtitle,
  title,
  tone,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  subtitle: string;
  title: string;
  tone: "success" | "warning";
}) {
  const iconColor = tone === "warning" ? colors.warning : colors.primary;
  const backgroundColor = tone === "warning" ? colors.warningSoft : colors.surfaceGreen;

  return (
    <View style={[styles.hero, { backgroundColor }]}>
      <View style={[styles.heroIcon, { backgroundColor: colors.white }]}>
        <MaterialIcons color={iconColor} name={icon} size={32} />
      </View>
      <Text style={styles.heroTitle}>{title}</Text>
      <Text style={styles.heroSubtitle}>{subtitle}</Text>
    </View>
  );
}

function InfoCard({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <View style={styles.infoCard}>
      {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletDot} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

function NumberedPrompt({ index, text }: { index: number; text: string }) {
  return (
    <View style={styles.promptRow}>
      <View style={styles.promptNumber}>
        <Text style={styles.promptNumberText}>{index}</Text>
      </View>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

function InfoPill({ label }: { label: string }) {
  return (
    <View style={styles.infoPill}>
      <Text style={styles.infoPillText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  aboutHero: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  aboutName: {
    color: colors.primaryDark,
    fontSize: 36,
    fontWeight: "900",
  },
  aboutTagline: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "700",
    textAlign: "center",
  },
  body: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 24,
  },
  brandMark: {
    alignItems: "center",
    backgroundColor: colors.surfaceGreen,
    borderRadius: radius.pill,
    height: 76,
    justifyContent: "center",
    width: 76,
  },
  bulletDot: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 7,
    marginTop: 8,
    width: 7,
  },
  bulletRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  bulletText: {
    color: colors.text,
    flex: 1,
    fontSize: typography.body,
    lineHeight: 24,
  },
  cardTitle: {
    color: colors.text,
    fontSize: typography.subheading,
    fontWeight: "900",
  },
  checkCircle: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  checkCircleSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  container: {
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  exampleCard: {
    backgroundColor: colors.surfaceGreen,
    borderRadius: radius.lg,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  exampleLabel: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: "900",
  },
  exampleText: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "800",
    lineHeight: 24,
  },
  heading: {
    color: colors.primaryDark,
    fontSize: typography.heading,
    fontWeight: "900",
    lineHeight: 30,
  },
  hero: {
    alignItems: "center",
    borderRadius: radius.lg,
    gap: spacing.sm,
    padding: spacing.xl,
  },
  heroIcon: {
    alignItems: "center",
    borderRadius: radius.pill,
    height: 64,
    justifyContent: "center",
    width: 64,
  },
  heroSubtitle: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 24,
    textAlign: "center",
  },
  heroTitle: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: "900",
    textAlign: "center",
  },
  infoCard: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  infoPill: {
    backgroundColor: colors.surfaceGreen,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  infoPillText: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: "900",
  },
  inlineNote: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  languageCard: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 88,
    padding: spacing.lg,
  },
  languageCardSelected: {
    backgroundColor: colors.surfaceGreen,
    borderColor: colors.primary,
    borderWidth: 2,
  },
  languageEnglish: {
    color: colors.textMuted,
    fontSize: typography.body,
  },
  languageNative: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: "900",
  },
  languageText: {
    gap: spacing.xs,
  },
  optionGroup: {
    gap: spacing.md,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.72,
  },
  promptNumber: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  promptNumberText: {
    color: colors.white,
    fontSize: typography.caption,
    fontWeight: "900",
  },
  promptRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
  },
  syncButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  syncButtonDisabled: {
    opacity: 0.52,
  },
  syncButtonText: {
    color: colors.white,
    fontSize: typography.body,
    fontWeight: "900",
    textAlign: "center",
  },
  versionLabel: {
    color: colors.textMuted,
    fontSize: typography.body,
    fontWeight: "700",
  },
  versionRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: spacing.lg,
  },
  versionValue: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "900",
  },
});
