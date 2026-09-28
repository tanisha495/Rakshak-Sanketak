import AsyncStorage from "@react-native-async-storage/async-storage";

import type { AppLanguage } from "./types";

const LANGUAGE_STORAGE_KEY = "sanketak:selected-language";
const supportedLanguages: AppLanguage[] = ["en", "hi", "as"];

export async function getStoredLanguage(): Promise<AppLanguage | null> {
  const value = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);

  if (supportedLanguages.includes(value as AppLanguage)) {
    return value as AppLanguage;
  }

  return null;
}

export async function saveStoredLanguage(language: AppLanguage): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
}

export async function clearStoredLanguage(): Promise<void> {
  await AsyncStorage.removeItem(LANGUAGE_STORAGE_KEY);
}
