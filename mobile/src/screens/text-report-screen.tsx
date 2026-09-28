import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppButton } from "@/components";
import { colors, radius, spacing, touchTarget, typography } from "@/constants";
import type { TranslationKey } from "@/i18n";
import { useLanguage } from "@/i18n/use-language";
import { type ReportSite, useReportDraft } from "@/report-draft";

const maxDescriptionLength = 1000;
const minDescriptionLength = 10;

const siteOptions: Array<{ value: ReportSite; labelKey: TranslationKey }> = [
  { value: "Mathura", labelKey: "textReport.siteMathura" },
  { value: "Barauni", labelKey: "textReport.siteBarauni" },
  { value: "Digboi", labelKey: "textReport.siteDigboi" },
  { value: "Panipat", labelKey: "textReport.sitePanipat" },
];

export function TextReportScreen() {
  const { language, t } = useLanguage();
  const { draft, replaceDraft, updateDraft } = useReportDraft();
  const [description, setDescription] = useState(
    draft.reportingMethod === "text" ? draft.description : "",
  );
  const [site, setSite] = useState<ReportSite | undefined>(
    draft.reportingMethod === "text" ? draft.site : undefined,
  );
  const [area, setArea] = useState(
    draft.reportingMethod === "text" ? draft.area ?? "" : "",
  );
  const [sitePickerVisible, setSitePickerVisible] = useState(false);

  useEffect(() => {
    updateDraft({
      area,
      description,
      reportLanguage: language,
      reportingMethod: "text",
      site,
    });
  }, [area, description, language, site, updateDraft]);

  const trimmedDescription = description.trim();
  const canContinue = trimmedDescription.length >= minDescriptionLength;
  const selectedSiteLabel = useMemo(() => {
    if (!site) {
      return t("textReport.sitePlaceholder");
    }

    return t(getSiteLabelKey(site));
  }, [site, t]);

  const handleDescriptionChange = (nextDescription: string) => {
    setDescription(nextDescription);
    updateDraft({
      description: nextDescription,
      reportLanguage: language,
      reportingMethod: "text",
    });
  };

  const handleAreaChange = (nextArea: string) => {
    setArea(nextArea);
    updateDraft({
      area: nextArea,
      reportLanguage: language,
      reportingMethod: "text",
    });
  };

  const handleSiteSelect = (nextSite: ReportSite) => {
    setSite(nextSite);
    setSitePickerVisible(false);
    updateDraft({
      reportLanguage: language,
      reportingMethod: "text",
      site: nextSite,
    });
  };

  const handleContinue = () => {
    if (!canContinue) {
      return;
    }

    Keyboard.dismiss();
    replaceDraft({
      area: area.trim() || undefined,
      description: trimmedDescription,
      reportLanguage: language,
      reportingMethod: "text",
      site,
    });
    router.push("/report/review");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === "ios" ? "padding" : "height"}
        style={styles.keyboardRoot}
      >
        <TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.content}
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled"
          >
            <View pointerEvents="none" style={styles.decorativeCircle} />

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
              <Text style={styles.title}>{t("textReport.title")}</Text>
              <View style={styles.headerSpacer} />
            </View>

            <View style={styles.intro}>
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.82}
                numberOfLines={2}
                style={styles.heading}
              >
                {t("textReport.heading")}
              </Text>
              <Text style={styles.description}>{t("textReport.description")}</Text>
            </View>

            <View style={styles.inputCard}>
              <Text style={styles.fieldTitle}>{t("textReport.descriptionLabel")}</Text>
              <View style={styles.textAreaWrap}>
                <TextInput
                  accessibilityLabel={t("textReport.descriptionLabel")}
                  maxLength={maxDescriptionLength}
                  multiline
                  onChangeText={handleDescriptionChange}
                  placeholder={t("textReport.descriptionPlaceholder")}
                  placeholderTextColor="#7B8494"
                  returnKeyType="default"
                  style={styles.textArea}
                  textAlignVertical="top"
                  value={description}
                />
                <Text style={styles.counter}>
                  {description.length} / {maxDescriptionLength}
                </Text>
              </View>
            </View>

            <View style={styles.helpCard}>
              <View style={styles.helpIconWrap}>
                <MaterialIcons color={colors.primary} name="tips-and-updates" size={40} />
              </View>
              <View style={styles.helpCopy}>
                <Text style={styles.helpTitle}>{t("textReport.helpTitle")}</Text>
                <Bullet text={t("textReport.helpActivity")} />
                <Bullet text={t("textReport.helpUnsafe")} />
                <Bullet text={t("textReport.helpLocation")} />
              </View>
            </View>

            <View style={styles.locationSection}>
              <Text style={styles.sectionTitle}>{t("textReport.locationTitle")}</Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>{t("textReport.site")}</Text>
                <Pressable
                  accessibilityLabel={t("textReport.site")}
                  accessibilityRole="button"
                  onPress={() => setSitePickerVisible(true)}
                  style={({ pressed }) => [
                    styles.selectField,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <MaterialIcons color={colors.primary} name="factory" size={33} />
                  <Text
                    style={[styles.selectText, site ? styles.inputText : styles.placeholderText]}
                  >
                    {selectedSiteLabel}
                  </Text>
                  <MaterialIcons color={colors.textMuted} name="keyboard-arrow-down" size={32} />
                </Pressable>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>{t("textReport.area")}</Text>
                <View style={styles.singleLineField}>
                  <MaterialIcons color={colors.primary} name="domain" size={32} />
                  <TextInput
                    accessibilityLabel={t("textReport.area")}
                    onChangeText={handleAreaChange}
                    placeholder={t("textReport.areaPlaceholder")}
                    placeholderTextColor="#7B8494"
                    returnKeyType="done"
                    style={styles.singleLineInput}
                    value={area}
                  />
                </View>
              </View>
            </View>

            <View style={styles.anonymousCard}>
              <View style={styles.shieldWrap}>
                <MaterialIcons color={colors.white} name="verified-user" size={46} />
              </View>
              <View style={styles.anonymousCopy}>
                <Text style={styles.anonymousTitle}>
                  {t("textReport.anonymousTitle")}
                </Text>
                <Text style={styles.anonymousDescription}>
                  {t("textReport.anonymousDescription")}
                </Text>
              </View>
            </View>

            <AppButton
              disabled={!canContinue}
              onPress={handleContinue}
              style={styles.continueButton}
              title={t("textReport.continue")}
            />
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

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
              const selected = site === option.value;

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

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletDot} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  anonymousCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  anonymousDescription: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 24,
  },
  anonymousTitle: {
    color: colors.primaryDark,
    fontSize: typography.subheading,
    fontWeight: "900",
    lineHeight: 24,
  },
  backButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: touchTarget.minHeight,
    width: 48,
  },
  bulletDot: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 8,
    marginTop: 9,
    width: 8,
  },
  bulletRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  bulletText: {
    color: colors.text,
    flex: 1,
    fontSize: typography.body,
    lineHeight: 26,
  },
  content: {
    flexGrow: 1,
    gap: spacing.lg,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  continueButton: {
    borderRadius: radius.lg,
    minHeight: 64,
  },
  counter: {
    bottom: spacing.md,
    color: colors.textMuted,
    fontSize: typography.body,
    fontVariant: ["tabular-nums"],
    position: "absolute",
    right: spacing.md,
  },
  decorativeCircle: {
    backgroundColor: "rgba(15, 107, 58, 0.07)",
    borderRadius: radius.pill,
    height: 240,
    position: "absolute",
    right: -92,
    top: 108,
    width: 240,
  },
  description: {
    color: colors.textMuted,
    fontSize: typography.subheading,
    lineHeight: 27,
  },
  fieldGroup: {
    gap: spacing.sm,
  },
  fieldTitle: {
    color: colors.text,
    fontSize: typography.subheading,
    fontWeight: "900",
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
  helpCard: {
    alignItems: "flex-start",
    backgroundColor: colors.surfaceGreen,
    borderRadius: radius.lg,
    flexDirection: "row",
    gap: spacing.lg,
    padding: spacing.xl,
  },
  helpCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  helpIconWrap: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    height: 68,
    justifyContent: "center",
    width: 68,
  },
  helpTitle: {
    color: colors.primaryDark,
    fontSize: typography.subheading,
    fontWeight: "900",
    lineHeight: 24,
  },
  inputCard: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  inputText: {
    color: colors.text,
  },
  intro: {
    gap: spacing.sm,
    paddingTop: spacing.xl,
  },
  keyboardRoot: {
    flex: 1,
  },
  label: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 24,
  },
  locationSection: {
    gap: spacing.lg,
  },
  modalBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(23, 33, 27, 0.32)",
    flex: 1,
    justifyContent: "flex-end",
    padding: spacing.xl,
  },
  placeholderText: {
    color: "#7B8494",
  },
  pressed: {
    opacity: 0.78,
  },
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: "900",
    lineHeight: 29,
  },
  selectField: {
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
  selectText: {
    flex: 1,
    fontSize: typography.subheading,
  },
  shieldWrap: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 76,
    justifyContent: "center",
    width: 76,
  },
  singleLineField: {
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
  singleLineInput: {
    color: colors.text,
    flex: 1,
    fontSize: typography.subheading,
    minHeight: 56,
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
  textArea: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 24,
    minHeight: 170,
    paddingBottom: 42,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  textAreaWrap: {
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 178,
  },
  title: {
    color: colors.text,
    flex: 1,
    fontSize: typography.heading,
    fontWeight: "900",
    textAlign: "center",
  },
});
