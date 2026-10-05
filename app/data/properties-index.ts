export type PropertyStage =
  | "Verðmat"
  | "Undirbúningur"
  | "Á sölu"
  | "Skoðanir"
  | "Tilboð"
  | "Samningur"
  | "Frágangur"
  | "Afhending"
  | "Lokið";

export type IndexedProperty = {
  id: string;
  href: string;
  address: string;
  location: string;
  seller: string;
  price: string;
  stage: PropertyStage;
  nextAction: string;
  nextActionTone?: "warning" | "neutral";
  agent: string;
  agentInitials: string;
  imageVariant: "city" | "coast" | "stone";
};

export const propertyStatusFilters = [
  "Allar",
  "Verðmat",
  "Undirbúningur",
  "Á sölu",
  "Skoðanir",
  "Tilboð",
  "Samningur",
  "Frágangur",
  "Afhending",
  "Lokið",
] as const;

export type SetupStatus = "not-started" | "in-progress" | "complete";

export const setupChecklistLabels = [
  "Söluyfirlit",
  "Eignaskrá",
  "Ljósmyndun",
  "Teikningar",
  "Samþykki seljanda",
  "Auglýsingatexti",
];
