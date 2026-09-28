import type { ReportLanguage, WorkerSafetyReport } from "@/types";

const requestTimeoutMs = 20000;

// What report-service.ts writes when the worker skipped the site picker.
const NOT_PROVIDED = "Not provided";

export interface RemoteReportResult {
  remoteReportId?: string;
  remoteAudioPath?: string;
  remotePhotoPath?: string;
}

export class RemoteReportError extends Error {
  constructor(message = "Unable to sync report to the Sanketak backend.") {
    super(message);
    this.name = "RemoteReportError";
  }
}

interface CreateReportResponse {
  anon_token?: unknown;
  status?: unknown;
  detail?: unknown;
}

/**
 * Sends the report to the FastAPI backend, which runs the SIF classifier and
 * the NLP fingerprint extractor before storing it. The endpoint takes its
 * inputs as query parameters rather than a JSON body, and returns the
 * anonymous tracking token the worker uses to check status later.
 */
export async function submitReportToBackend(
  report: WorkerSafetyReport,
): Promise<RemoteReportResult> {
  // Built by hand rather than with URLSearchParams: that global is only a
  // complete implementation in React Native when react-native-url-polyfill
  // has been loaded, and the only thing importing it is the Supabase client,
  // which a text-only submission never touches. encodeURIComponent is built
  // in and has no such load-order dependency.
  let query =
    "raw_text=" +
    encodeURIComponent(report.description) +
    "&language=" +
    encodeURIComponent(toBackendLanguage(report.language));

  // The worker's site, only when they actually picked one. The rest of the
  // app stores "Not provided" as a display placeholder for an unanswered
  // question; sending that would record the literal string as a location and
  // make "Not provided" look like a real site on the HSE dashboard.
  const site = toBackendSite(report.site);

  if (site) {
    query += "&site=" + encodeURIComponent(site);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, requestTimeoutMs);

  try {
    const response = await fetch(`${getApiBaseUrl()}/reports/?${query}`, {
      headers: { Accept: "application/json" },
      method: "POST",
      signal: controller.signal,
    });
    const payload = await parseCreateReportResponse(response);

    if (!response.ok) {
      throw new RemoteReportError(getCreateReportError(payload, response.status));
    }

    if (typeof payload.anon_token !== "string" || !payload.anon_token) {
      throw new RemoteReportError("Backend did not return an anonymous token.");
    }

    return { remoteReportId: payload.anon_token };
  } catch (error) {
    if (error instanceof RemoteReportError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new RemoteReportError("Backend did not respond in time.");
    }

    throw new RemoteReportError(getNetworkErrorMessage(error));
  } finally {
    clearTimeout(timeout);
  }
}

function getApiBaseUrl(): string {
  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

  if (!apiBaseUrl) {
    throw new RemoteReportError("EXPO_PUBLIC_API_BASE_URL is not configured.");
  }

  return apiBaseUrl.replace(/\/+$/, "");
}

// The site to send, or undefined when the worker did not choose one.
// Queued reports go through this too: an item queued before a site was
// chosen carries the same placeholder, and it must not become a location
// when the queue flushes days later.
function toBackendSite(site: string | undefined): string | undefined {
  const trimmed = (site ?? "").trim();

  if (!trimmed || trimmed === NOT_PROVIDED) {
    return undefined;
  }

  return trimmed;
}

function toBackendLanguage(language: ReportLanguage): string {
  if (language === "hindi") {
    return "hi";
  }

  if (language === "assamese") {
    return "as";
  }

  if (language === "mixed") {
    return "mixed";
  }

  return "en";
}

async function parseCreateReportResponse(
  response: Response,
): Promise<CreateReportResponse> {
  try {
    return (await response.json()) as CreateReportResponse;
  } catch {
    return {};
  }
}

function getCreateReportError(
  payload: CreateReportResponse,
  status: number,
): string {
  if (typeof payload.detail === "string" && payload.detail.trim()) {
    return payload.detail;
  }

  return `Backend report sync failed with ${status}.`;
}

function getNetworkErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return `Could not reach the Sanketak backend: ${error.message}`;
  }

  return "Could not reach the Sanketak backend.";
}
