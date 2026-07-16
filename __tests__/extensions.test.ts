import {
  isTreeExtension,
  isOfficeExtension,
  isCodeExtension,
  isFileTypeVisible,
  getFileType,
} from "../src/utils/extensions";

const treeExts = [".md", ".canvas", ".excalidraw.md"];

describe("isTreeExtension", () => {
  test("recognizes .md files", () => {
    expect(isTreeExtension("note.md", treeExts)).toBe(true);
  });

  test("recognizes .canvas files", () => {
    expect(isTreeExtension("board.canvas", treeExts)).toBe(true);
  });

  test("recognizes .excalidraw.md files", () => {
    expect(isTreeExtension("drawing.excalidraw.md", treeExts)).toBe(true);
  });

  test("rejects non-tree files", () => {
    expect(isTreeExtension("doc.pdf", treeExts)).toBe(false);
    expect(isTreeExtension("image.png", treeExts)).toBe(false);
    expect(isTreeExtension("data.xlsx", treeExts)).toBe(false);
  });
});

describe("isOfficeExtension", () => {
  test("recognizes .docx", () => {
    expect(isOfficeExtension("report.docx")).toBe(true);
  });
  test("recognizes .xlsx", () => {
    expect(isOfficeExtension("data.xlsx")).toBe(true);
  });
  test("recognizes .pptx", () => {
    expect(isOfficeExtension("slides.pptx")).toBe(true);
  });
  test("rejects non-office extensions", () => {
    expect(isOfficeExtension("note.md")).toBe(false);
    expect(isOfficeExtension("image.png")).toBe(false);
  });
});

describe("isFileTypeVisible", () => {
  test("shows files not in hidden list", () => {
    expect(isFileTypeVisible(".pdf", [])).toBe(true);
    expect(isFileTypeVisible(".pdf", [".exe"])).toBe(true);
  });
  test("hides files in hidden list", () => {
    expect(isFileTypeVisible(".pdf", [".pdf"])).toBe(false);
  });
});

describe("isCodeExtension", () => {
  const codeFiles = ["script.py", "app.js", "main.ts", "index.html", "style.css",
    "data.json", "config.yaml", "program.java", "main.c", "lib.rs"];

  test("recognizes extensionless code files", () => {
    expect(isCodeExtension("Dockerfile")).toBe(true);
    expect(isCodeExtension("Makefile")).toBe(true);
    expect(isCodeExtension("makefile")).toBe(true);
    expect(isCodeExtension(".gitignore")).toBe(true);
  });
  test.each(codeFiles)("recognizes %s as code", (name) => {
    expect(isCodeExtension(name)).toBe(true);
  });

  test("rejects non-code files", () => {
    expect(isCodeExtension("note.md")).toBe(false);
    expect(isCodeExtension("doc.docx")).toBe(false);
    expect(isCodeExtension("image.png")).toBe(false);
    expect(isCodeExtension("data.xlsx")).toBe(false);
  });
});

describe("getFileType", () => {
  test("classifies .md as markdown", () => {
    expect(getFileType("note.md")).toBe("markdown");
  });
  test("classifies .excalidraw.md as markdown (multi-dot)", () => {
    expect(getFileType("drawing.excalidraw.md")).toBe("markdown");
  });
  test("classifies .docx as office", () => {
    expect(getFileType("report.docx")).toBe("office");
  });
  test("classifies .png as image", () => {
    expect(getFileType("photo.png")).toBe("image");
  });
  test("classifies .pdf as pdf", () => {
    expect(getFileType("doc.pdf")).toBe("pdf");
  });
  test("classifies unknown as other", () => {
    expect(getFileType("script.py")).toBe("other");
  });
});
