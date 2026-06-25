import { TFile, MetadataCache, EventRef } from "obsidian";

export interface ResolvedLink {
  file: TFile | null;
  linkType: "link" | "embed";
  displayText?: string;
  original: string;
  resolved: boolean;
}

export class LinkService {
  private cache: MetadataCache;
  private listeners: EventRef[] = [];

  constructor(cache: MetadataCache) {
    this.cache = cache;
  }

  startListening(cb: (file: TFile) => void): void {
    this.listeners.push(
      this.cache.on("changed", (file: TFile) => cb(file))
    );
  }

  stopListening(): void {
    for (const ref of this.listeners) this.cache.offref(ref);
    this.listeners = [];
  }

  getForwardLinks(file: TFile): ResolvedLink[] {
    const cache = this.cache.getFileCache(file);
    if (!cache) return [];

    const results: ResolvedLink[] = [];

    if (cache.links) {
      for (const link of cache.links) {
        const dest = this.cache.getFirstLinkpathDest(link.link, file.path);
        results.push({
          file: dest,
          linkType: "link",
          displayText: link.displayText || undefined,
          original: link.original,
          resolved: dest !== null,
        });
      }
    }

    if (cache.embeds) {
      for (const embed of cache.embeds) {
        const dest = this.cache.getFirstLinkpathDest(embed.link, file.path);
        results.push({
          file: dest,
          linkType: "embed",
          original: embed.original,
          resolved: dest !== null,
        });
      }
    }

    return results;
  }

  isMarkdownFile(file: TFile): boolean {
    return file.extension === "md";
  }
}
