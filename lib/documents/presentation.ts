export const documentCategoryOptions = [
  { value: "Söluyfirlit", label: "Söluyfirlit" },
  { value: "Eignaskrá", label: "Eignaskrá" },
  { value: "Teikningar", label: "Teikningar" },
  { value: "Kaupsamningur", label: "Kaupsamningur" },
  { value: "Afsal", label: "Afsal" },
  { value: "Orkuvottorð", label: "Orkuvottorð" },
  { value: "Húsfélagsgögn", label: "Húsfélagsgögn" },
  { value: "Annað", label: "Annað" },
] as const;

const categoryLabels: Record<string, string> = {
  sales_overview: "Söluyfirlit",
  property_record: "Eignaskrá",
  drawings: "Teikningar",
  purchase_agreement: "Kaupsamningur",
  deed: "Afsal",
  energy_certificate: "Orkuvottorð",
  hoa_documents: "Húsfélagsgögn",
  other: "Annað",
};

const mimeLabels: Record<string, string> = {
  "application/pdf": "PDF",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/vnd.ms-excel": "XLS",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
  "application/vnd.ms-powerpoint": "PPT",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PPTX",
  "text/plain": "TXT",
  "text/csv": "CSV",
  "application/rtf": "RTF",
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WEBP",
};

const extensionMimeTypes: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  csv: "text/csv",
  rtf: "application/rtf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function documentCategoryLabel(value: string) {
  return categoryLabels[value] ?? value;
}

export function documentVisibilityLabel(value: string) {
  return ({ internal: "Innri", seller: "Seljandi", buyer: "Kaupandi", shared: "Sameiginlegt" } as Record<string, string>)[value] ?? value;
}

export function detectDocumentMimeType(fileName: string, browserMimeType?: string | null) {
  if (browserMimeType?.trim()) return browserMimeType;
  const extension = fileName.split(".").pop()?.toLocaleLowerCase("is-IS") ?? "";
  return extensionMimeTypes[extension] ?? "application/octet-stream";
}

export function documentFormatLabel(mimeType: string | null, fileName: string | null) {
  if (mimeType && mimeLabels[mimeType]) return mimeLabels[mimeType];
  const extension = fileName?.split(".").pop()?.toUpperCase();
  return extension && extension.length <= 8 ? extension : "Skrá";
}

export function deriveDocumentTitle(fileName: string) {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "");
  let title = withoutExtension.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  const knownPrefixes: Array<[RegExp, string]> = [
    [/^soluyfirlit\b/i, "Söluyfirlit"],
    [/^eignaskra\b/i, "Eignaskrá"],
    [/^orkuvottord\b/i, "Orkuvottorð"],
    [/^husfelagsgogn\b/i, "Húsfélagsgögn"],
    [/^kaupsamningur\b/i, "Kaupsamningur"],
    [/^teikningar\b/i, "Teikningar"],
    [/^afsal\b/i, "Afsal"],
  ];
  for (const [pattern, label] of knownPrefixes) {
    if (!pattern.test(title)) continue;
    const remainder = title.replace(pattern, "").trim();
    return remainder ? `${label} – ${remainder}` : label;
  }
  title = title.charAt(0).toLocaleUpperCase("is-IS") + title.slice(1);
  return title || "Skjal";
}
