import { Link, type Href } from "expo-router";
import type { ComponentProps, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { colors, radius, spacing, touchTarget, typography } from "@/constants";

type ButtonVariant = "primary" | "secondary" | "outline" | "danger";

interface AppButtonProps extends PressableProps {
  title: string;
  icon?: ReactNode;
  href?: Href;
  loading?: boolean;
  variant?: ButtonVariant;
  style?: StyleProp<ViewStyle>;
}

export function AppButton({
  title,
  icon,
  href,
  loading = false,
  variant = "primary",
  disabled,
  style,
  ...pressableProps
}: AppButtonProps) {
  const isDisabled = disabled || loading;

  const content = (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && !isDisabled ? styles.pressed : null,
        isDisabled ? styles.disabled : null,
        style,
      ]}
      {...pressableProps}
    >
      {loading ? <ActivityIndicator color={getTextColor(variant)} /> : icon}
      <Text style={[styles.label, { color: getTextColor(variant) }]}>
        {title}
      </Text>
    </Pressable>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} asChild>
      {content as ComponentProps<typeof Link>["children"]}
    </Link>
  );
}

function getTextColor(variant: ButtonVariant): string {
  if (variant === "secondary" || variant === "outline") {
    return colors.primary;
  }

  return colors.white;
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    borderRadius: radius.md,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    minHeight: touchTarget.minHeight,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  danger: {
    backgroundColor: colors.danger,
  },
  disabled: {
    opacity: 0.55,
  },
  label: {
    fontSize: typography.body,
    fontWeight: "700",
  },
  outline: {
    backgroundColor: colors.white,
    borderColor: colors.primary,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.82,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.primarySoft,
  },
});
