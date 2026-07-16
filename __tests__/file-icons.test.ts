import { getFileIcon, FileIcon } from "../src/utils/file-icons";

describe("getFileIcon", () => {
  const knownCases = [
    "py", "js", "ts", "java", "rs", "go", "rb", "php",
    "c", "cpp", "cs", "swift", "kt", "scala", "pl", "lua",
    "r", "dart", "erl", "ex", "coffee", "tex", "css",
    "scss", "less", "sh", "ps1", "bat", "sql", "json",
    "xml", "yaml", "toml", "ini", "properties", "html",
    "vue", "groovy", "gradle", "dockerfile",
  ];

  test.each(knownCases)(".getFileIcon(%s) returns a FileIcon", (ext) => {
    const icon = getFileIcon(ext);
    expect(icon).not.toBeNull();
    expect(icon!.svg).toBeTruthy();
    expect(icon!.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  test("returns null for non-code extensions", () => {
    expect(getFileIcon("docx")).toBeNull();
    expect(getFileIcon("xlsx")).toBeNull();
    expect(getFileIcon("pptx")).toBeNull();
    expect(getFileIcon("md")).toBeNull();
    expect(getFileIcon("pdf")).toBeNull();
    expect(getFileIcon("png")).toBeNull();
    expect(getFileIcon("txt")).toBeNull();
  });

  test("returns null for unknown extensions", () => {
    expect(getFileIcon("zzz")).toBeNull();
    expect(getFileIcon("")).toBeNull();
  });

  test("is case-insensitive", () => {
    const lower = getFileIcon("py");
    const upper = getFileIcon("PY");
    expect(lower).toEqual(upper);
  });

  test("handles compound extensions via exact match", () => {
    expect(getFileIcon("gradle")).not.toBeNull();
  });
});
