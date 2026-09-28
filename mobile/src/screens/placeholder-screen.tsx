import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AppButton, AppHeader, ScreenContainer } from "@/components";
import { colors, radius, spacing, typography } from "@/constants";
import { useLanguage } from "@/i18n/use-language";

interface PlaceholderScreenProps {
  title: string;
  subtitle: string;
  body: string;
  primaryAction?: ReactNode;
  showBack?: boolean;
}

export function PlaceholderScreen({
  title,
  subtitle,
  body,
  primaryAction,
  showBack = true,
}: PlaceholderScreenProps) {
  const { t } = useLanguage();

  return (
    <ScreenContainer>
      <AppHeader showBack={showBack} subtitle={subtitle} title={title} />
      <View style={styles.card}>
        <Text style={styles.body}>{body}</Text>
      </View>
      {primaryAction ?? (
        <AppButton href="/home" title={t("common.backToHome")} variant="secondary" />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 24,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
});
