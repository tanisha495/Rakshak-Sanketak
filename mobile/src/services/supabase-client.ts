import "react-native-url-polyfill/auto";
import "expo-sqlite/localStorage/install";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabasePublishableKey());
}

export function getSupabaseClient(): SupabaseClient {
  const supabaseUrl = getSupabaseUrl();
  const publishableKey = getSupabasePublishableKey();

  if (!supabaseUrl || !publishableKey) {
    throw new Error(
      "Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  if (!client) {
    client = createClient(supabaseUrl, publishableKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  }

  return client;
}

export function getSupabaseFunctionUrl(functionName: string): string {
  const supabaseUrl = getSupabaseUrl();

  if (!supabaseUrl) {
    throw new Error("EXPO_PUBLIC_SUPABASE_URL is not configured.");
  }

  return `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/${functionName}`;
}

export function getSupabasePublishableKey(): string | undefined {
  return (
    readPublicEnvValue(process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ||
    readPublicEnvValue(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) ||
    undefined
  );
}

function getSupabaseUrl(): string | undefined {
  return readPublicEnvValue(process.env.EXPO_PUBLIC_SUPABASE_URL);
}

function readPublicEnvValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  if (trimmed.startsWith("e''") && trimmed.endsWith("''")) {
    return normalizeSupabaseKey(trimmed.slice(3, -2).trim());
  }

  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return normalizeSupabaseKey(trimmed.slice(1, -1).trim());
  }

  return normalizeSupabaseKey(trimmed);
}

function normalizeSupabaseKey(value: string): string | undefined {
  if (!value) {
    return undefined;
  }

  if (value.startsWith("yJ") && value.split(".").length === 3) {
    return `e${value}`;
  }

  return value;
}
