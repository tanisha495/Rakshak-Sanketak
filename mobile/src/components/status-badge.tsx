import { StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, typography } from "@/constants";
import { useLanguage } from "@/i18n/use-language";
import type { ReportStatus } from "@/types";

interface StatusBadgeProps {
  status: ReportStatus;
}

const statusStyles: Record<
  ReportStatus,
  { backgroundColor: string; color: string }
> = {
  submitted: { backgroundColor: colors.surfaceGreen, color: colors.primary },
  under_review: { backgroundColor: colors.warningSoft, color: colors.warning },
  action_assigned: { backgroundColor: colors.infoSoft, color: colors.info },
  actioned: { backgroundColor: colors.primarySoft, color: colors.primary },
  verified: { backgroundColor: colors.successSoft, color: colors.success },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const style = statusStyles[status];
  const { t } = useLanguage();

  return (
    <View style={[styles.badge, { backgroundColor: style.backgroundColor }]}>
      <Text style={[styles.label, { color: style.color }]}>
        {t(`reportStatus.${status}`)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  label: {
    fontSize: typography.small,
    fontWeight: "800",
    textTransform: "uppercase",
  },
});
