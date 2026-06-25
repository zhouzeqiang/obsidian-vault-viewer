import { TFile, TFolder, Vault, TAbstractFile, EventRef } from "obsidian";
import { isTreeExtension } from "../utils/extensions";

export type SortField = "name" | "mtime" | "ctime" | "size";
export type SortOrder = "asc" | "desc";

export interface FileChangeCallback {
  (type: "create" | "delete" | "rename", file: TAbstractFile): void;
}

export class FileService {
  private vault: Vault;
  private listeners: EventRef[] = [];
  private onChangeCallbacks: FileChangeCallback[] = [];

  constructor(vault: Vault) {
    this.vault = vault;
  }

  startListening(cb: FileChangeCallback): void {
    this.onChangeCallbacks.push(cb);
    this.listeners.push(
      this.vault.on("create", (file) => cb("create", file)),
      this.vault.on("delete", (file) => cb("delete", file)),
      this.vault.on("rename", (file, _oldPath) => cb("rename", file))
    );
  }

  stopListening(): void {
    for (const ref of this.listeners) this.vault.offref(ref);
    this.listeners = [];
  }

  getAllFiles(): TFile[] {
    return this.vault.getFiles();
  }

  getTreeFiles(files: TFile[], treeExtensions: string[]): TFile[] {
    return files.filter((f) => isTreeExtension(f.name, treeExtensions));
  }

  getNonMdFiles(
    files: TFile[],
    treeExtensions: string[],
    sortField: SortField,
    sortOrder: SortOrder
  ): TFile[] {
    const filtered = files.filter(
      (f) => !isTreeExtension(f.name, treeExtensions)
    );
    return this.sortFiles(filtered, sortField, sortOrder);
  }

  getDirectoryChildren(dirPath: string, files: TFile[]): TFile[] {
    const isRoot = dirPath === "/" || dirPath === "";
    const prefix = isRoot ? "" : (dirPath.endsWith("/") ? dirPath : dirPath + "/");
    return files.filter((f) => {
      if (!isRoot && !f.path.startsWith(prefix)) return false;
      if (isRoot) return !f.path.includes("/");
      const rest = f.path.slice(prefix.length);
      return !rest.includes("/");
    });
  }

  sortFiles(
    files: TFile[],
    field: SortField,
    order: SortOrder
  ): TFile[] {
    const sorted = [...files].sort((a, b) => {
      let cmp = 0;
      switch (field) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "mtime":
          cmp = a.stat.mtime - b.stat.mtime;
          break;
        case "ctime":
          cmp = a.stat.ctime - b.stat.ctime;
          break;
        case "size":
          cmp = a.stat.size - b.stat.size;
          break;
      }
      return order === "asc" ? cmp : -cmp;
    });
    return sorted;
  }

  getDirectSubfolders(
    rootPath: string,
    folders: TFolder[]
  ): TFolder[] {
    const prefix = rootPath.endsWith("/") ? rootPath : rootPath + "/";
    return folders.filter((f) => {
      if (f.path === rootPath) return false;
      if (!f.path.startsWith(prefix)) return false;
      const rest = f.path.slice(prefix.length);
      return !rest.includes("/");
    });
  }
}
