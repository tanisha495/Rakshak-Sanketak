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

interface VoiceAnalysis {
  activity: string;
  hazard: string;
  exposure: string;
  barrier_failure: string;
  potential_consequence: string;
  life_saving_rules: string[];
}

type DenoFormData = {
  get(name: string): Blob | File | string | null;
};

interface JsonVoicePayload {
  audioBase64?: unknown;
  fileName?: unknown;
  language?: unknown;
  mimeType?: unknown;
}

class VoiceFunctionError extends Error {
  constructor(
    public safeMessage: string,
    public status = 500,
    message = safeMessage,
  ) {
    super(message);
    this.name = "VoiceFunctionError";
  }
}

const supportedLanguages = ["en", "hi", "as"];

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    const openAiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openAiKey) {
      throw new VoiceFunctionError("Voice transcription is not configured.", 500);
    }

    const { audio, language } = await readVoiceInput(request);

    const transcript = await transcribeAudio(audio, language, openAiKey);
    const analysis = await analyseSafetyReport(transcript, openAiKey);

    return json({
      analysis,
      detected_language: language,
      transcript,
    });
  } catch (error) {
    console.error("Voice transcription failed:", getSafeLogError(error));

    if (error instanceof VoiceFunctionError) {
      return json({ error: error.safeMessage }, error.status);
    }

    return json({ error: "Voice transcription failed." }, 500);
  }
});

async function readVoiceInput(
  request: Request,
): Promise<{ audio: Blob | File; language: string }> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const payload = (await request.json()) as JsonVoicePayload;
    const language = validateLanguage(
      typeof payload.language === "string" ? payload.language : null,
    );
    const audioBase64 = readJsonString(payload.audioBase64, "Audio file is required.");
    const fileName = readOptionalString(payload.fileName) ?? "voice-report.m4a";
    const mimeType = readOptionalString(payload.mimeType) ?? "audio/m4a";
    const audioBytes = decodeBase64Audio(audioBase64);

    if (audioBytes.byteLength === 0) {
      throw new VoiceFunctionError("Audio file is required.", 400);
    }

    const audioBuffer = new ArrayBuffer(audioBytes.byteLength);
    new Uint8Array(audioBuffer).set(audioBytes);

    return {
      audio: new File([audioBuffer], fileName, { type: mimeType }),
      language,
    };
  }

  const formData = (await request.formData()) as unknown as DenoFormData;
  const audio = formData.get("audio");
  const language = validateLanguage(formData.get("language"));

  if (!isUploadedAudio(audio)) {
    throw new VoiceFunctionError("Audio file is required.", 400);
  }

  return { audio, language };
}

async function transcribeAudio(
  audio: Blob | File,
  language: string,
  openAiKey: string,
): Promise<string> {
  const body = new FormData();
  const fileName =
    "name" in audio && typeof audio.name === "string" && audio.name
      ? audio.name
      : "voice-report.m4a";

  body.append("file", audio, fileName);
  body.append("model", "whisper-1");
  body.append("response_format", "json");
  body.append("language", language);
  body.append("prompt", getTranscriptionPrompt(language));

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    body,
    headers: {
      Authorization: `Bearer ${openAiKey}`,
    },
    method: "POST",
  });

  if (!response.ok) {
    throw createOpenAiTranscriptionError(response.status);
  }

  const payload = await response.json();
  const text =
    payload && typeof payload === "object" && "text" in payload
      ? String((payload as { text?: unknown }).text ?? "").trim()
      : "";

  if (!text) {
    throw new VoiceFunctionError("The recording did not contain usable speech.", 422);
  }

  return text;
}

async function analyseSafetyReport(
  transcript: string,
  openAiKey: string,
): Promise<VoiceAnalysis> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    body: JSON.stringify({
      input: [
        {
          content:
            "Classify this OIL workplace safety observation. Return only compact JSON with keys activity, hazard, exposure, barrier_failure, potential_consequence, life_saving_rules. life_saving_rules must be an array of strings.",
          role: "system",
        },
        {
          content: transcript,
          role: "user",
        },
      ],
      max_output_tokens: 450,
      model: "gpt-5-mini",
    }),
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    return createFallbackAnalysis(transcript);
  }

  const payload = await response.json();
  const text = extractResponseText(payload);

  if (!text) {
    return createFallbackAnalysis(transcript);
  }

  try {
    return normalizeAnalysis(JSON.parse(stripCodeFence(text)));
  } catch {
    return createFallbackAnalysis(transcript);
  }
}

function extractResponseText(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const response = payload as {
    output_text?: unknown;
    output?: Array<{ content?: Array<{ text?: unknown; type?: unknown }> }>;
  };

  if (typeof response.output_text === "string") {
    return response.output_text;
  }

  return response.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .find((text): text is string => typeof text === "string");
}

