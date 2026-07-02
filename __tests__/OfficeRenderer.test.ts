// Helper to create mock DOM elements
function createMockEl() {
  const el: any = {
    empty: jest.fn(),
    addClass: jest.fn(),
    removeClass: jest.fn(),
    setText: jest.fn(),
    addEventListener: jest.fn(),
    style: {},
    textContent: "",
    appendChild: jest.fn(),
    removeChild: jest.fn(),
    parentNode: null,
    createDiv: () => createMockEl(),
    createEl: () => createMockEl(),
    createSpan: () => createMockEl(),
  };
  return el;
}

// Mock obsidian for OfficeView
jest.mock("obsidian", () => {
  class ItemView {
    contentEl: any;
    app: any;
    constructor(leaf: any) {
      this.contentEl = createMockEl();
      this.app = {
        workspace: {
          detachLeavesOfType: jest.fn(),
        },
        vault: {
          adapter: {
            getBasePath: () => "/test",
          },
        },
      };
    }
    getViewType() { return "test"; }
    getDisplayText() { return ""; }
    getIcon() { return ""; }
    onOpen() { return Promise.resolve(); }
    onClose() { return Promise.resolve(); }
    registerEvent() {}
  }
  return {
    ItemView,
    WorkspaceLeaf: class {},
    TFile: class {},
    FileSystemAdapter: class { getBasePath() { return "/test"; } },
  };
}, { virtual: true });

// Mock pptxviewjs
jest.mock("pptxviewjs", () => ({
  PPTXViewer: class {},
}), { virtual: true });

// Mock chart.js/auto
jest.mock("chart.js/auto", () => ({
  default: {},
  Chart: {},
}), { virtual: true });

import { OfficeRenderer } from "../src/services/OfficeRenderer";
import { OfficeView } from "../src/views/OfficeView";

// Mock i18n
jest.mock("../src/i18n", () => ({ t: (k: string) => k }));

// Mock lucide-icons
jest.mock("../src/utils/lucide-icons", () => ({ setLucideIcon: jest.fn() }));

const mockVault = {
  readBinary: jest.fn(),
  read: jest.fn(),
} as any;

describe("OfficeRenderer", () => {
  let renderer: OfficeRenderer;

  beforeEach(() => {
    renderer = new OfficeRenderer(mockVault);
  });

  test("has render method", () => {
    expect(typeof renderer.render).toBe("function");
  });
});

describe("OfficeView onClose", () => {
  test("empties contentEl when onClose is called", async () => {
    const mockRenderer = {
      render: jest.fn().mockResolvedValue("test.xlsx"),
    };

    const leaf = {} as any;
    const file = { name: "test.xlsx", extension: "xlsx" } as any;
    const view = new OfficeView(leaf, mockRenderer as any);
    view.file = file;

    await view.onOpen();
    await view.onClose();

    // contentEl.empty() should have been called
    expect(view.contentEl.empty).toHaveBeenCalled();
  });
});