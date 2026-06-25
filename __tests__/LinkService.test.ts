import { LinkService, ResolvedLink } from "../src/services/LinkService";

describe("LinkService", () => {
  let service: LinkService;
  const mockMetadataCache = {
    getFileCache: jest.fn(),
    getFirstLinkpathDest: jest.fn(),
    on: jest.fn().mockReturnValue(jest.fn()),
  };

  beforeEach(() => {
    service = new LinkService(mockMetadataCache as any);
  });

  test("getForwardLinks returns links and embeds from cache", () => {
    const mockFile = { path: "note.md" };
    mockMetadataCache.getFileCache.mockReturnValue({
      links: [
        { link: "target1", original: "[[target1]]" },
        { link: "target2", original: "[[target2|display]]", displayText: "display" },
      ],
      embeds: [
        { link: "image.png", original: "![[image.png]]" },
      ],
    });
    mockMetadataCache.getFirstLinkpathDest
      .mockReturnValueOnce({ path: "target1.md", name: "target1.md" } as any)
      .mockReturnValueOnce({ path: "target2.md", name: "target2.md" } as any)
      .mockReturnValueOnce({ path: "image.png", name: "image.png" } as any);

    const result = service.getForwardLinks(mockFile as any);
    expect(result).toHaveLength(3);
    expect(result[0].linkType).toBe("link");
    expect(result[0].resolved).toBe(true);
    expect(result[1].displayText).toBe("display");
    expect(result[2].linkType).toBe("embed");
  });

  test("marks unresolved links", () => {
    const mockFile = { path: "note.md" };
    mockMetadataCache.getFileCache.mockReturnValue({
      links: [{ link: "nonexistent", original: "[[nonexistent]]" }],
    });
    mockMetadataCache.getFirstLinkpathDest.mockReturnValue(null);

    const result = service.getForwardLinks(mockFile as any);
    expect(result).toHaveLength(1);
    expect(result[0].resolved).toBe(false);
    expect(result[0].file).toBeNull();
  });

  test("returns empty array for file with no cache", () => {
    const mockFile = { path: "note.md" };
    mockMetadataCache.getFileCache.mockReturnValue(null);
    const result = service.getForwardLinks(mockFile as any);
    expect(result).toEqual([]);
  });

  test("isMarkdownFile checks extension", () => {
    const mdFile = { path: "note.md", extension: "md" } as any;
    const nonMdFile = { path: "doc.pdf", extension: "pdf" } as any;
    expect(service.isMarkdownFile(mdFile)).toBe(true);
    expect(service.isMarkdownFile(nonMdFile)).toBe(false);
  });
});
