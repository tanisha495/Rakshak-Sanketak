import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  Image,
  Modal,
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
import type { TranslationKey } from "@/i18n";
import {
  translateAnalysisList,
  translateAnalysisValue,
} from "@/i18n/report-analysis";
import { useLanguage } from "@/i18n/use-language";
import { type ReportSite, useReportDraft } from "@/report-draft";
import {
  MediaPersistenceError,
  queueReportForOfflineProcessing,
  submitReport,
} from "@/services";
import { analysisService } from "@/services/analysis-service";

const siteOptions: Array<{ value: ReportSite; labelKey: TranslationKey }> = [
  { value: "Mathura", labelKey: "textReport.siteMathura" },
  { value: "Barauni", labelKey: "textReport.siteBarauni" },
  { value: "Digboi", labelKey: "textReport.siteDigboi" },
  { value: "Panipat", labelKey: "textReport.sitePanipat" },
];

export function SubmitReportScreen() {
  const { t } = useLanguage();
  const { isOnline } = useNetworkStatus();
  const { draft, resetDraft, updateDraft } = useReportDraft();
  const [submitting, setSubmitting] = useState(false);
  const [submitFailed, setSubmitFailed] = useState(false);
  const [sitePickerVisible, setSitePickerVisible] = useState(false);
  const submissionInFlight = useRef(false);
  const analysis = draft.analysis;

  const methodLabel = t(getMethodLabelKey(draft.reportingMethod));
  const siteLabel = draft.site ? t(getSiteLabelKey(draft.site)) : t("textReport.sitePlaceholder");
  const photoStatus = draft.photoUri
    ? t("submit.photoAttached")
    : t("submit.photoNotAdded");

  const handleSiteSelect = (site: ReportSite) => {
    updateDraft({ site });
    setSitePickerVisible(false);
  };

  const handleSubmit = async () => {
    if (submitting || submissionInFlight.current) {
      return;
    }

    submissionInFlight.current = true;
    setSubmitting(true);
    setSubmitFailed(false);

    try {
      if (!isOnline) {
        const report = await queueReportForOfflineProcessing(draft);

        resetDraft();
        router.replace({
          pathname: "/report/success",
          params: { reportId: report.id },
        });
        return;
      }

      const finalDraft = draft.analysis
        ? draft
        : {
            ...draft,
            analysis: await analysisService.analyseReport(draft),
          };

      if (!draft.analysis) {
        updateDraft({ analysis: finalDraft.analysis });
      }

      const report = await submitReport(finalDraft);
      resetDraft();
      router.replace({
        pathname: "/report/success",
        params: { reportId: report.id },
      });
    } catch (error) {
      if (error instanceof MediaPersistenceError) {
        setSubmitFailed(true);
        return;
      }

      setSubmitFailed(true);
    } finally {
      submissionInFlight.current = false;
      setSubmitting(false);
    }
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
          <Text style={styles.title}>{t("submit.title")}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.intro}>
          <Text style={styles.heading}>{t("submit.heading")}</Text>
          <Text style={styles.subtitle}>{t("submit.subtitle")}</Text>
        </View>

        <View style={styles.siteSection}>
          <Text style={styles.fieldLabel}>{t("textReport.site")}</Text>
          <Pressable
            accessibilityLabel={t("textReport.site")}
            accessibilityRole="button"
            disabled={submitting}
            onPress={() => setSitePickerVisible(true)}
            style={({ pressed }) => [
              styles.siteSelect,
              pressed ? styles.pressed : null,
            ]}
          >
            <MaterialIcons color={colors.primary} name="factory" size={31} />
            <Text
              style={[
                styles.siteSelectText,
                draft.site ? styles.siteSelectedText : styles.sitePlaceholderText,
              ]}
            >
              {siteLabel}
            </Text>
            <MaterialIcons
              color={colors.textMuted}
              name="keyboard-arrow-down"
              size={30}
            />
          </Pressable>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.cardTitle}>{t("submit.summaryTitle")}</Text>
          <SummaryRow
            icon="notes"
            label={t("submit.observation")}
            value={draft.description || t("submit.notProvided")}
          />
          <SummaryRow
            icon="factory"
            label={t("submit.site")}
            value={draft.site ? siteLabel : t("submit.notProvided")}
          />
          {draft.area ? (
            <SummaryRow
              icon="domain"
              label={t("submit.area")}
              value={draft.area}
            />
          ) : null}
          <SummaryRow
            icon="record-voice-over"
            label={t("submit.reportMethod")}
            value={methodLabel}
          />
          <SummaryRow
            icon="photo-camera"
            label={t("submit.supportingPhoto")}
            thumbnailUri={draft.photoUri}
            value={photoStatus}
          />
          {analysis?.barrierFailure ? (
            <SummaryRow
              icon="verified-user"
              label={t("submit.safetyConcern")}
              value={translateAnalysisValue(analysis.barrierFailure, t)}
            />
          ) : null}
          {analysis?.lifeSavingRules.length ? (
            <SummaryRow
              icon="assignment"
              label={t("submit.lifeSavingRule")}
              value={translateAnalysisList(analysis.lifeSavingRules, t)}
            />
          ) : null}
          {analysis?.potentialConsequence ? (
            <SummaryRow
              icon="warning-amber"
              label={t("submit.potentialConsequence")}
              last
              value={translateAnalysisValue(analysis.potentialConsequence, t)}
            />
          ) : null}
        </View>

        <View style={styles.anonymousCard}>
          <View style={styles.anonymousIcon}>
            <MaterialIcons color={colors.white} name="verified-user" size={34} />
          </View>
          <View style={styles.anonymousCopy}>
            <Text style={styles.anonymousTitle}>
              {t("submit.anonymousTitle")}
            </Text>
            <Text style={styles.anonymousSubtitle}>
              {t("submit.anonymousSubtitle")}
            </Text>
          </View>
        </View>

        {!analysis ? (
          <View style={styles.pendingCard}>
            <MaterialIcons color={colors.primary} name="schedule" size={30} />
            <View style={styles.errorCopy}>
              <Text style={styles.pendingTitle}>{t("offline.analysisPending")}</Text>
              <Text style={styles.errorSubtitle}>
                {t("offline.analysisPendingDescription")}
              </Text>
            </View>
          </View>
        ) : null}

        {submitFailed ? (
          <View style={styles.errorCard}>
            <MaterialIcons color={colors.danger} name="error-outline" size={30} />
            <View style={styles.errorCopy}>
              <Text style={styles.errorTitle}>{t("submit.errorTitle")}</Text>
              <Text style={styles.errorSubtitle}>
                {t("submit.errorSubtitle")}
              </Text>
            </View>
          </View>
        ) : null}

        {submitting ? (
          <View style={styles.loadingCard}>
            <Text style={styles.loadingTitle}>{t("submit.submitting")}</Text>
            <Text style={styles.loadingSubtitle}>
              {t("submit.submittingSubtitle")}
            </Text>
          </View>
        ) : null}

        <AppButton
          disabled={submitting}
          loading={submitting}
          onPress={handleSubmit}
          style={styles.submitButton}
          title={submitFailed ? t("submit.tryAgain") : t("submit.submitButton")}
        />
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={() => setSitePickerVisible(false)}
        transparent
        visible={sitePickerVisible}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => setSitePickerVisible(false)}
          style={styles.modalBackdrop}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={styles.siteSheet}
          >
            <Text style={styles.siteSheetTitle}>{t("textReport.site")}</Text>
            {siteOptions.map((option) => {
              const selected = draft.site === option.value;

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={option.value}
                  onPress={() => handleSiteSelect(option.value)}
                  style={({ pressed }) => [
                    styles.siteOption,
                    selected ? styles.siteOptionSelected : null,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <Text style={styles.siteOptionText}>{t(option.labelKey)}</Text>
                  {selected ? (
                    <MaterialIcons color={colors.primary} name="check" size={24} />
                  ) : null}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function SummaryRow({
  icon,
  label,
  last = false,
  thumbnailUri,
  value,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  last?: boolean;
  thumbnailUri?: string;
  value: string;
}) {
  return (
    <View style={[styles.summaryRow, last ? styles.summaryRowLast : null]}>
      <View style={styles.rowIconWrap}>
        {thumbnailUri ? (
          <Image source={{ uri: thumbnailUri }} style={styles.thumbnail} />
        ) : (
          <MaterialIcons color={colors.primary} name={icon} size={28} />
        )}
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

function getMethodLabelKey(method: string): TranslationKey {
  if (method === "voice") {
    return "submit.voice";
  }

  if (method === "photo") {
    return "submit.photo";
  }

  return "submit.text";
}

function getSiteLabelKey(site: ReportSite): TranslationKey {
  if (site === "Barauni") {
    return "textReport.siteBarauni";
  }

  if (site === "Digboi") {
    return "textReport.siteDigboi";
  }

  if (site === "Panipat") {
    return "textReport.sitePanipat";
  }

  return "textReport.siteMathura";
}

const styles = StyleSheet.create({
  anonymousCard: {
    alignItems: "center",
    backgroundColor: colors.surfaceGreen,
    borderRadius: radius.lg,
    flexDirection: "row",
    gap: spacing.lg,
    padding: spacing.lg,
  },
  anonymousCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  anonymousIcon: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 58,
    justifyContent: "center",
    width: 58,
  },
  anonymousSubtitle: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 23,
  },
  anonymousTitle: {
    color: colors.primaryDark,
    fontSize: typography.subheading,
    fontWeight: "900",
  },
  backButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: touchTarget.minHeight,
    width: 48,
  },
  cardTitle: {
    color: colors.text,
    fontSize: typography.subheading,
    fontWeight: "900",
    paddingBottom: spacing.sm,
  },
  content: {
    flexGrow: 1,
    gap: spacing.lg,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  errorCard: {
    alignItems: "flex-start",
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.lg,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg,
  },
  errorCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  errorSubtitle: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
  },
  errorTitle: {
    color: colors.danger,
    fontSize: typography.body,
    fontWeight: "900",
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 24,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerSpacer: {
    width: 48,
  },
  heading: {
    color: colors.primaryDark,
    fontSize: typography.title,
    fontWeight: "900",
    lineHeight: 34,
  },
  intro: {
    gap: spacing.sm,
  },
  loadingCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  loadingSubtitle: {
    color: colors.textMuted,
    fontSize: typography.body,
  },
  loadingTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "900",
  },
  modalBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(23, 33, 27, 0.32)",
    flex: 1,
    justifyContent: "flex-end",
    padding: spacing.xl,
  },
  pendingCard: {
    alignItems: "flex-start",
    backgroundColor: colors.surfaceGreen,
    borderRadius: radius.lg,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg,
  },
  pendingTitle: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.78,
  },
  rowCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  rowIconWrap: {
    alignItems: "center",
    backgroundColor: colors.surfaceGreen,
    borderRadius: radius.md,
    height: 48,
    justifyContent: "center",
    overflow: "hidden",
    width: 48,
  },
  rowLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "800",
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
  submitButton: {
    borderRadius: radius.lg,
    marginTop: "auto",
    minHeight: 60,
  },
  siteOption: {
    alignItems: "center",
    borderRadius: radius.md,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 56,
    paddingHorizontal: spacing.md,
  },
  siteOptionSelected: {
    backgroundColor: colors.primarySoft,
  },
  siteOptionText: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "700",
  },
  sitePlaceholderText: {
    color: "#7B8494",
  },
  siteSection: {
    gap: spacing.sm,
  },
  siteSelect: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 64,
    paddingHorizontal: spacing.lg,
  },
  siteSelectedText: {
    color: colors.text,
  },
  siteSelectText: {
    flex: 1,
    fontSize: typography.subheading,
    fontWeight: "700",
  },
  siteSheet: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    gap: spacing.sm,
    padding: spacing.lg,
    width: "100%",
  },
  siteSheetTitle: {
    color: colors.text,
    fontSize: typography.subheading,
    fontWeight: "900",
    paddingBottom: spacing.sm,
  },
  subtitle: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 24,
  },
  summaryCard: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  summaryRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  summaryRowLast: {
    borderBottomWidth: 0,
  },
  thumbnail: {
    height: "100%",
    width: "100%",
  },
  title: {
    color: colors.text,
    flex: 1,
    fontSize: typography.heading,
    fontWeight: "900",
    textAlign: "center",
  },
});
