import * as FileSystem from "expo-file-system/legacy";

import type { AppLanguage } from "@/i18n";
import type { ReportAnalysis } from "@/report-draft";
import {
  getSupabaseFunctionUrl,
  getSupabasePublishableKey,
  isSupabaseConfigured,
} from "./supabase-client";

export interface VoiceReportResponse {
  transcript: string;
  detectedLanguage: AppLanguage | string;
  analysis: ReportAnalysis;
}

interface BackendVoiceReportResponse {
  transcript?: unknown;
  detected_language?: unknown;
  analysis?: {
    activity?: unknown;
    hazard?: unknown;
    exposure?: unknown;
    barrier_failure?: unknown;
    potential_consequence?: unknown;
    life_saving_rules?: unknown;
  };
}

const voiceReportPath = "/voice-report";
const requestTimeoutMs = 120000;

export async function processVoiceReport(
  audioUri: string,
  language: AppLanguage,
): Promise<VoiceReportResponse> {
  if (!audioUri) {
    throw new Error("Audio URI is required.");
  }

  // The FastAPI backend owns transcription. Supabase is the legacy path and is
  // used only when no backend URL is configured.
  if (!process.env.EXPO_PUBLIC_API_BASE_URL?.trim() && isSupabaseConfigured()) {
    return processSupabaseVoiceReport(audioUri, language);
  }

  const apiBaseUrl = getApiBaseUrl();
  const extension = getAudioExtension(audioUri);

  // Uploaded natively rather than with fetch + FormData: React Native's new
  // architecture rejects the { uri, name, type } part cast with "Unsupported
  // FormDataPart implementation".
  const response = await FileSystem.uploadAsync(
    `${apiBaseUrl}${voiceReportPath}`,
    audioUri,
    {
      fieldName: "audio",
      headers: {
        Accept: "application/json",
      },
      httpMethod: "POST",
      mimeType: getAudioMimeType(extension),
      parameters: { language },
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    },
  );

  if (response.status < 200 || response.status >= 300) {
    throw new Error(
      `Voice report request failed with ${response.status}. ${response.body ?? ""}`.trim(),
    );
  }

  let payload: BackendVoiceReportResponse;

  try {
    payload = JSON.parse(response.body) as BackendVoiceReportResponse;
  } catch {
    throw new Error("Invalid voice report response from the backend.");
  }

  return mapVoiceReportResponse(payload);
}

async function processSupabaseVoiceReport(
  audioUri: string,
  language: AppLanguage,
): Promise<VoiceReportResponse> {
  const publishableKey = getSupabasePublishableKey();

  if (!publishableKey) {
    throw new Error("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not configured.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(getSupabaseFunctionUrl("process-voice-report"), {
      body: JSON.stringify(await buildSupabaseVoiceReportBody(audioUri, language)),
      headers: {
        Accept: "application/json",
        apikey: publishableKey,
        Authorization: `Bearer ${publishableKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: controller.signal,
    });
    const payload = await parseVoiceReportResponse(response);

    if (!response.ok) {
      throw new Error(getBackendErrorMessage(payload, response.status));
    }

    return mapVoiceReportResponse(payload);
  } finally {
    clearTimeout(timeout);
  }
}

function getApiBaseUrl() {
  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

  if (!apiBaseUrl) {
    throw new Error("EXPO_PUBLIC_API_BASE_URL is not configured.");
  }

  return apiBaseUrl.replace(/\/+$/, "");
}

async function buildSupabaseVoiceReportBody(
  audioUri: string,
  language: AppLanguage,
) {
  const extension = getAudioExtension(audioUri);

  return {
    audioBase64: await FileSystem.readAsStringAsync(audioUri, {
      encoding: FileSystem.EncodingType.Base64,
    }),
    fileName: `voice-report.${extension}`,
    language,
    mimeType: getAudioMimeType(extension),
  };
}

function getAudioExtension(audioUri: string) {
  const cleanUri = audioUri.split("?")[0] ?? audioUri;
  const extension = cleanUri.split(".").pop()?.toLowerCase();

  if (!extension || extension.length > 5 || extension.includes("/")) {
    return "m4a";
  }

  return extension;
}

function getAudioMimeType(extension: string) {
  if (extension === "webm") {
    return "audio/webm";
  }

  if (extension === "wav") {
    return "audio/wav";
  }

  if (extension === "caf") {
    return "audio/x-caf";
  }

  return "audio/m4a";
}

function mapVoiceReportResponse(
  payload: BackendVoiceReportResponse,
): VoiceReportResponse {
  const transcript = assertString(payload.transcript, "transcript");
  const detectedLanguage = assertString(
    payload.detected_language,
    "detected_language",
  );
  const analysis = payload.analysis;

  if (!analysis || typeof analysis !== "object") {
    throw new Error("Invalid voice report response: analysis is missing.");
  }

  const lifeSavingRules = analysis.life_saving_rules;

  if (
    !Array.isArray(lifeSavingRules) ||
    !lifeSavingRules.every((item) => typeof item === "string")
  ) {
    throw new Error(
      "Invalid voice report response: life_saving_rules is invalid.",
    );
  }

  return {
    analysis: {
      activity: assertString(analysis.activity, "analysis.activity"),
      barrierFailure: assertString(
        analysis.barrier_failure,
        "analysis.barrier_failure",
      ),
      exposure: assertString(analysis.exposure, "analysis.exposure"),
      hazard: assertString(analysis.hazard, "analysis.hazard"),
      lifeSavingRules,
      potentialConsequence: assertString(
        analysis.potential_consequence,
        "analysis.potential_consequence",
      ),
    },
    detectedLanguage,
    transcript,
  };
}

function assertString(value: unknown, fieldName: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid voice report response: ${fieldName} is invalid.`);
  }

  return value;
}

async function parseVoiceReportResponse(
  response: Response,
): Promise<BackendVoiceReportResponse & { error?: unknown }> {
  try {
    return (await response.json()) as BackendVoiceReportResponse & {
      error?: unknown;
    };
  } catch {
    throw new Error("Invalid voice report response from Supabase.");
  }
}

function getBackendErrorMessage(
  payload: { error?: unknown },
  status: number,
) {
  if (typeof payload.error === "string" && payload.error.trim()) {
    return payload.error;
  }

  return `Supabase voice report request failed with ${status}.`;
}
