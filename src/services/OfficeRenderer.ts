import { TFile, Vault } from "obsidian";
import * as docx from "docx-preview";
import JSZip from "jszip";

interface XlsxFont {
  bold?: boolean;
  italic?: boolean;
  size?: number;
  color?: string;
  name?: string;
}

interface XlsxFill {
  fgColor?: string;
  bgColor?: string;
}

interface XlsxBorder {
  left?: string;
  right?: string;
  top?: string;
  bottom?: string;
}

interface XlsxCellStyle {
  fontId?: number;
  fillId?: number;
  borderId?: number;
}

interface XlsxStyles {
  fonts: XlsxFont[];
  fills: XlsxFill[];
  borders: XlsxBorder[];
  cellXfs: XlsxCellStyle[];
}

interface XlsxCellData {
  value: string;
  style: Record<string, string>;
}

export class OfficeRenderer {
  private vault: Vault;

  constructor(vault: Vault) {
    this.vault = vault;
  }

  async render(file: TFile, bodyContainer: HTMLElement): Promise<string> {
    const ext = file.extension.toLowerCase();
    bodyContainer.empty();

    switch (ext) {
      case "docx":
        return this.renderDocx(await this.vault.readBinary(file), file.name, bodyContainer);
      case "xlsx":
        return this.renderXlsx(await this.vault.readBinary(file), file.name, bodyContainer);
      case "pptx":
        return this.renderPptx(await this.vault.readBinary(file), file.name, bodyContainer);
      case "sql":
        return this.renderSql(await this.vault.read(file), file.name, bodyContainer);
      default:
        throw new Error(`Unsupported format: .${ext}`);
    }
  }

  private async renderDocx(buffer: ArrayBuffer, filename: string, container: HTMLElement): Promise<string> {
    const docxContainer = container.createDiv({ cls: "office-docx" });
    await docx.renderAsync(buffer, docxContainer, undefined);
    return filename;
  }

  private async renderXlsx(buffer: ArrayBuffer, filename: string, container: HTMLElement): Promise<string> {
    const zip = await JSZip.loadAsync(buffer);
    const styles = await this.parseXlsxStyles(zip);
    const sharedStrings = await this.parseXlsxSharedStrings(zip);
    const sheetNames = await this.getSheetNames(zip);

    const MAX_ROWS = 1000;
    container.empty();
    const wrapper = container.createDiv({ cls: "office-xlsx" });

    for (const sheetName of sheetNames) {
      const sheetFile = await this.findSheetFile(zip, sheetName);
      if (!sheetFile) continue;

      const sheetXml = await zip.files[sheetFile].async("string");
      const rows = this.parseXlsxSheet(sheetXml, sharedStrings, styles);

      wrapper.createEl("h3", { text: sheetName });

      if (rows.length === 0) continue;

      if (rows.length > MAX_ROWS) {
        wrapper.createEl("p", { cls: "office-truncated", text: `该表共 ${rows.length} 行，仅显示前 ${MAX_ROWS} 行` });
        rows.length = MAX_ROWS;
      }

      const maxCols = Math.max(...rows.map(r => r.length));
      const table = wrapper.createEl("table", { cls: "office-table" });
      for (const row of rows) {
        const tr = table.createEl("tr");
        for (let c = 0; c < maxCols; c++) {
          const cell = row[c];
          const val = cell ? this.escapeHtml(cell.value) : "";
          const td = tr.createEl("td", { text: val });
          if (cell?.style) {
            for (const [prop, value] of Object.entries(cell.style)) {
              td.style.setProperty(prop, value as string);
            }
          }
        }
      }
    }

    return filename;
  }

