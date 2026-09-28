import type { ReportStatus, ReportStatusStep } from "@/types";

const orderedTimelineStages: ReportStatusStep["id"][] = [
  "submitted",
  "reviewed",
  "action_assigned",
  "actioned",
  "verified",
];

export const reportStatusLabels: Record<ReportStatus, string> = {
  submitted: "Submitted",
  under_review: "Under Review",
  action_assigned: "Action Assigned",
  actioned: "Action Taken",
  verified: "Verified",
};

const statusTimelineStage: Record<ReportStatus, ReportStatusStep["id"]> = {
  submitted: "submitted",
  under_review: "reviewed",
  action_assigned: "action_assigned",
  actioned: "actioned",
  verified: "verified",
};

export function getReportStatusSteps(status: ReportStatus): ReportStatusStep[] {
  const activeIndex = orderedTimelineStages.indexOf(statusTimelineStage[status]);

  return orderedTimelineStages.map((item, index) => ({
    id: item,
    label: item,
    completed: index < activeIndex || status === "verified",
    active: index === activeIndex,
  }));
}

export function formatReportDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
