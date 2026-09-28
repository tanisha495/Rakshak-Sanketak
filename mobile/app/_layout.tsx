import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";

import { GlobalOfflineBanner } from "@/components";
import { colors } from "@/constants";
import { NetworkProvider } from "@/context/network-provider";
import { LanguageProvider } from "@/i18n";
import { useLanguage } from "@/i18n/use-language";
import { ReportDraftProvider } from "@/report-draft";
import { SplashScreen } from "@/screens";

export default function RootLayout() {
  return (
    <LanguageProvider>
      <NetworkProvider>
        <ReportDraftProvider>
          <StatusBar style="dark" />
          <StartupGate />
        </ReportDraftProvider>
      </NetworkProvider>
    </LanguageProvider>
  );
}

function StartupGate() {
  const { hasSelectedLanguage, isReady } = useLanguage();
  const [minimumSplashElapsed, setMinimumSplashElapsed] = useState(false);
  const [startupComplete, setStartupComplete] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMinimumSplashElapsed(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isReady || !minimumSplashElapsed || startupComplete) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      router.replace(hasSelectedLanguage ? "/home" : "/language");
      setStartupComplete(true);
    });

    return () => cancelAnimationFrame(frame);
  }, [hasSelectedLanguage, isReady, minimumSplashElapsed, startupComplete]);

  if (!startupComplete) {
    return <SplashScreen />;
  }

  return (
    <>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="alerts/[id]" />
        <Stack.Screen name="language" />
        <Stack.Screen name="more/about" />
        <Stack.Screen name="more/anonymous-reporting" />
        <Stack.Screen name="more/data-privacy" />
        <Stack.Screen name="more/language" />
        <Stack.Screen name="more/offline" />
        <Stack.Screen name="more/reporting-guide" />
        <Stack.Screen name="report/voice" />
        <Stack.Screen name="report/text" />
        <Stack.Screen name="report/review" />
        <Stack.Screen name="report/photo" />
        <Stack.Screen name="report/submit" />
        <Stack.Screen name="report/success" />
        <Stack.Screen name="report-details/[id]" />
      </Stack>
      <GlobalOfflineBanner />
    </>
  );
}
