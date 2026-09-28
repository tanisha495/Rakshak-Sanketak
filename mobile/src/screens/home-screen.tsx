import { MaterialIcons } from "@expo/vector-icons";
import { router, type Href, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components";
import { colors, radius, spacing, touchTarget, typography } from "@/constants";
import { useLanguage } from "@/i18n/use-language";
import { getUnreadSafetyAlertCount } from "@/services";

export function HomeScreen() {
  const { t } = useLanguage();
  const [unreadAlerts, setUnreadAlerts] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      getUnreadSafetyAlertCount().then((count) => {
        if (mounted) {
          setUnreadAlerts(count);
        }
      });

      return () => {
        mounted = false;
      };
    }, []),
  );

  return (
    <ScreenContainer style={styles.screen}>
      <View pointerEvents="none" style={styles.decorOne} />
      <View pointerEvents="none" style={styles.decorTwo} />

      <View style={styles.header}>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <MaterialIcons color={colors.primaryDark} name="person-pin" size={32} />
          </View>
          <View style={styles.identityCopy}>
            <Text style={styles.reportingAs}>{t("home.reportingAs")}</Text>
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.82}
              numberOfLines={1}
              style={styles.anonymous}
            >
              {t("home.anonymous")}
            </Text>
          </View>
        </View>

        <Pressable
          accessibilityLabel={t("home.notifications")}
          accessibilityRole="button"
          hitSlop={spacing.md}
          onPress={() => router.push("/alerts")}
          style={({ pressed }) => [styles.bellButton, pressed && styles.pressed]}
        >
          <MaterialIcons color={colors.text} name="notifications-none" size={31} />
          {unreadAlerts > 0 ? (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>
                {unreadAlerts > 9 ? "9+" : unreadAlerts}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <View style={styles.greetingBlock}>
        <Text style={styles.greeting}>{t("home.greeting")}</Text>
        <Text style={styles.subtitle}>{t("home.subtitleLine1")}</Text>
        <Text style={styles.subtitle}>{t("home.subtitleLine2")}</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/report/voice")}
        style={({ pressed }) => [styles.voiceCard, pressed && styles.voicePressed]}
      >
        <MaterialIcons color={colors.white} name="mic" size={54} />
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.78}
          numberOfLines={2}
          style={styles.voiceTitle}
        >
          {t("home.reportByVoice")}
        </Text>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.78}
          numberOfLines={2}
          style={styles.voiceSubtitle}
        >
          {t("home.reportByVoiceSubtitle")}
        </Text>
      </Pressable>

      <View style={styles.secondaryGrid}>
        <HomeActionCard
          href="/report/text"
          icon="edit"
          label={t("home.typeReport")}
        />
        <HomeActionCard
          href="/report/photo"
          icon="photo-camera"
          label={t("home.addPhoto")}
        />
      </View>

      <View style={styles.listCard}>
        <HomeListItem
          href="/reports"
          icon="assignment"
          iconBackground={colors.surfaceGreen}
          iconColor={colors.primary}
          subtitle={t("home.myReportsSubtitle")}
          title={t("home.myReports")}
        />
        <View style={styles.listDivider} />
        <HomeListItem
          href="/alerts"
          icon="notifications"
          iconBackground={colors.dangerSoft}
          iconColor={colors.danger}
          subtitle={t("home.safetyAlertsSubtitle")}
          title={t("home.safetyAlerts")}
        />
      </View>

      <View style={styles.messageCard}>
        <View style={styles.messageIcon}>
          <MaterialIcons color={colors.primary} name="info" size={24} />
        </View>
        <View style={styles.messageCopy}>
          <Text style={styles.messageTitle}>{t("home.smallReportsMessage")}</Text>
          <Text style={styles.messageSubtitle}>{t("home.thankYouMessage")}</Text>
        </View>
      </View>
    </ScreenContainer>
  );
}

interface HomeActionCardProps {
  href: Href;
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
}

function HomeActionCard({ href, icon, label }: HomeActionCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(href)}
      style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]}
    >
      <MaterialIcons color={colors.primary} name={icon} size={40} />
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.72}
        numberOfLines={3}
        style={styles.actionLabel}
      >
        {label}
      </Text>
    </Pressable>
  );
}

interface HomeListItemProps {
  href: Href;
  icon: keyof typeof MaterialIcons.glyphMap;
  iconBackground: string;
  iconColor: string;
  subtitle: string;
  title: string;
}

