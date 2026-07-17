const OFFICE_EXTENSIONS = new Set([".docx", ".xlsx", ".pptx"]);
const IMAGE_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".bmp",
]);

export function getExtension(filename: string): string {
  if (filename.endsWith(".excalidraw.md")) return ".excalidraw.md";
  if (filename.endsWith(".canvas.md")) return ".canvas.md";
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex === -1) return "";
  return filename.slice(dotIndex);
}

export function isTreeExtension(
  filename: string,
  treeExtensions: string[]
): boolean {
  return treeExtensions.some((ext) => filename.endsWith(ext));
}

export function isOfficeExtension(filename: string): boolean {
  const ext = getExtension(filename);
  return OFFICE_EXTENSIONS.has(ext);
}

export function isImageExtension(filename: string): boolean {
  const ext = getExtension(filename);
  return IMAGE_EXTENSIONS.has(ext);
}

export function isFileTypeVisible(
  extension: string,
  hiddenExtensions: string[]
): boolean {
  return !hiddenExtensions.includes(extension);
}

export type FileTypeCategory = "markdown" | "office" | "image" | "pdf" | "other";

export function getFileType(filename: string): FileTypeCategory {
  const ext = getExtension(filename);
  if (ext === ".md" || ext.endsWith(".md")) return "markdown";
  if (OFFICE_EXTENSIONS.has(ext)) return "office";
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if (ext === ".pdf") return "pdf";
  return "other";
}