  private async renderPptx(_buffer: ArrayBuffer, filename: string, _container: HTMLElement): Promise<string> {
    throw new Error("OPEN_EXTERNALLY");
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, (c) => map[c]);
  }

  private async renderSql(content: string, filename: string, container: HTMLElement): Promise<string> {
    const titleMatch = filename.match(/^(.+)\.sql$/i);
    const title = titleMatch ? titleMatch[1] : filename;
    container.empty();
    const pre = container.createEl("pre", { cls: "office-sql" });
    pre.createEl("code", { text: content });
    return title;
  }

  // ============== XLSX helpers ==============

  private async parseXlsxStyles(zip: JSZip): Promise<XlsxStyles> {
    const styleFile = zip.files["xl/styles.xml"];
    if (!styleFile) return { fonts: [], fills: [], borders: [], cellXfs: [] };

    const xml = await styleFile.async("string");

    const fonts: XlsxFont[] = [];
    const fontRegex = /<font[^>]*>([\s\S]*?)<\/font>/gi;
    let match;
    while ((match = fontRegex.exec(xml)) !== null) {
      const fb = match[1];
      const font: XlsxFont = {};
      if (/<b[>\s/]/.test(fb)) font.bold = true;
      if (/<i[>\s/]/.test(fb)) font.italic = true;
      const szMatch = fb.match(/<sz[^>]*val="([^"]+)"/);
      if (szMatch) font.size = parseFloat(szMatch[1]);
      const colorMatch = fb.match(/<color[^>]*rgb="([^"]+)"/);
      if (colorMatch) font.color = colorMatch[1];
      const nameMatch = fb.match(/<name[^>]*val="([^"]+)"/);
      if (nameMatch) font.name = nameMatch[1];
      fonts.push(font);
    }

    const fills: XlsxFill[] = [];
    const fillRegex = /<fill[^>]*>([\s\S]*?)<\/fill>/gi;
    while ((match = fillRegex.exec(xml)) !== null) {
      const fb = match[1];
      const fill: XlsxFill = {};
      const fgMatch = fb.match(/<fgColor[^>]*rgb="([^"]+)"/);
      if (fgMatch) fill.fgColor = fgMatch[1];
      const bgMatch = fb.match(/<bgColor[^>]*rgb="([^"]+)"/);
      if (bgMatch) fill.bgColor = bgMatch[1];
      fills.push(fill);
    }

    const borders: XlsxBorder[] = [];
    const borderRegex = /<border[^>]*>([\s\S]*?)<\/border>/gi;
    while ((match = borderRegex.exec(xml)) !== null) {
      const bb = match[1];
      const border: XlsxBorder = {};
      for (const side of ["left", "right", "top", "bottom"] as const) {
        const sMatch = bb.match(new RegExp(`<${side}[^>]*style="([^"]+)"`));
        if (sMatch) border[side] = sMatch[1];
      }
      borders.push(border);
    }

    const cellXfs: XlsxCellStyle[] = [];
    const xfRegex = /<xf[^>]*\/>|<xf[^>]*>[\s\S]*?<\/xf>/gi;
    while ((match = xfRegex.exec(xml)) !== null) {
      const xb = match[0];
      const xf: XlsxCellStyle = {};
      const fontIdMatch = xb.match(/fontId="(\d+)"/);
      if (fontIdMatch) xf.fontId = parseInt(fontIdMatch[1]);
      const fillIdMatch = xb.match(/fillId="(\d+)"/);
      if (fillIdMatch) xf.fillId = parseInt(fillIdMatch[1]);
      const borderIdMatch = xb.match(/borderId="(\d+)"/);
      if (borderIdMatch) xf.borderId = parseInt(borderIdMatch[1]);
      cellXfs.push(xf);
    }

    return { fonts, fills, borders, cellXfs };
  }

  private async parseXlsxSharedStrings(zip: JSZip): Promise<string[]> {
    const ssFile = zip.files["xl/sharedStrings.xml"];
    if (!ssFile) return [];

    const xml = await ssFile.async("string");
    const strings: string[] = [];
    const regex = /<si[^>]*>([\s\S]*?)<\/si>/gi;
    let match;
    while ((match = regex.exec(xml)) !== null) {
      const tMatch = match[1].match(/<t[^>]*>([^<]*)<\/t>/);
      strings.push(tMatch ? tMatch[1] : "");
    }
    return strings;
  }

  private async getSheetNames(zip: JSZip): Promise<string[]> {
    const wbFile = zip.files["xl/workbook.xml"];
    if (!wbFile) return [];

    const xml = await wbFile.async("string");
    const names: string[] = [];
    const regex = /<sheet[^>]*name="([^"]+)"/gi;
    let match;
    while ((match = regex.exec(xml)) !== null) {
      names.push(match[1]);
    }
    return names;
  }

  private async findSheetFile(zip: JSZip, sheetName: string): Promise<string | null> {
    const wbFile = zip.files["xl/workbook.xml"];
    if (!wbFile) return null;

    const wbXml = await wbFile.async("string");
    const sheetRegex = new RegExp(`<sheet[^>]*name="${this.escapeRegex(sheetName)}"[^>]*r:id="([^"]+)"`);
    const sheetMatch = sheetRegex.exec(wbXml);
    if (!sheetMatch) return "xl/worksheets/sheet1.xml";

    const rId = sheetMatch[1];

    const relsFile = zip.files["xl/_rels/workbook.xml.rels"];
    if (!relsFile) return "xl/worksheets/sheet1.xml";

    const relsXml = await relsFile.async("string");
    const targetRegex = new RegExp(`<Relationship[^>]*Id="${rId}"[^>]*Target="([^"]+)"`);
    const targetMatch = targetRegex.exec(relsXml);
    if (!targetMatch) return "xl/worksheets/sheet1.xml";

    let target = targetMatch[1];
    if (!target.startsWith("xl/")) target = "xl/" + target;
    return target;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private parseXlsxSheet(
    xml: string,
    sharedStrings: string[],
    styles: XlsxStyles
  ): XlsxCellData[][] {
    const rows: XlsxCellData[][] = [];
    const rowRegex = /<row[^>]*>([\s\S]*?)<\/row>/gi;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(xml)) !== null) {
      const rowXml = rowMatch[1];
      const cells: XlsxCellData[] = [];
      const cellRegex = /<c[^>]*>([\s\S]*?)<\/c>/gi;
      let cellMatch;

      while ((cellMatch = cellRegex.exec(rowXml)) !== null) {
        const cellXml = cellMatch[0];
        const tMatch = cellXml.match(/<c[^>]*t="([^"]+)"/);
        const sMatch = cellXml.match(/<c[^>]*s="(\d+)"/);
        const vMatch = cellXml.match(/<v[^>]*>([^<]*)<\/v>/);

        const type = tMatch ? tMatch[1] : "n";
        const styleIdx = sMatch ? parseInt(sMatch[1]) : 0;
        let value = vMatch ? vMatch[1] : "";

        if (type === "s" && sharedStrings[parseInt(value)]) {
          value = sharedStrings[parseInt(value)];
        }

        const styleAttrs = this.buildXlsxCellStyle(styleIdx, styles);
        cells.push({ value, style: styleAttrs });
      }

      rows.push(cells);
    }

    return rows;
  }

  private buildXlsxCellStyle(styleIdx: number, styles: XlsxStyles): Record<string, string> {
    const result: Record<string, string> = {};
    const xf = styles.cellXfs?.[styleIdx];
    if (!xf) return result;

    if (xf.fontId != null) {
      const font = styles.fonts?.[xf.fontId];
      if (font) {
        if (font.bold) result["font-weight"] = "bold";
        if (font.italic) result["font-style"] = "italic";
        if (font.size) result["font-size"] = `${font.size}pt`;
        if (font.color) result["color"] = `#${font.color}`;
      }
    }

    if (xf.fillId != null) {
      const fill = styles.fills?.[xf.fillId];
      if (fill?.fgColor && xf.fillId > 0) {
        result["background"] = `#${fill.fgColor}`;
      }
    }

    if (xf.borderId != null) {
      const border = styles.borders?.[xf.borderId];
      if (border) {
        if (border.top) result["border-top"] = "1px solid";
        if (border.bottom) result["border-bottom"] = "1px solid";
        if (border.left) result["border-left"] = "1px solid";
        if (border.right) result["border-right"] = "1px solid";
      }
    }

    return result;
  }
}


