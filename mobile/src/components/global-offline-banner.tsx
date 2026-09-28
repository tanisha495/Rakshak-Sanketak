import { MaterialIcons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radius, spacing, typography } from "@/constants";
import { useLanguage } from "@/i18n/use-language";
import { useNetworkStatus } from "@/hooks/use-network-status";

type BannerState = "hidden" | "offline" | "backOnline";

export function GlobalOfflineBanner() {
  const { t } = useLanguage();
  const { isOnline, isUnknown } = useNetworkStatus();
  const [bannerState, setBannerState] = useState<BannerState>("hidden");
  const wasOffline = useRef(false);

  useEffect(() => {
    if (isUnknown) {
      return;
    }

    if (!isOnline) {
      wasOffline.current = true;
      setBannerState("offline");
      return;
    }

    if (wasOffline.current) {
      setBannerState("backOnline");
      const timer = setTimeout(() => {
        setBannerState("hidden");
        wasOffline.current = false;
      }, 2200);

      return () => clearTimeout(timer);
    }
  }, [isOnline, isUnknown]);

  if (bannerState === "hidden") {
    return null;
  }

  const backOnline = bannerState === "backOnline";

  return (
    <SafeAreaView pointerEvents="none" style={styles.safeArea}>
      <View
        style={[
          styles.banner,
          backOnline ? styles.onlineBanner : styles.offlineBanner,
        ]}
      >
        <MaterialIcons
          color={backOnline ? colors.primary : colors.warning}
          name={backOnline ? "wifi" : "signal-wifi-off"}
          size={22}
        />
        <View style={styles.copy}>
          <Text style={styles.title}>
            {backOnline ? t("network.backOnline") : t("network.offline")}
          </Text>
          {!backOnline ? (
            <Text style={styles.subtitle}>{t("network.offlineDescription")}</Text>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignItems: "center",
    borderRadius: radius.lg,
    borderWidth: 1,
    boxShadow: "0 8px 18px rgba(23, 33, 27, 0.12)",
    flexDirection: "row",
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  offlineBanner: {
    backgroundColor: colors.warningSoft,
    borderColor: "#F5DF9A",
  },
  onlineBanner: {
    backgroundColor: colors.surfaceGreen,
    borderColor: colors.primarySoft,
  },
  safeArea: {
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 50,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.small,
    lineHeight: 16,
  },
  title: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: "900",
  },
});
