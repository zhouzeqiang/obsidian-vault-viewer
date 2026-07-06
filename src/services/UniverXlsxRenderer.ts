// src/services/UniverXlsxRenderer.ts
import { getLanguage } from "obsidian";
import {
	createUniver,
	LocaleType,
	defaultTheme,
	type FUniver,
} from "@univerjs/presets";
import { UniverSheetsCorePreset } from "@univerjs/preset-sheets-core";
import sheetsCoreZhCN from "@univerjs/preset-sheets-core/locales/zh-CN";
import sheetsCoreEnUS from "@univerjs/preset-sheets-core/locales/en-US";
import "@univerjs/preset-sheets-core/lib/index.css";

export class UniverXlsxRenderer {
	private univerAPI: FUniver | null = null;
	private univerContainer: HTMLElement | null = null;

	async render(buffer: ArrayBuffer, filename: string, container: HTMLElement): Promise<boolean> {
		console.warn("[UniverXlsxRenderer] render() called - delegating to fallback");
		try {
			const univerContainer = (activeDocument ?? document).createElement("div");
			univerContainer.className = "univer-xlsx-container";
			univerContainer.setCssProps({ width: "100%", height: "100%" });
			container.appendChild(univerContainer);
			// Add class to parent so CSS can target it without :has()
			container.classList.add("has-univer-xlsx");
			this.univerContainer = univerContainer;

			const locale =
				getLanguage() === "zh"
					? LocaleType.ZH_CN
					: LocaleType.EN_US;
			const localeData =
				locale === LocaleType.ZH_CN ? sheetsCoreZhCN : sheetsCoreEnUS;

			const { univerAPI } = createUniver({
				locale: locale,
				locales: {
					[locale]: localeData as Record<string, unknown>,
				},
				theme: defaultTheme as Record<string, string>,
				presets: [
					UniverSheetsCorePreset({
						container: univerContainer,
						toolbar: false,
						contextMenu: false,
						formulaBar: false,
						footer: false,
					}),
				],
			});
			this.univerAPI = univerAPI;
		} catch (err) {
			console.error("[UniverXlsxRenderer] init failed:", err);
		}

		// Clean up Univer container since importXLSXToSnapshotAsync is not available in OSS Univer
		this.dispose();

		// Return false to trigger fallback to the existing JSZip + HTML table renderer
		return false;
	}

	dispose(): void {
		if (this.univerAPI) {
			try { this.univerAPI.dispose(); } catch { /* ignore */ }
			this.univerAPI = null;
		}
		if (this.univerContainer && this.univerContainer.parentNode) {
			try { this.univerContainer.parentNode.removeChild(this.univerContainer); } catch { /* ignore */ }
		}
		this.univerContainer = null;
	}
}
