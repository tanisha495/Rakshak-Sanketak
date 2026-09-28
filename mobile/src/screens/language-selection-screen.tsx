import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppButton, ScreenContainer } from "@/components";
import { colors, radius, spacing, typography } from "@/constants";
import type { AppLanguage, TranslationKey } from "@/i18n";
import { useLanguage } from "@/i18n/use-language";

const languageOptions: Array<{
  code: AppLanguage;
  labelKey: TranslationKey;
  nameKey: TranslationKey;
  supportKey: TranslationKey;
}> = [
  {
    code: "en",
    nameKey: "language.englishName",
    labelKey: "language.englishLabel",
    supportKey: "language.englishSupport",
  },
  {
    code: "hi",
    nameKey: "language.hindiName",
    labelKey: "language.hindiLabel",
    supportKey: "language.hindiSupport",
  },
  {
    code: "as",
    nameKey: "language.assameseName",
    labelKey: "language.assameseLabel",
    supportKey: "language.assameseSupport",
  },
];

export function LanguageSelectionScreen() {
  const { hasSelectedLanguage, language, setLanguage, t } = useLanguage();
  const [selectedLanguage, setSelectedLanguage] = useState<AppLanguage | null>(
    hasSelectedLanguage ? language : null,
  );
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
    if (!selectedLanguage) {
      return;
    }

    setSaving(true);
    await setLanguage(selectedLanguage);
    router.replace("/home");
  };

  return (
    <ScreenContainer>
      <View style={styles.logoWrap}>
        <MaterialIcons color={colors.primary} name="health-and-safety" size={36} />
      </View>

      <Text style={styles.title}>{t("language.title")}</Text>
      <Text style={styles.subtitle}>{t("language.subtitle")}</Text>

      <View style={styles.options}>
        {languageOptions.map((option) => {
          const selected = selectedLanguage === option.code;

          return (
            <Pressable
              accessibilityLabel={`${t(option.nameKey)} ${selected ? "selected" : ""}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={option.code}
              onPress={() => setSelectedLanguage(option.code)}
              style={({ pressed }) => [
                styles.card,
                selected ? styles.cardSelected : null,
                pressed ? styles.cardPressed : null,
              ]}
            >
              <View style={styles.cardText}>
                <Text style={styles.nativeName}>{t(option.nameKey)}</Text>
                <Text style={styles.languageLabel}>{t(option.labelKey)}</Text>
                <Text style={styles.supportText}>{t(option.supportKey)}</Text>
              </View>
              <View style={[styles.selectionCircle, selected && styles.selectionCircleActive]}>
                {selected ? (
                  <MaterialIcons color={colors.white} name="check" size={18} />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <AppButton
        disabled={!selectedLanguage || saving}
        loading={saving}
        onPress={handleContinue}
        title={t("common.continue")}
      />

      <Text style={styles.helper}>{t("language.helper")}</Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 104,
    padding: spacing.lg,
  },
  cardPressed: {
    opacity: 0.78,
  },
  cardSelected: {
    backgroundColor: colors.surfaceGreen,
    borderColor: colors.primary,
    borderWidth: 2,
  },
  cardText: {
    flex: 1,
    gap: spacing.xs,
  },
  helper: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 20,
    marginTop: spacing.lg,
    textAlign: "center",
  },
  languageLabel: {
    color: colors.textMuted,
    fontSize: typography.body,
  },
  logoWrap: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: colors.surfaceGreen,
    borderRadius: radius.pill,
    height: 64,
    justifyContent: "center",
    marginBottom: spacing.lg,
    width: 64,
  },
  nativeName: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: "800",
  },
  options: {
    gap: spacing.md,
    marginVertical: spacing.xl,
  },
  selectionCircle: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 32,
    justifyContent: "center",
    marginLeft: spacing.md,
    width: 32,
  },
  selectionCircleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 24,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  supportText: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: "700",
    lineHeight: 20,
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: "900",
    textAlign: "center",
  },
});
