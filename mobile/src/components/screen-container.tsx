import type { ReactNode } from "react";
import {
  ScrollView,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing } from "@/constants";

interface ScreenContainerProps {
  children: ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function ScreenContainer({
  children,
  scroll = true,
  style,
}: ScreenContainerProps) {
  if (!scroll) {
    return <SafeAreaView style={[styles.safeArea, styles.content, style]}>{children}</SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.content, style]}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    padding: spacing.xl,
  },
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
});
