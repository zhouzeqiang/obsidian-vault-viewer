import { App, PluginSettingTab, Setting } from "obsidian";
import VaultViewerPlugin from "./main";
import { t, setLang } from "./i18n";
import { setIconTheme } from "./utils/lucide-icons";

export interface VaultViewerSettings {
  sortBy: "name" | "mtime" | "ctime" | "size";
  sortOrder: "asc" | "desc";
  hiddenExtensions: string[];
  treeExtensions: string[];
  treeSortEnabled: boolean;
  theme: "default" | "fresh";
  lang: "zh-CN" | "zh-TW" | "en";
}

export const DEFAULT_SETTINGS: VaultViewerSettings = {
  sortBy: "name",
  sortOrder: "asc",
  hiddenExtensions: [],
  treeExtensions: [".md", ".canvas", ".excalidraw.md"],
  treeSortEnabled: true,
  theme: "default",
  lang: "zh-CN",
};

export class VaultViewerSettingTab extends PluginSettingTab {
  plugin: VaultViewerPlugin;

  constructor(app: App, plugin: VaultViewerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName(t("settings.title")).setHeading();

    new Setting(containerEl)
      .setName(t("settings.theme"))
      .setDesc(t("settings.themeDesc"))
      .addDropdown((dd) =>
        dd
          .addOption("default", t("settings.themeDefault"))
          .addOption("fresh", t("settings.themeFresh"))
          .setValue(this.plugin.settings.theme)
          .onChange(async (val: "default" | "fresh") => {
            this.plugin.settings.theme = val;
            await this.plugin.saveSettings();
            setIconTheme(val);
            this.plugin.activateView(true);
          })
      );

    new Setting(containerEl)
      .setName(t("settings.lang"))
      .setDesc(t("settings.langDesc"))
      .addDropdown((dd) =>
        dd
          .addOption("zh-CN", "简体中文")
          .addOption("zh-TW", "繁體中文")
          .addOption("en", "English")
          .setValue(this.plugin.settings.lang)
          .onChange(async (val: "zh-CN" | "zh-TW" | "en") => {
            this.plugin.settings.lang = val;
            await this.plugin.saveSettings();
            setLang(val);
            this.display();
            this.plugin.activateView(true);
          })
      );

    new Setting(containerEl).setName(t("settings.defaultSort")).setHeading();

    new Setting(containerEl)
      .setName(t("settings.defaultSort"))
      .setDesc(t("settings.defaultSortDesc"))
      .addDropdown((dd) =>
        dd
          .addOption("name", t("sort.name"))
          .addOption("mtime", t("sort.mtime"))
          .addOption("ctime", t("sort.ctime"))
          .addOption("size", t("sort.size"))
          .setValue(this.plugin.settings.sortBy)
          .onChange(async (val: "name" | "mtime" | "ctime" | "size") => {
            this.plugin.settings.sortBy = val;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t("settings.sortOrder"))
      .addDropdown((dd) =>
        dd
          .addOption("asc", t("sort.asc"))
          .addOption("desc", t("sort.desc"))
          .setValue(this.plugin.settings.sortOrder)
          .onChange(async (val: "asc" | "desc") => {
            this.plugin.settings.sortOrder = val;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl).setName(t("settings.hideTypes")).setHeading();

    new Setting(containerEl)
      .setName(t("settings.hideTypes"))
      .setDesc(t("settings.hideTypesDesc"))
      .addTextArea((ta) =>
        ta
          .setPlaceholder(".exe\n.zip\n.dll")
          .setValue(this.plugin.settings.hiddenExtensions.join("\n"))
          .onChange(async (val) => {
            this.plugin.settings.hiddenExtensions = val
              .split("\n")
              .map((s) => s.trim())
              .filter((s) => s.startsWith("."));
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl).setName(t("settings.treeExtensions")).setHeading();

    new Setting(containerEl)
      .setName(t("settings.treeExtensions"))
      .setDesc(t("settings.treeExtensionsDesc"))
      .addTextArea((ta) =>
        ta
          .setPlaceholder(".md\n.canvas\n.excalidraw.md")
          .setValue(this.plugin.settings.treeExtensions.join("\n"))
          .onChange(async (val) => {
            this.plugin.settings.treeExtensions = val
              .split("\n")
              .map((s) => s.trim())
              .filter((s) => s.startsWith("."));
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t("settings.sortFolders"))
      .setDesc(t("settings.sortFoldersDesc"))
      .addToggle((t) =>
        t
          .setValue(this.plugin.settings.treeSortEnabled)
          .onChange(async (val) => {
            this.plugin.settings.treeSortEnabled = val;
            await this.plugin.saveSettings();
          })
      );
  }
}
