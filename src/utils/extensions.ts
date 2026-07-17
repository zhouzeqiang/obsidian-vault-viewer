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

const CODE_EXTENSIONS = new Set([
  ".txt", ".sql", ".java", ".py", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx",
  ".json", ".xml", ".html", ".htm", ".vue", ".yaml", ".yml", ".css", ".scss",
  ".sass", ".less", ".styl", ".sh", ".bash", ".zsh", ".ps1", ".psm1", ".psd1",
  ".bat", ".cmd", ".php", ".php3", ".php4", ".php5", ".phtml", ".rb", ".go", ".rs",
  ".c", ".h", ".cpp", ".cc", ".cxx", ".hpp", ".hxx", ".cs", ".swift", ".kt", ".kts",
  ".scala", ".groovy", ".gradle", ".pl", ".pm", ".lua", ".r", ".R", ".rmd", ".m", ".mm",
  ".dart", ".erl", ".ex", ".exs", ".coffee", ".tex", ".sty", ".cls", ".ltx", ".rst",
  ".toml", ".ini", ".cfg", ".conf", ".env", ".properties", ".makefile", ".Makefile",
  ".dockerfile", ".Dockerfile", ".gitignore",
]);

const CODE_FILENAMES = new Set([
  "makefile", "Makefile", "dockerfile", "Dockerfile", "gitignore",
]);

export function isCodeExtension(filename: string): boolean {
  if (CODE_FILENAMES.has(filename)) return true;
  const ext = getExtension(filename);
  return CODE_EXTENSIONS.has(ext);
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
