import AsyncStorage from "@react-native-async-storage/async-storage";

import { mockSafetyAlerts } from "@/data";
import type { SafetyAlert } from "@/types";

const MOCK_DELAY_MS = 150;
const readAlertIdsStorageKey = "sanketak_read_alert_ids";
const cachedAlertsStorageKey = "sanketak_cached_safety_alerts";
const cachedAlertsUpdatedAtStorageKey =
  "sanketak_cached_safety_alerts_updated_at";

function wait(ms = MOCK_DELAY_MS): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function getSafetyAlerts(): Promise<SafetyAlert[]> {
  await wait();

  const readIds = await getReadAlertIds();

  const alerts = mockSafetyAlerts
    .map((alert) => ({
      ...alert,
      isRead: readIds.includes(alert.id),
    }))
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  await cacheSafetyAlerts(alerts);

  return alerts;
}

export async function getSafetyAlertById(
  id: string,
): Promise<SafetyAlert | undefined> {
  const alerts = await getSafetyAlerts();

  return alerts.find((alert) => alert.id === id);
}

export async function markSafetyAlertRead(id: string): Promise<void> {
  const readIds = await getReadAlertIds();

  if (readIds.includes(id)) {
    return;
  }

  await AsyncStorage.setItem(
    readAlertIdsStorageKey,
    JSON.stringify([...readIds, id]),
  );
}

export async function getUnreadSafetyAlertCount(): Promise<number> {
  const alerts = await getSafetyAlerts();

  return alerts.filter((alert) => !alert.isRead).length;
}

export async function getCachedSafetyAlerts(): Promise<SafetyAlert[]> {
  const value = await AsyncStorage.getItem(cachedAlertsStorageKey);

  if (!value) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isSafetyAlertLike);
  } catch {
    return [];
  }
}

export async function getCachedSafetyAlertsUpdatedAt(): Promise<
  string | undefined
> {
  return (
    (await AsyncStorage.getItem(cachedAlertsUpdatedAtStorageKey)) ?? undefined
  );
}

async function getReadAlertIds(): Promise<string[]> {
  const value = await AsyncStorage.getItem(readAlertIdsStorageKey);

  if (!value) {
    return [];
  }

  try {
    const parsedValue: unknown = JSON.parse(value);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

async function cacheSafetyAlerts(alerts: SafetyAlert[]): Promise<void> {
  await AsyncStorage.multiSet([
    [cachedAlertsStorageKey, JSON.stringify(alerts)],
    [cachedAlertsUpdatedAtStorageKey, new Date().toISOString()],
  ]);
}

function isSafetyAlertLike(value: unknown): value is SafetyAlert {
  if (!value || typeof value !== "object") {
    return false;
  }

  const alert = value as Partial<SafetyAlert>;

  return (
    typeof alert.id === "string" &&
    typeof alert.title === "string" &&
    typeof alert.description === "string" &&
    typeof alert.createdAt === "string"
  );
}
