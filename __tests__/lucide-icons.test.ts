import { setLucideIconFilled, setLucideIcon, setIconTheme, getIconTheme } from "../src/utils/lucide-icons";

// ─── Minimal DOM mock for Node environment ──────────────────────────────────

class MockSVGElement {
  tagName = "svg";
  attributes: Record<string, string> = {};
  children: MockSVGElement[] = [];
  parentNode: MockSVGElement | null = null;
  ownerDocument: MockDocument;

  constructor(doc: MockDocument) {
    this.ownerDocument = doc;
  }

  setAttribute(name: string, value: string) {
    this.attributes[name] = value;
  }
  getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }
  appendChild(child: MockSVGElement) {
    this.children.push(child);
    child.parentNode = this;
  }
  cloneNode(_deep?: boolean): MockSVGElement {
    const clone = new MockSVGElement(this.ownerDocument);
    clone.attributes = { ...this.attributes };
    return clone;
  }
}

class MockElement {
  tagName: string;
  children: (MockElement | MockSVGElement)[] = [];
  innerHTML = "";
  private _dataset: Record<string, string> = {};

  constructor(tagName: string) {
    this.tagName = tagName;
  }

  get dataset(): Record<string, string> {
    return this._dataset;
  }

  empty() {
    this.children = [];
    this.innerHTML = "";
  }

  appendChild(child: MockElement | MockSVGElement) {
    this.children.push(child);
  }

  querySelector(selector: string): MockSVGElement | null {
    if (selector === "svg" && this.children.length > 0) {
      const first = this.children[0];
      if (first instanceof MockSVGElement) return first;
    }
    return null;
  }
}

class MockDocument {
  createElement(tagName: string): MockElement {
    return new MockElement(tagName);
  }

  createElementNS(_ns: string, qualifiedName: string): MockSVGElement {
    return new MockSVGElement(this);
  }
}

// Simple DOMParser mock that parses SVG child elements
class MockDOMParser {
  parseFromString(svgString: string) {
    const doc = {
      querySelector(selector: string) {
        if (selector === "svg") {
          const innerMatch = svgString.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
          const inner = innerMatch ? innerMatch[1] : "";
          const childNodes: MockSVGElement[] = [];
          const pathRegex = /<(path|rect|circle|line|polyline|polygon|ellipse)[^>]*\/?>/g;
          let match;
          const mockDoc = new MockDocument();
          while ((match = pathRegex.exec(inner)) !== null) {
            const el = new MockSVGElement(mockDoc);
            el.tagName = match[1];
            childNodes.push(el);
          }
          return { childNodes };
        }
        return null;
      },
    };
    return doc;
  }
}

beforeEach(() => {
  (global as any).activeDocument = new MockDocument();
  (global as any).DOMParser = MockDOMParser;
});

afterEach(() => {
  setIconTheme("default");
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("setLucideIconFilled", () => {
  test("renders SVG with fill='currentColor'", () => {
    const el = new MockElement("div");
    setLucideIconFilled(el as any, "FileFill", 16);
    const svg = el.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("fill")).toBe("currentColor");
  });

  test("renders SVG with class 'vv-icon'", () => {
    const el = new MockElement("div");
    setLucideIconFilled(el as any, "FileFill", 16);
    const svg = el.querySelector("svg");
    expect(svg?.getAttribute("class")).toBe("vv-icon");
  });

  test("renders SVG with stroke='currentColor'", () => {
    const el = new MockElement("div");
    setLucideIconFilled(el as any, "FileFill", 16);
    const svg = el.querySelector("svg");
    expect(svg?.getAttribute("stroke")).toBe("currentColor");
  });

  test("returns empty for unknown icon name", () => {
    const el = new MockElement("div");
    setLucideIconFilled(el as any, "NonExistentIcon", 16);
    expect(el.querySelector("svg")).toBeNull();
  });

  test("renders with custom size", () => {
    const el = new MockElement("div");
    setLucideIconFilled(el as any, "FileFill", 24);
    const svg = el.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("24");
    expect(svg?.getAttribute("height")).toBe("24");
  });
});

describe("setLucideIcon (outline) vs setLucideIconFilled", () => {
  test("outline uses fill='none', filled uses fill='currentColor'", () => {
    const elOutline = new MockElement("div");
    const elFilled = new MockElement("div");

    setLucideIcon(elOutline as any, "File", 16);
    setLucideIconFilled(elFilled as any, "FileFill", 16);

    const svgOutline = elOutline.querySelector("svg");
    const svgFilled = elFilled.querySelector("svg");

    expect(svgOutline?.getAttribute("fill")).toBe("none");
    expect(svgFilled?.getAttribute("fill")).toBe("currentColor");
  });
});

describe("filled icon entries in default theme", () => {
  const filledIcons = ["FileFill", "FolderFill", "FileTextFill", "FolderOpenDotFill", "LayoutDashboard", "PenLine"];

  test.each(filledIcons)("renders %s in default theme", (iconName) => {
    setIconTheme("default");
    const el = new MockElement("div");
    setLucideIconFilled(el as any, iconName, 16);
    const svg = el.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("fill")).toBe("currentColor");
  });
});

describe("filled icon entries in fresh theme", () => {
  const filledIcons = ["FileFill", "FolderFill", "FileTextFill", "FolderOpenDotFill", "LayoutDashboard", "PenLine"];

  test.each(filledIcons)("renders %s in fresh theme", (iconName) => {
    setIconTheme("fresh");
    const el = new MockElement("div");
    setLucideIconFilled(el as any, iconName, 16);
    const svg = el.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("fill")).toBe("currentColor");
  });
});
