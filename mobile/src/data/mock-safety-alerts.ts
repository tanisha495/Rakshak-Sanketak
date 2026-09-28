import type { SafetyAlert } from "@/types";

export const mockSafetyAlerts: SafetyAlert[] = [
  {
    id: "ALT-101",
    title: "Energy Isolation Reminder",
    description:
      "Maintenance work must not begin until all energy sources are isolated and verified.",
    severity: "critical",
    category: "life_saving_rule",
    site: "Mathura (UP)",
    createdAt: "2026-09-12T04:30:00.000Z",
    actionText:
      "Do not begin maintenance until isolation is confirmed and verified.",
    lifeSavingRule: "Energy Isolation",
  },
  {
    id: "ALT-102",
    title: "Repeated Gas Leak Observations",
    description:
      "Multiple gas smell observations have been reported near the compressor area. Use caution and report any abnormal condition immediately.",
    severity: "warning",
    category: "recurring_pattern",
    site: "Barauni (Bihar)",
    area: "Compressor Area",
    createdAt: "2026-09-11T09:45:00.000Z",
    actionText:
      "Avoid the area unless assigned and report any gas smell immediately.",
  },
  {
    id: "ALT-103",
    title: "Working at Height Advisory",
    description:
      "Ensure fall protection is in place before using ladders, scaffolds or elevated work platforms.",
    severity: "warning",
    category: "life_saving_rule",
    createdAt: "2026-09-10T08:10:00.000Z",
    actionText:
      "Use approved fall protection and check anchor points before elevated work.",
    lifeSavingRule: "Working at Height",
  },
  {
    id: "ALT-104",
    title: "Open Pit Barricading",
    description:
      "Temporary excavation areas must remain properly barricaded and clearly marked.",
    severity: "warning",
    category: "hazard",
    site: "Panipat (Haryana)",
    createdAt: "2026-09-09T05:30:00.000Z",
    actionText:
      "Do not cross barricades and report missing markers around excavation areas.",
  },
  {
    id: "ALT-105",
    title: "Safety Reporting Reminder",
    description:
      "Report unsafe conditions and near misses even when no injury has occurred.",
    severity: "info",
    category: "site_advisory",
    createdAt: "2026-09-07T11:20:00.000Z",
    actionText:
      "Use Sanketak to report unsafe conditions as soon as you observe them.",
  },
  {
    id: "ALT-106",
    title: "Revised LOTO Checklist Available",
    description:
      "A revised lockout-tagout checklist is now available for rotating equipment maintenance activities.",
    severity: "info",
    category: "site_advisory",
    site: "Digboi (Assam)",
    createdAt: "2026-09-06T10:00:00.000Z",
    actionText:
      "Use the revised checklist before starting rotating equipment maintenance.",
    lifeSavingRule: "Energy Isolation",
  },
];