function normalizeAnalysis(value: unknown): VoiceAnalysis {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid analysis.");
  }

  const analysis = value as Partial<Record<keyof VoiceAnalysis, unknown>>;
  const rules = Array.isArray(analysis.life_saving_rules)
    ? analysis.life_saving_rules.filter((item): item is string => typeof item === "string")
    : [];

  return {
    activity: readAnalysisString(analysis.activity, "General Work Activity"),
    barrier_failure: readAnalysisString(
      analysis.barrier_failure,
      "Safety concern needs review",
    ),
    exposure: readAnalysisString(analysis.exposure, "Worker exposure needs review"),
    hazard: readAnalysisString(analysis.hazard, "Unsafe condition"),
    life_saving_rules: rules.length ? rules : ["Follow site safety controls"],
    potential_consequence: readAnalysisString(
      analysis.potential_consequence,
      "Potential injury or incident",
    ),
  };
}

function readAnalysisString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function createFallbackAnalysis(transcript: string): VoiceAnalysis {
  const lowerTranscript = transcript.toLowerCase();
  const isolationIssue =
    lowerTranscript.includes("isolation") ||
    lowerTranscript.includes("loto") ||
    lowerTranscript.includes("lockout");

  if (isolationIssue) {
    return {
      activity: "Maintenance",
      barrier_failure: "Energy isolation not verified",
      exposure: "Workers may be exposed during maintenance",
      hazard: "Stored Energy",
      life_saving_rules: ["Energy Isolation"],
      potential_consequence: "Serious or fatal injury",
    };
  }

  return {
    activity: "Workplace Observation",
    barrier_failure: "Safety control needs review",
    exposure: "Workers may be exposed to an unsafe condition",
    hazard: "Unsafe Condition",
    life_saving_rules: ["Stop Work Authority"],
    potential_consequence: "Injury or incident if not corrected",
  };
}

function isUploadedAudio(value: Blob | File | string | null): value is Blob | File {
  return typeof value !== "string" && value instanceof Blob && value.size > 0;
}

function decodeBase64Audio(value: string): Uint8Array {
  const normalized = value.includes(",") ? value.split(",").pop() ?? "" : value;

  try {
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
  } catch {
    throw new VoiceFunctionError("Audio file is invalid.", 400);
  }
}

function validateLanguage(value: Blob | File | string | null): string {
  const language = typeof value === "string" && value ? value : "en";

  if (!supportedLanguages.includes(language)) {
    throw new VoiceFunctionError("Unsupported transcription language.", 400);
  }

  return language;
}

function readJsonString(value: unknown, message: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new VoiceFunctionError(message, 400);
  }

  return value.trim();
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getTranscriptionPrompt(language: string): string {
  if (language === "hi") {
    return "This is an oil and gas workplace safety report. The worker may speak Hindi, English, or Hinglish. Transcribe exactly what the worker says. Do not translate, summarize, or rewrite it. Preserve technical terminology such as PPE, LOTO, isolation, permit to work, confined space, working at height, gas testing, valve, pump, pipeline, pressure, maintenance, electrical isolation, and shutdown.";
  }

  if (language === "as") {
    return "This is an oil and gas workplace safety report. The worker may speak Assamese, Hindi, English, or code-switch between these languages. Transcribe exactly what the worker says. Do not translate, summarize, or rewrite it. Preserve technical terminology such as PPE, LOTO, isolation, permit to work, confined space, working at height, gas testing, valve, pump, pipeline, pressure, maintenance, electrical isolation, and shutdown.";
  }

  return "This is an oil and gas workplace safety report. Transcribe exactly what the worker says. Do not translate, summarize, or rewrite it. Preserve technical terminology such as PPE, LOTO, isolation, permit to work, confined space, working at height, gas testing, valve, pump, pipeline, pressure, maintenance, electrical isolation, and shutdown.";
}

function stripCodeFence(text: string): string {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
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

function createOpenAiTranscriptionError(status: number): VoiceFunctionError {
  if (status === 401 || status === 403) {
    return new VoiceFunctionError(
      "Voice transcription authentication failed.",
      502,
      `OpenAI authentication failed with ${status}.`,
    );
  }

  if (status === 429) {
    return new VoiceFunctionError(
      "Voice transcription is temporarily rate limited.",
      429,
      "OpenAI transcription rate limited.",
    );
  }

  return new VoiceFunctionError(
    "Voice transcription request failed.",
    502,
    `OpenAI transcription failed with ${status}.`,
  );
}

function getSafeLogError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown error.";
}
