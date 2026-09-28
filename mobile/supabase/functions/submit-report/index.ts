declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (request: Request) => Promise<Response> | Response): void;
};

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

interface SubmitReportPayload {
  report?: Record<string, unknown>;
  analysis?: Record<string, unknown>;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return json({ ok: true });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Supabase server credentials are not configured." }, 500);
    }

    const payload = (await request.json()) as SubmitReportPayload;
    const report = normalizeReport(payload.report);
    await upsertReport(supabaseUrl, serviceRoleKey, report);

    if (payload.analysis) {
      await upsertAnalysis(supabaseUrl, serviceRoleKey, {
        ...normalizeAnalysis(payload.analysis),
        report_client_id: report.client_report_id,
      });
    }

    return json({ ok: true });
  } catch (error) {
    console.error("Report submit failed:", getSafeErrorMessage(error));
    return json({ error: getSafeErrorMessage(error) }, 500);
  }
});

async function upsertReport(
  supabaseUrl: string,
  serviceRoleKey: string,
  report: Record<string, unknown>,
): Promise<void> {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/reports?on_conflict=client_report_id`,
    {
      body: JSON.stringify(report),
      headers: getServiceHeaders(
        serviceRoleKey,
        "resolution=merge-duplicates,return=minimal",
      ),
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new Error(
      `Report upsert failed with ${response.status}: ${await response.text()}`,
    );
  }
}

async function upsertAnalysis(
  supabaseUrl: string,
  serviceRoleKey: string,
  analysis: Record<string, unknown>,
): Promise<void> {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/report_analysis?on_conflict=report_client_id`,
    {
      body: JSON.stringify(analysis),
      headers: getServiceHeaders(serviceRoleKey, "resolution=merge-duplicates"),
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new Error(
      `Report analysis upsert failed with ${response.status}: ${await response.text()}`,
    );
  }
}

function normalizeReport(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    throw new Error("Report payload is required.");
  }

  const report = value as Record<string, unknown>;
  const requiredFields = [
    "client_report_id",
    "tracking_id",
    "report_type",
    "final_text",
    "report_language",
    "site",
    "status",
    "submitted_at",
  ];

  for (const field of requiredFields) {
    if (typeof report[field] !== "string" || !report[field]) {
      throw new Error(`Report field ${field} is required.`);
    }
  }

  return {
    anonymous: true,
    area_or_equipment: readOptionalString(report.area_or_equipment),
    audio_path: readOptionalString(report.audio_path),
    client_report_id: report.client_report_id,
    detected_language: readOptionalString(report.detected_language),
    final_text: report.final_text,
    original_text: readOptionalString(report.original_text),
    photo_path: readOptionalString(report.photo_path),
    report_language: report.report_language,
    report_type: report.report_type,
    site: report.site,
    status: report.status,
    submitted_at: report.submitted_at,
    sync_status: readOptionalString(report.sync_status) ?? "synced",
    synced_at: new Date().toISOString(),
    tracking_id: report.tracking_id,
    transcribed_text: readOptionalString(report.transcribed_text),
  };
}

function normalizeAnalysis(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    throw new Error("Analysis payload is invalid.");
  }

  const analysis = value as Record<string, unknown>;
  const lifeSavingRules = Array.isArray(analysis.life_saving_rules)
    ? analysis.life_saving_rules.filter(
        (item): item is string => typeof item === "string",
      )
    : [];

  return {
    activity: readRequiredString(analysis.activity, "activity"),
    barrier_failure: readRequiredString(
      analysis.barrier_failure,
      "barrier_failure",
    ),
    exposure: readRequiredString(analysis.exposure, "exposure"),
    hazard: readRequiredString(analysis.hazard, "hazard"),
    life_saving_rules: lifeSavingRules,
    potential_consequence: readRequiredString(
      analysis.potential_consequence,
      "potential_consequence",
    ),
  };
}

function getServiceHeaders(serviceRoleKey: string, prefer: string): HeadersInit {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    Prefer: prefer,
  };
}

function readRequiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Analysis field ${field} is required.`);
  }

  return value;
}

function readOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Report submit failed.";
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
    status,
  });
}
