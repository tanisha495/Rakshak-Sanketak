export type SafetyAlertSeverity = "critical" | "warning" | "info";

export type SafetyAlertCategory =
  | "hazard"
  | "life_saving_rule"
  | "site_advisory"
  | "recurring_pattern";

export interface SafetyAlert {
  id: string;
  title: string;
  description: string;
  severity: SafetyAlertSeverity;
  category: SafetyAlertCategory;
  site?: string;
  area?: string;
  createdAt: string;
  actionText?: string;
  isRead?: boolean;
  lifeSavingRule?: string;
}
