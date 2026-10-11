export type Metric = {
  value: string;
  label: string;
};

export type ScheduleItem = {
  time: string;
  dayLabel: string;
  type: string;
  address: string;
};

export type AttentionItem = {
  title: string;
  detail: string;
  tone: "danger" | "warning" | "neutral";
};

export type Property = {
  id: string | number;
  href?: string;
  address: string;
  location: string;
  status: string;
  note: string;
  noteTone?: "warning" | "neutral";
  registered: string;
  attended: string;
  interested: string;
  agent: {
    name: string;
    initials: string;
    photoUrl?: string | null;
  };
  imageVariant: "coast" | "city" | "stone";
  imageUrl?: string | null;
};
