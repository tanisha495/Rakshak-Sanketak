import AsyncStorage from "@react-native-async-storage/async-storage";

import type { OfflineQueueItem } from "@/types";

export const offlineQueueStorageKey = "sanketak_offline_queue";

export async function getQueue(): Promise<OfflineQueueItem[]> {
  const value = await AsyncStorage.getItem(offlineQueueStorageKey);

  if (!value) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isOfflineQueueItem).sort(sortOldestFirst);
  } catch {
    return [];
  }
}

export async function addToQueue(item: OfflineQueueItem): Promise<void> {
  const queue = await getQueue();
  const withoutDuplicate = queue.filter((queued) => queued.id !== item.id);
  await saveQueue([...withoutDuplicate, item].sort(sortOldestFirst));
}

export async function removeFromQueue(id: string): Promise<void> {
  const queue = await getQueue();
  await saveQueue(queue.filter((item) => item.id !== id));
}

export async function updateQueueItem(
  id: string,
  patch: Partial<OfflineQueueItem>,
): Promise<OfflineQueueItem | undefined> {
  const queue = await getQueue();
  let updatedItem: OfflineQueueItem | undefined;

  const nextQueue = queue.map((item) => {
    if (item.id !== id) {
      return item;
    }

    updatedItem = {
      ...item,
      ...patch,
      reportDraft: patch.reportDraft ?? item.reportDraft,
    };

    return updatedItem;
  });

  await saveQueue(nextQueue);
  return updatedItem;
}

export async function getPendingCount(): Promise<number> {
  const queue = await getQueue();
  return queue.filter((item) => item.status === "pending" || item.status === "failed").length;
}

async function saveQueue(queue: OfflineQueueItem[]): Promise<void> {
  await AsyncStorage.setItem(offlineQueueStorageKey, JSON.stringify(queue));
}

function sortOldestFirst(a: OfflineQueueItem, b: OfflineQueueItem): number {
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

function isOfflineQueueItem(value: unknown): value is OfflineQueueItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<OfflineQueueItem>;

  return (
    typeof item.id === "string" &&
    typeof item.clientReportId === "string" &&
    (item.type === "text_report" || item.type === "voice_report") &&
    (item.status === "pending" ||
      item.status === "processing" ||
      item.status === "failed") &&
    typeof item.createdAt === "string" &&
    typeof item.retryCount === "number" &&
    typeof item.reportDraft === "object" &&
    item.reportDraft !== null
  );
}
