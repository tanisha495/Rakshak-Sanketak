import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, spacing, typography } from "@/constants";
import { useLanguage } from "@/i18n/use-language";

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
}

export function AppHeader({ title, subtitle, showBack = false }: AppHeaderProps) {
  const { t } = useLanguage();

  return (
    <View style={styles.container}>
      {showBack ? (
        <Pressable
          accessibilityLabel={t("common.goBack")}
          accessibilityRole="button"
          hitSlop={spacing.md}
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <MaterialIcons color={colors.primary} name="arrow-back" size={24} />
        </Pressable>
      ) : null}
      <View style={styles.titleWrap}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  container: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
    marginTop: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: "800",
  },
  titleWrap: {
    flex: 1,
  },
});