function HomeListItem({
  href,
  icon,
  iconBackground,
  iconColor,
  subtitle,
  title,
}: HomeListItemProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(href)}
      style={({ pressed }) => [styles.listItem, pressed && styles.pressed]}
    >
      <View style={[styles.listIcon, { backgroundColor: iconBackground }]}>
        <MaterialIcons color={iconColor} name={icon} size={32} />
      </View>
      <View style={styles.listCopy}>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.78}
          numberOfLines={1}
          style={styles.listTitle}
        >
          {title}
        </Text>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.78}
          numberOfLines={1}
          style={styles.listSubtitle}
        >
          {subtitle}
        </Text>
      </View>
      <MaterialIcons color={colors.text} name="chevron-right" size={30} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actionCard: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    boxShadow: "0 3px 10px rgba(0, 0, 0, 0.07)",
    flex: 1,
    gap: spacing.sm,
    justifyContent: "center",
    minHeight: 138,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },
  actionLabel: {
    color: colors.text,
    fontSize: 25,
    fontWeight: "900",
    lineHeight: 30,
    textAlign: "center",
  },
  anonymous: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 26,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.surfaceGreen,
    borderRadius: radius.pill,
    height: 58,
    justifyContent: "center",
    width: 58,
  },
  bellButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: touchTarget.minHeight,
    minWidth: touchTarget.minHeight,
  },
  bellBadge: {
    alignItems: "center",
    backgroundColor: colors.danger,
    borderColor: colors.white,
    borderRadius: radius.pill,
    borderWidth: 2,
    minHeight: 20,
    minWidth: 20,
    paddingHorizontal: 4,
    position: "absolute",
    right: 2,
    top: 3,
  },
  bellBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 14,
  },
  decorOne: {
    backgroundColor: colors.surfaceGreen,
    borderRadius: radius.pill,
    height: 156,
    opacity: 0.5,
    position: "absolute",
    right: -86,
    top: 196,
    width: 156,
  },
  decorTwo: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    height: 112,
    opacity: 0.26,
    position: "absolute",
    right: -32,
    top: 250,
    width: 112,
  },
  greeting: {
    color: colors.primaryDark,
    fontSize: 36,
    fontWeight: "900",
    lineHeight: 42,
  },
  greetingBlock: {
    gap: spacing.xs,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  identity: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing.md,
  },
  identityCopy: {
    flex: 1,
  },
  listCard: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    boxShadow: "0 3px 10px rgba(0, 0, 0, 0.06)",
    overflow: "hidden",
  },
  listCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  listDivider: {
    backgroundColor: colors.border,
    height: 1,
    marginLeft: 78,
  },
  listIcon: {
    alignItems: "center",
    borderRadius: radius.sm,
    height: 50,
    justifyContent: "center",
    width: 50,
  },
  listItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 86,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  listSubtitle: {
    color: colors.textMuted,
    fontSize: 18,
    lineHeight: 23,
  },
  listTitle: {
    color: colors.text,
    fontSize: 23,
    fontWeight: "900",
    lineHeight: 28,
  },
  messageCard: {
    alignItems: "center",
    backgroundColor: colors.surfaceGreen,
    borderRadius: radius.lg,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 96,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  messageCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  messageIcon: {
    alignItems: "center",
    borderColor: colors.primary,
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  messageSubtitle: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 22,
  },
  messageTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 25,
  },
  pressed: {
    opacity: 0.78,
  },
  reportingAs: {
    color: colors.textMuted,
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 21,
  },
  screen: {
    gap: spacing.lg,
    paddingBottom: spacing.lg,
    paddingHorizontal: 20,
    paddingTop: spacing.md,
  },
  secondaryGrid: {
    flexDirection: "row",
    gap: spacing.md,
  },
  subtitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "500",
    lineHeight: 31,
  },
  voiceCard: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 22,
    boxShadow: "0 5px 14px rgba(0, 0, 0, 0.14)",
    gap: spacing.sm,
    justifyContent: "center",
    minHeight: 180,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    width: "100%",
  },
  voicePressed: {
    opacity: 0.88,
  },
  voiceSubtitle: {
    color: colors.white,
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 22,
    opacity: 0.92,
    textAlign: "center",
  },
  voiceTitle: {
    color: colors.white,
    fontSize: 29,
    fontWeight: "900",
    lineHeight: 35,
    textAlign: "center",
  },
});
