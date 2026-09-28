import { MaterialIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

import { colors, typography } from "@/constants";
import { useLanguage } from "@/i18n/use-language";

export default function TabLayout() {
  const { t } = useLanguage();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: typography.small,
          fontWeight: "700",
        },
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          minHeight: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t("navigation.home"),
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons color={color} name="home" size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: t("navigation.reports"),
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons color={color} name="assignment" size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: t("navigation.alerts"),
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons color={color} name="campaign" size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t("navigation.more"),
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons color={color} name="more-horiz" size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
