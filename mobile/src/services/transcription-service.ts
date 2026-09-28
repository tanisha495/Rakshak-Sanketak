interface TranscriptionService {
  transcribe: (audioUri: string) => Promise<string>;
}

const mockTranscriptionDelayMs = 450;

export const transcriptionService: TranscriptionService = {
  async transcribe(audioUri) {
    await delay(mockTranscriptionDelayMs);

    if (!audioUri) {
      throw new Error("Cannot transcribe without an audio URI.");
    }

    return "Pump maintenance started without verifying isolation.";
  },
};

function delay(durationMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}
