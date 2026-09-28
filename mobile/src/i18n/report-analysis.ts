import type { TranslationKey } from "./types";

type Translator = (key: TranslationKey) => string;

const analysisValueKeys: Record<string, TranslationKey> = {
  "barricade was missing at the excavation boundary":
    "analysisValues.barricadeMissing",
  "barricading or signage missing": "analysisValues.barricadingMissing",
  "bypassing safety controls": "analysisValues.bypassingSafetyControls",
  "damaged process equipment": "analysisValues.damagedProcessEquipment",
  "damaged valve was still available for routine use":
    "analysisValues.damagedValveAvailable",
  "energy isolation": "analysisValues.energyIsolation",
  "energy isolation not verified": "analysisValues.energyIsolationNotVerified",
  "energy isolation was not verified before work started":
    "analysisValues.energyIsolationNotVerifiedBeforeWork",
  "existing control not clearly verified":
    "analysisValues.existingControlNotVerified",
  "fall from height": "analysisValues.fallFromHeight",
  "fall into excavation or vehicle entry into unsafe area":
    "analysisValues.fallIntoExcavation",
  "fall protection or access control not confirmed":
    "analysisValues.fallProtectionNotConfirmed",
  "fire, explosion, or serious health impact":
    "analysisValues.fireExplosionHealthImpact",
  "fire, explosion, or toxic exposure if gas accumulates":
    "analysisValues.fireExplosionToxicExposure",
  "follow site safety controls": "analysisValues.followSiteSafetyControls",
  "gas testing": "analysisValues.gasTesting",
  "general work activity": "analysisValues.generalWorkActivity",
  "hot work": "analysisValues.hotWork",
  "injury or equipment damage": "analysisValues.injuryEquipmentDamage",
  "injury or incident if not corrected":
    "analysisValues.injuryIncidentIfNotCorrected",
  "leak source not isolated or verified":
    "analysisValues.leakSourceNotIsolated",
  "line breaking": "analysisValues.lineBreaking",
  "line of fire": "analysisValues.lineOfFire",
  maintenance: "analysisValues.maintenance",
  "open edge or line of fire": "analysisValues.openEdgeLineOfFire",
  "open excavation": "analysisValues.openExcavation",
  "possible gas release": "analysisValues.possibleGasRelease",
  "possible hydrocarbon gas release":
    "analysisValues.possibleHydrocarbonGasRelease",
  "potential injury or incident": "analysisValues.potentialInjuryIncident",
  "process area inspection": "analysisValues.processAreaInspection",
  "pump maintenance": "analysisValues.pumpMaintenance",
  "routine site inspection": "analysisValues.routineSiteInspection",
  "safety concern needs review": "analysisValues.safetyConcernNeedsReview",
  "safety control needs review": "analysisValues.safetyControlNeedsReview",
  "safety observation": "analysisValues.safetyObservation",
  "serious injury from unexpected equipment start-up":
    "analysisValues.seriousInjuryUnexpectedStartup",
  "serious or fatal fall injury": "analysisValues.seriousFatalFallInjury",
  "serious or fatal injury": "analysisValues.seriousFatalInjury",
  "stop work authority": "analysisValues.stopWorkAuthority",
  "stored energy": "analysisValues.storedEnergy",
  "unsafe condition": "analysisValues.unsafeCondition",
  "valve operation": "analysisValues.valveOperation",
  "walking near excavation": "analysisValues.walkingNearExcavation",
  "work area access": "analysisValues.workAreaAccess",
  "work at height": "analysisValues.workAtHeight",
  "work authorization": "analysisValues.workAuthorization",
  "worker exposure needs review": "analysisValues.workerExposureNeedsReview",
  "worker interacting with equipment that may still be energized":
    "analysisValues.workerInteractingMaybeEnergized",
  "worker interacting with potentially energized equipment":
    "analysisValues.workerInteractingPotentiallyEnergized",
  "worker may be exposed to an uncontrolled worksite hazard":
    "analysisValues.workerExposedUncontrolledHazard",
  "worker may be exposed to flammable or toxic vapour":
    "analysisValues.workerExposedVapour",
  "worker may enter an unprotected or poorly marked work area":
    "analysisValues.workerEnterUnprotectedArea",
  "worker operating a defective valve under field conditions":
    "analysisValues.workerOperatingDefectiveValve",
  "worker positioned on elevated equipment or access system":
    "analysisValues.workerPositionedElevated",
  "workers and vehicles passing close to an unprotected edge":
    "analysisValues.workersVehiclesNearEdge",
  "workers may be exposed during maintenance":
    "analysisValues.workersExposedDuringMaintenance",
  "workers may be exposed to an unsafe condition":
    "analysisValues.workersExposedUnsafeCondition",
  "workers present near process equipment":
    "analysisValues.workersNearProcessEquipment",
  "workplace observation": "analysisValues.workplaceObservation",
};

export function translateAnalysisValue(
  value: string,
  t: Translator,
): string {
  const key = analysisValueKeys[normalizeAnalysisValue(value)];

  return key ? t(key) : value;
}

export function translateAnalysisList(
  values: string[],
  t: Translator,
): string {
  return values.map((value) => translateAnalysisValue(value, t)).join(", ");
}

function normalizeAnalysisValue(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
