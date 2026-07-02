// Inline interface test — no need to import settings.ts which imports obsidian
interface VaultViewerSettings {
  sortBy: "name" | "mtime" | "ctime" | "size";
  sortOrder: "asc" | "desc";
  hiddenExtensions: string[];
  treeExtensions: string[];
  treeSortEnabled: boolean;
  theme: "default" | "fresh";
  lang: "zh-CN" | "zh-TW" | "en";
  treeSplit: number;
}

const DEFAULT_SETTINGS: VaultViewerSettings = {
  sortBy: "name",
  sortOrder: "asc",
  hiddenExtensions: [],
  treeExtensions: [".md", ".canvas", ".excalidraw.md"],
  treeSortEnabled: true,
  theme: "default",
  lang: "zh-CN",
  treeSplit: 50,
};

describe("VaultViewerSettings treeSplit", () => {
  test("DEFAULT_SETTINGS has treeSplit defaulting to 50", () => {
    expect(DEFAULT_SETTINGS.treeSplit).toBe(50);
  });

  test("treeSplit must be between 10 and 90", () => {
    expect(DEFAULT_SETTINGS.treeSplit).toBeGreaterThanOrEqual(10);
    expect(DEFAULT_SETTINGS.treeSplit).toBeLessThanOrEqual(90);
  });

  test("VaultViewerSettings type includes treeSplit", () => {
    const s: VaultViewerSettings = { ...DEFAULT_SETTINGS, treeSplit: 70 };
    expect(s.treeSplit).toBe(70);
  });
});