import type { ReportAnalysis, ReportDraft } from "@/report-draft";

interface AnalysisService {
  analyseReport: (draft: ReportDraft) => Promise<ReportAnalysis>;
}

const analysisDelayMs = 900;

export const analysisService: AnalysisService = {
  async analyseReport(draft) {
    await delay(analysisDelayMs);

    const description = draft.description.trim().toLowerCase();

    if (!description) {
      throw new Error("Cannot analyse an empty report.");
    }

    if (matchesAny(description, ["isolation", "loto", "energy", "energized"])) {
      return {
        activity: "Pump Maintenance",
        hazard: "Stored Energy",
        exposure: "Worker interacting with potentially energized equipment",
        barrierFailure: "Energy isolation not verified",
        potentialConsequence: "Serious or fatal injury",
        lifeSavingRules: ["Energy Isolation"],
      };
    }

    if (matchesAny(description, ["gas", "leak", "smell", "odour", "odor"])) {
      return {
        activity: "Process Area Inspection",
        hazard: "Possible Gas Release",
        exposure: "Worker may be exposed to flammable or toxic vapour",
        barrierFailure: "Leak source not isolated or verified",
        potentialConsequence: "Fire, explosion, or serious health impact",
        lifeSavingRules: ["Gas Testing", "Line Breaking"],
      };
    }

    if (matchesAny(description, ["height", "ladder", "scaffold", "scaffolding"])) {
      return {
        activity: "Work at Height",
        hazard: "Fall from Height",
        exposure: "Worker positioned on elevated equipment or access system",
        barrierFailure: "Fall protection or access control not confirmed",
        potentialConsequence: "Serious or fatal fall injury",
        lifeSavingRules: ["Work at Height"],
      };
    }

    if (matchesAny(description, ["barricade", "open pit", "open hole", "excavation"])) {
      return {
        activity: "Work Area Access",
        hazard: "Open Edge or Line of Fire",
        exposure: "Worker may enter an unprotected or poorly marked work area",
        barrierFailure: "Barricading or signage missing",
        potentialConsequence: "Fall, struck-by, or serious injury",
        lifeSavingRules: ["Line of Fire"],
      };
    }

    return {
      activity: "Safety Observation",
      hazard: "Unsafe Condition",
      exposure: "Worker may be exposed to an uncontrolled worksite hazard",
      barrierFailure: "Existing control not clearly verified",
      potentialConsequence: "Injury or equipment damage",
      lifeSavingRules: ["Stop Work Authority"],
    };
  },
};

function delay(durationMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

function matchesAny(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(keyword));
}
