import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, typography } from "@/constants";

interface EmptyStateProps {
  title: string;
  message: string;
  action?: ReactNode;
}

export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    marginTop: spacing.lg,
  },
  container: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.xl,
  },
  message: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 23,
    marginTop: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: typography.subheading,
    fontWeight: "800",
  },
});
