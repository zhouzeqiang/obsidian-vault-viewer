import { FileService } from "../src/services/FileService";

describe("FileService", () => {
  let service: FileService;
  const mockVault = {
    getFiles: jest.fn(),
    getAbstractFileByPath: jest.fn(),
    on: jest.fn().mockReturnValue(jest.fn()),
  };

  beforeEach(() => {
    service = new FileService(mockVault as any);
  });

  test("getTreeFiles filters by treeExtensions", () => {
    const files = [
      { name: "note.md", path: "note.md", extension: "md" },
      { name: "drawing.excalidraw.md", path: "drawing.excalidraw.md", extension: "md" },
      { name: "board.canvas", path: "board.canvas", extension: "canvas" },
      { name: "doc.pdf", path: "doc.pdf", extension: "pdf" },
    ];
    const treeExts = [".md", ".canvas", ".excalidraw.md"];
    const result = service.getTreeFiles(files as any, treeExts);
    expect(result.map((f: any) => f.name)).toEqual([
      "note.md",
      "drawing.excalidraw.md",
      "board.canvas",
    ]);
  });

  test("getNonMdFiles filters out tree extensions", () => {
    const files = [
      { name: "note.md", path: "note.md", extension: "md", stat: { mtime: 1 } },
      { name: "doc.pdf", path: "doc.pdf", extension: "pdf", stat: { mtime: 2 } },
      { name: "img.png", path: "img.png", extension: "png", stat: { mtime: 3 } },
    ];
    const treeExts = [".md", ".canvas", ".excalidraw.md"];
    const result = service.getNonMdFiles(files as any, treeExts, "name", "asc");
    expect(result.map((f: any) => f.name)).toEqual(["doc.pdf", "img.png"]);
  });

  test("getDirectoryChildren returns direct children only", () => {
    const files = [
      { path: "folder/note.md", name: "note.md" },
      { path: "folder/sub/doc.pdf", name: "doc.pdf" },
      { path: "folder/img.png", name: "img.png" },
      { path: "other/file.txt", name: "file.txt" },
    ];
    const result = service.getDirectoryChildren("folder/", files as any);
    expect(result.map((f: any) => f.name).sort()).toEqual([
      "img.png",
      "note.md",
    ]);
  });

  test("sortFiles sorts by name ascending", () => {
    const files = [
      { name: "c.md", stat: { mtime: 3 } },
      { name: "a.md", stat: { mtime: 1 } },
      { name: "b.md", stat: { mtime: 2 } },
    ];
    const result = service.sortFiles(files as any, "name", "asc");
    expect(result.map((f: any) => f.name)).toEqual(["a.md", "b.md", "c.md"]);
  });

  test("sortFiles sorts by mtime descending", () => {
    const files = [
      { name: "old.md", stat: { mtime: 100 } },
      { name: "new.md", stat: { mtime: 300 } },
      { name: "mid.md", stat: { mtime: 200 } },
    ];
    const result = service.sortFiles(files as any, "mtime", "desc");
    expect(result.map((f: any) => f.name)).toEqual(["new.md", "mid.md", "old.md"]);
  });
});
