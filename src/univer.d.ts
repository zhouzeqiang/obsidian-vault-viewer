declare module "@univerjs/presets" {
	export const defaultTheme: Record<string, string>;
	export const greenTheme: Record<string, string>;
	export const LocaleType: {
		ZH_CN: string;
		EN_US: string;
	};
	export function createUniver(options: Record<string, unknown>): {
		univerAPI: import("@univerjs/presets").FUniver;
	};
	export function mergeLocales(localeData: Record<string, unknown>): Record<string, unknown>;
	export type FUniver = {
		importXLSXToSnapshotAsync(file: File): Promise<Record<string, unknown> | undefined>;
		createWorkbook(snapshot: Record<string, unknown>): unknown;
		dispose(): void;
		getActiveWorkbook(): FWorkbook | null;
		addEvent(event: unknown, callback: (data: unknown) => void): void;
		Event: { LifeCycleChanged: unknown };
		Enum: { LifecycleStages: { Rendered: number } };
	};
	export type FWorkbook = {
		disableSelection(): void;
		getWorkbookPermission(): FWorkbookPermission;
	};
	export type FWorkbookPermission = {
		setReadOnly(): void;
		setPermissionDialogVisible(visible: boolean): void;
	};
	export type IWorkbookData = Record<string, unknown>;
}

declare module "@univerjs/preset-sheets-core" {
	export function UniverSheetsCorePreset(options: {
		container: HTMLElement;
		toolbar?: boolean;
		contextMenu?: boolean;
		formulaBar?: boolean;
		footer?: boolean;
	}): unknown;
}

declare module "@univerjs/preset-sheets-core/locales/*" {
	const locale: Record<string, unknown>;
	export default locale;
}
