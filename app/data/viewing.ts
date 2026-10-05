export type AttendanceStatus = "registered" | "attended" | "absent";
export type InterestLevel = "very" | "interested" | "unsure" | "not-interested" | "unset";
export type NextAction = "today" | "tomorrow" | "second-viewing" | "wait" | "none";

export type ViewingGuest = {
  id: string;
  name: string;
  phone: string;
  email: string;
  attendance: AttendanceStatus;
  attendanceLabel?: string;
  interest: InterestLevel;
  interestLabel?: string;
  note: string;
  nextAction: NextAction;
  walkIn?: boolean;
};

export type ViewingDetails = {
  id: string;
  title: string;
  address: string;
  startsAt: string;
  endsAt: string;
  dateTimeLabel: string;
  status: "scheduled" | "active" | "completed" | "cancelled";
  completedAt: string | null;
};

export const attendanceOptions: Array<{ value: AttendanceStatus; label: string }> = [
  { value: "registered", label: "Skráður" },
  { value: "attended", label: "Mættur" },
  { value: "absent", label: "Mætti ekki" },
];

export const interestOptions: Array<{ value: InterestLevel; label: string }> = [
  { value: "very", label: "Mjög áhugasamur" },
  { value: "interested", label: "Áhugasamur" },
  { value: "unsure", label: "Ekki viss" },
  { value: "not-interested", label: "Ekki áhugasamur" },
];

export const nextActionOptions: Array<{ value: NextAction; label: string }> = [
  { value: "today", label: "Fylgja eftir í dag" },
  { value: "tomorrow", label: "Fylgja eftir á morgun" },
  { value: "second-viewing", label: "Bóka aðra skoðun" },
  { value: "wait", label: "Bíða" },
  { value: "none", label: "Engin eftirfylgni" },
];
