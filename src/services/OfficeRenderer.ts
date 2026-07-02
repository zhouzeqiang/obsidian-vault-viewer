import { TFile, Vault } from "obsidian";
import * as docx from "docx-preview";
import JSZip from "jszip";
import { PPTXViewer } from "pptxviewjs";
import { setLucideIcon } from "../utils/lucide-icons";

interface XlsxFont {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
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
  leftColor?: string;
  rightColor?: string;
  topColor?: string;
  bottomColor?: string;
}

interface XlsxNumFmt {
  numFmtId: number;
  formatCode: string;
}

interface XlsxAlignment {
  horizontal?: string;
  vertical?: string;
  wrapText?: boolean;
  indent?: number;
}

interface XlsxCellStyle {
  fontId?: number;
  fillId?: number;
  borderId?: number;
  numFmtId?: number;
  alignment?: XlsxAlignment;
  applyAlignment?: boolean;
}

interface XlsxStyles {
  fonts: XlsxFont[];
  fills: XlsxFill[];
  borders: XlsxBorder[];
  cellXfs: XlsxCellStyle[];
  numFmts: XlsxNumFmt[];
}

interface XlsxCellData {
  value: string;
  style: Record<string, string>;
}

interface XlsxMergeCell {
  startCol: number;
  startRow: number;
  endCol: number;
  endRow: number;
}

interface XlsxColWidth {
  min: number;
  max: number;
  width: number;
  hidden: boolean;
}

export class OfficeRenderer {
  private vault: Vault;

  constructor(vault: Vault) {
    this.vault = vault;
  }

  async render(file: TFile, bodyContainer: HTMLElement): Promise<string> {
    const ext = file.extension.toLowerCase();
    bodyContainer.empty();
    bodyContainer.classList.remove("office-view-has-pptx");

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
    const wrapper = container.createDiv({ cls: "office-pptx" });

    const tableWrapper = wrapper.createDiv({ cls: "pptx-canvas-wrapper", attr: { style: "display:block; overflow:auto; padding:0;" } });

    // Bottom bar with sheet tabs (left-aligned)
    const bottomBar = wrapper.createDiv({ cls: "pptx-bottom-bar" });
    const sheetTabs = bottomBar.createDiv({ cls: "pptx-sheet-tabs" });
    let currentSheetIdx = 0;

    const sheetData = await Promise.all(sheetNames.map(async (name) => {
      const sheetFile = await this.findSheetFile(zip, name);
      if (!sheetFile) return { merges: [], colWidths: [], rows: [] };
      const sheetXml = await zip.files[sheetFile].async("string");
      return {
        merges: this.parseXlsxMergeCells(sheetXml),
        colWidths: this.parseXlsxCols(sheetXml),
        rows: this.parseXlsxSheet(sheetXml, sharedStrings, styles),
      };
    }));

    const renderSheet = (idx: number) => {
      tableWrapper.empty();
      const data = sheetData[idx];
      if (!data || data.rows.length === 0) {
        tableWrapper.createEl("p", { cls: "office-view-status", text: "\u7a7a\u8868" });
        return;
      }

      const rows = data.rows.length > MAX_ROWS ? data.rows.slice(0, MAX_ROWS) : data.rows;
      const maxDataCols = rows.reduce((a, r) => Math.max(a, r.length), 0);
      const maxColWidthDef = data.colWidths.length > 0 ? Math.max(...data.colWidths.map(c => c.max)) : 0;
      const maxCols = Math.max(maxDataCols, maxColWidthDef, 1);
      const mergeHidden = this.buildMergeHiddenSet(data.merges);

      const table = tableWrapper.createEl("table", { cls: "office-table", attr: { style: "margin:0;border-collapse:collapse;" } });

      if (data.colWidths.length > 0) {
        const colgroup = table.createEl("colgroup");
        for (let c = 0; c < maxCols; c++) {
          const w = this.getColumnWidth(data.colWidths, c);
          if (w) {
            colgroup.createEl("col", { attr: { style: "width:" + Math.round(w * 7) + "px" } });
          } else {
            colgroup.createEl("col");
          }
        }
      }

      // Header row as <th>
      if (rows.length > 0) {
        const thead = table.createEl("thead");
        const headerRow = rows[0];
        const tr = thead.createEl("tr");
        let visualCol = 0;
        for (let c = 0; c < maxCols; c++) {
          if (mergeHidden.has("0," + c)) continue;
          const cell = headerRow[c];
          const val = cell ? this.escapeHtml(cell.value) : "";
          const th = tr.createEl("th", { text: val, attr: { "data-col": c.toString() } });

          // background-color disabled per requirements
          // if (cell && cell.style && cell.style["background-color"]) {
          //   th.style.setProperty("background-color", cell.style["background-color"]);
          // }

          // Column resize handle
          if (c < maxCols - 1) {
            const resizer = th.createDiv({ cls: "office-col-resizer", attr: { style: "right:-2.5px;" } });
            setLucideIcon(resizer.createSpan({ cls: "office-col-resizer-icon" }), "ChevronsUpDown", 10);
            resizer.addEventListener("mousedown", (e: MouseEvent) => {
              e.preventDefault();
              const startX = e.clientX;
              const startWidth = th.offsetWidth;
              const onMouseMove = (ev: MouseEvent) => {
                const diff = ev.clientX - startX;
                const newWidth = Math.max(20, startWidth + diff);
                th.style.width = newWidth + "px";
                const allRows = table.querySelectorAll("tr");
                const colIdx = c;
                allRows.forEach((row) => {
                  const cells = Array.from(row.querySelectorAll("td[data-col], th[data-col]"));
                  for (const cell of cells) {
                    if (cell.getAttr("data-col") === String(colIdx)) {
                      (cell as HTMLElement).style.width = newWidth + "px";
                    }
                  }
                });
              };
              const onMouseUp = () => {
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
              };
              document.addEventListener("mousemove", onMouseMove);
              document.addEventListener("mouseup", onMouseUp);
            });
          }

          const merge = data.merges.find(m => m.startCol === c && m.startRow === 0);
          if (merge) {
            const colspan = merge.endCol - merge.startCol + 1;
            const rowspan = merge.endRow - merge.startRow + 1;
            if (colspan > 1) th.setAttr("colspan", colspan);
            if (rowspan > 1) th.setAttr("rowspan", rowspan);
          }
          visualCol++;
        }
      }

      // Data rows
      const tbody = table.createEl("tbody");
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        const tr = tbody.createEl("tr");
        for (let c = 0; c < maxCols; c++) {
          if (mergeHidden.has(r + "," + c)) continue;

          const cell = row[c];
          const val = cell ? this.escapeHtml(cell.value) : "";
          const td = tr.createEl("td", { text: val, attr: { "data-col": c.toString() } });

          // Apply styles but skip color, font-size, and font-weight (bold reserved for headers)
          if (cell && cell.style) {
            for (const [prop, value] of Object.entries(cell.style)) {
              if (prop === "color" || prop === "font-size" || prop === "font-weight") continue;
              td.style.setProperty(prop, value);
            }
          }

          const merge = data.merges.find(m => m.startCol === c && m.startRow === r);
          if (merge) {
            const colspan = merge.endCol - merge.startCol + 1;
            const rowspan = merge.endRow - merge.startRow + 1;
            if (colspan > 1) td.setAttr("colspan", colspan);
            if (rowspan > 1) td.setAttr("rowspan", rowspan);
          }
        }
      }

      if (data.rows.length > MAX_ROWS) {
        tableWrapper.createEl("p", { cls: "office-truncated", text: "\u8be5\u8868\u5171" + data.rows.length + " \u884c\uff0c\u4ec5\u663e\u793a\u524d " + MAX_ROWS + " \u884c" });
      }

      // Update active tab
      sheetTabs.querySelectorAll(".pptx-sheet-tab").forEach((tab) => tab.removeClass("active"));
      const activeTab = sheetTabs.querySelector(".pptx-sheet-tab[data-idx=\"" + idx + "\"]");
      if (activeTab) activeTab.addClass("active");
    };

    const updateSheet = (idx: number) => {
      currentSheetIdx = idx;
      renderSheet(idx);
    };

    // Build sheet tabs
    sheetNames.forEach((name, i) => {
      const tab = sheetTabs.createEl("button", { cls: "pptx-sheet-tab" + (i === 0 ? " active" : ""), text: name, attr: { "data-idx": i.toString() } });
      tab.addEventListener("click", () => { updateSheet(i); });
    });

    updateSheet(0);
    return filename;
  }

  private parseXlsxCols(sheetXml: string): XlsxColWidth[] {
    const cols: XlsxColWidth[] = [];
    const colRegex = /<col\s+([^>]*)>/gi;
    let match;
    while ((match = colRegex.exec(sheetXml)) !== null) {
      const attrs = match[1];
      const min = parseInt((attrs.match(/min="(\d+)"/) || [])[1]);
      const max = parseInt((attrs.match(/max="(\d+)"/) || [])[1]);
      const width = parseFloat((attrs.match(/width="([^"]+)"/) || [])[1]);
      const hiddenMatch = attrs.match(/hidden\s*=\s*"([^"]+)"/);
      const hidden = hiddenMatch ? (hiddenMatch[1] === "1" || hiddenMatch[1] === "true") : false;
      // Skip hidden columns at parse time
      if (hidden) continue;
      if (min && max && !isNaN(width)) {
        cols.push({ min, max, width, hidden: false });
      }
    }
    return cols;
  }

  private getColumnWidth(colWidths: XlsxColWidth[], colIndex: number): number {
    for (const cw of colWidths) {
      if (colIndex + 1 >= cw.min && colIndex + 1 <= cw.max) return cw.width;
    }
    return 0;
  }

  private isColHidden(colWidths: XlsxColWidth[], colIndex: number): boolean {
    for (const cw of colWidths) {
      if (colIndex + 1 >= cw.min && colIndex + 1 <= cw.max) return cw.hidden;
    }
    return false;
  }

  private parseXlsxMergeCells(sheetXml: string): XlsxMergeCell[] {
    const merges: XlsxMergeCell[] = [];
    const mergeRegex = /<mergeCell\s+ref="([^"]+)"/gi;
    let match;
    while ((match = mergeRegex.exec(sheetXml)) !== null) {
      const ref = match[1];
      const parts = ref.split(":");
      if (parts.length === 2) {
        const start = this.parseCellRef(parts[0]);
        const end = this.parseCellRef(parts[1]);
        if (start && end) {
          merges.push({ startCol: start.col, startRow: start.row, endCol: end.col, endRow: end.row });
        }
      }
    }
    return merges;
  }

  private parseCellRef(ref: string): { col: number; row: number } | null {
    const match = ref.match(/^([A-Z]+)(\d+)$/);
    if (!match) return null;
    let col = 0;
    for (let i = 0; i < match[1].length; i++) {
      col = col * 26 + match[1].charCodeAt(i) - 64;
    }
    return { col: col - 1, row: parseInt(match[2]) - 1 };
  }

  private buildMergeHiddenSet(merges: XlsxMergeCell[]): Set<string> {
    const hidden = new Set<string>();
    for (const m of merges) {
      for (let r = m.startRow; r <= m.endRow; r++) {
        for (let c = m.startCol; c <= m.endCol; c++) {
          if (r !== m.startRow || c !== m.startCol) hidden.add(`${r},${c}`);
        }
      }
    }
    return hidden;
  }

  private async renderPptx(buffer: ArrayBuffer, filename: string, container: HTMLElement): Promise<string> {
    container.classList.add("office-view-has-pptx");
    const wrapper = container.createDiv({ cls: "office-pptx" });

    const navBar = wrapper.createDiv({ cls: "pptx-nav" });
    const prevBtn = navBar.createEl("button", { cls: "office-view-btn", text: "◀" });
    const slideLabel = navBar.createSpan({ cls: "pptx-nav-label", text: "1 / ?" });
    const nextBtn = navBar.createEl("button", { cls: "office-view-btn", text: "▶" });

    const canvasWrapper = wrapper.createDiv({ cls: "pptx-canvas-wrapper" });
    const canvas = canvasWrapper.createEl("canvas", { cls: "pptx-canvas" });

    const viewer = new PPTXViewer({ canvas, backgroundColor: "#ffffff" });
    await viewer.loadFile(buffer);

    const totalSlides = viewer.getSlideCount();
    const update = () => {
      slideLabel.setText(`${viewer.getCurrentSlideIndex() + 1} / ${totalSlides}`);
    };
    update();

    const renderSlide = async () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvasWrapper.getBoundingClientRect();
      const w = Math.max(Math.round(rect.width * 0.95), 200);
      const h = Math.max(Math.round(rect.height * 0.95), 100);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      await viewer.render(canvas);
    };

    prevBtn.addEventListener("click", () => {
      if (viewer.getCurrentSlideIndex() > 0) {
        void viewer.previousSlide(canvas).then(() => update());
      }
    });

    nextBtn.addEventListener("click", () => {
      if (viewer.getCurrentSlideIndex() < totalSlides - 1) {
        void viewer.nextSlide(canvas).then(() => update());
      }
    });

    canvasWrapper.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") { prevBtn.click(); e.preventDefault(); }
      if (e.key === "ArrowRight") { nextBtn.click(); e.preventDefault(); }
    });
    canvasWrapper.tabIndex = 0;

    const ro = new ResizeObserver(() => { void renderSlide(); });
    ro.observe(canvasWrapper);

    await renderSlide();
    return filename;
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

    const wrapper = container.createDiv({ cls: "office-sql-wrapper" });
    const header = wrapper.createDiv({ cls: "office-sql-header" });
    header.createSpan({ cls: "office-sql-lang", text: "sql" });
    header.createSpan({ cls: "office-sql-filename", text: title });

    const pre = wrapper.createEl("pre", { cls: "office-sql" });
    this.buildSqlHighlight(content, pre);
    return title;
  }

  private buildSqlHighlight(text: string, parent: HTMLElement): void {
    const doc = parent.ownerDocument;
    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const combined = /(\b(?:SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|DROP|ALTER|INDEX|VIEW|JOIN|LEFT|RIGHT|INNER|OUTER|CROSS|ON|AND|OR|NOT|IN|EXISTS|BETWEEN|LIKE|IS|NULL|AS|DISTINCT|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|UNION|ALL|CASE|WHEN|THEN|ELSE|END|BEGIN|COMMIT|ROLLBACK|TRANSACTION|GRANT|REVOKE|PRIMARY|KEY|FOREIGN|REFERENCES|CASCADE|UNIQUE|CHECK|DEFAULT|IF|ELSE|WHILE|DECLARE|SET|PRINT|EXEC|EXECUTE|RETURN|FUNCTION|PROCEDURE|TRIGGER|WITH|RECURSIVE|COUNT|SUM|AVG|MIN|MAX|CAST|CONVERT|COALESCE|NULLIF)\b)|('[^']*')|(\b\d+(?:\.\d+)?\b)|(--.*)|(\/\*[\s\S]*?\*\/)/gi;

    const lines = escaped.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const lineSpan = parent.createSpan({ cls: "sql-line" });
      lineSpan.createSpan({ cls: "sql-line-num", text: String(lineNum) });
      const codeSpan = lineSpan.createSpan({ cls: "sql-line-code" });

      let lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = combined.exec(line)) !== null) {
        if (match.index > lastIndex) {
          codeSpan.appendChild(doc.createTextNode(line.substring(lastIndex, match.index)));
        }

        let className: string | undefined;
        if (match[1]) className = "sql-keyword";
        else if (match[2]) className = "sql-string";
        else if (match[3]) className = "sql-number";
        else if (match[4] || match[5]) className = "sql-comment";

        if (className) {
          codeSpan.createSpan({ cls: className, text: match[0] });
        } else {
          codeSpan.appendChild(doc.createTextNode(match[0]));
        }

        lastIndex = match.index + match[0].length;
      }

      if (lastIndex < line.length) {
        codeSpan.appendChild(doc.createTextNode(line.substring(lastIndex)));
      }
    }
  }

  // ============== XLSX helpers ==============

  private async parseXlsxStyles(zip: JSZip): Promise<XlsxStyles> {
    const styleFile = zip.files["xl/styles.xml"];
    if (!styleFile) return { fonts: [], fills: [], borders: [], cellXfs: [], numFmts: [] };

    const xml = await styleFile.async("string");

    const fonts: XlsxFont[] = [];
    const fontRegex = /<font[^>]*>([\s\S]*?)<\/font>/gi;
    let match;
    while ((match = fontRegex.exec(xml)) !== null) {
      const fb = match[1];
      const font: XlsxFont = {};
      if (/<b[>\s/]/.test(fb)) font.bold = true;
      if (/<i[>\s/]/.test(fb)) font.italic = true;
      if (/<u[>\s/]/.test(fb)) font.underline = true;
      if (/<strike[>\s/]/.test(fb)) font.strikethrough = true;
      const szMatch = fb.match(/<sz[^>]*val="([^"]+)"/);
      if (szMatch) font.size = parseFloat(szMatch[1]);
      const colorMatch = fb.match(/<color[^>]*rgb="([^"]+)"/);
      if (colorMatch) font.color = colorMatch[1];
      if (!font.color) {
        const indexedMatch = fb.match(/<color[^>]*indexed="([^"]+)"/);
        if (indexedMatch) font.color = this.indexedColor(parseInt(indexedMatch[1]));
      }
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
        const cMatch = bb.match(new RegExp(`<${side}[^>]*>.*?<color[^>]*rgb="([^"]+)"`));
        if (cMatch) border[`${side}Color` as keyof XlsxBorder] = cMatch[1];
      }
      borders.push(border);
    }

    const numFmts: XlsxNumFmt[] = [];
    const numFmtRegex = /<numFmt\s+numFmtId="(\d+)"\s+formatCode="([^"]+)"/gi;
    while ((match = numFmtRegex.exec(xml)) !== null) {
      numFmts.push({ numFmtId: parseInt(match[1]), formatCode: match[2] });
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
      const numFmtIdMatch = xb.match(/numFmtId="(\d+)"/);
      if (numFmtIdMatch) xf.numFmtId = parseInt(numFmtIdMatch[1]);
      if (/applyAlignment\s*=\s*"1"/.test(xb)) {
        xf.applyAlignment = true;
        const alMatch = xb.match(/<alignment([^>]*)>/);
        if (alMatch) {
          const alStr = alMatch[1];
          const al: XlsxAlignment = {};
          const hMatch = alStr.match(/horizontal="([^"]+)"/);
          if (hMatch) al.horizontal = hMatch[1];
          const vMatch = alStr.match(/vertical="([^"]+)"/);
          if (vMatch) al.vertical = vMatch[1];
          if (/wrapText\s*=\s*"1"/.test(alStr)) al.wrapText = true;
          const iMatch = alStr.match(/indent="(\d+)"/);
          if (iMatch) al.indent = parseInt(iMatch[1]);
          xf.alignment = al;
        }
      }
      cellXfs.push(xf);
    }

    return { fonts, fills, borders, cellXfs, numFmts };
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

  // Convert Excel column letter(s) to 0-based index (A=0, B=1, ..., Z=25, AA=26, ...)
  private colLetterToIndex(letter: string): number {
    let result = 0;
    for (let i = 0; i < letter.length; i++) {
      result = result * 26 + (letter.charCodeAt(i) - 64);
    }
    return result - 1;
  }

  private parseXlsxSheet(
    xml: string,
    sharedStrings: string[],
    styles: XlsxStyles
  ): XlsxCellData[][] {
    const rowsMap: Map<number, XlsxCellData[]> = new Map();
    const rowRegex = /<row[^>]*>([\s\S]*?)<\/row>/gi;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(xml)) !== null) {
      const rowXml = rowMatch[0]; // Use full match to parse row r attribute
      const rowRMatch = rowXml.match(/<row[^>]*r="(\d+)"/);
      const rowIdx = rowRMatch ? parseInt(rowRMatch[1]) - 1 : rowsMap.size; // 0-based row index

      if (!rowsMap.has(rowIdx)) {
        rowsMap.set(rowIdx, []);
      }
      const cells = rowsMap.get(rowIdx)!;

      const cellRegex = /<c[^>]*\/?>[\s\S]*?(?:<\/c>|(?=<c|$))/gi;
      let cellMatch;
      const rowInnerXml = rowMatch[1];

      while ((cellMatch = cellRegex.exec(rowInnerXml)) !== null) {
        const cellXml = cellMatch[0];
        const rMatch = cellXml.match(/<c[^>]*r="([A-Za-z]+)(\d+)"/);
        const tMatch = cellXml.match(/<c[^>]*t="([^"]+)"/);
        const sMatch = cellXml.match(/<c[^>]*s="(\d+)"/);
        const vMatch = cellXml.match(/<v[^>]*>([^<]*)<\/v>/);

        // Parse column index from cell reference (e.g. "C" -> 2)
        let colIdx = cells.length; // fallback: sequential
        if (rMatch) {
          colIdx = this.colLetterToIndex(rMatch[1]);
        } else {
          // No r attribute: place at next sequential position
          colIdx = cells.length;
        }

        const type = tMatch ? tMatch[1] : "n";
        const styleIdx = sMatch ? parseInt(sMatch[1]) : 0;
        const rawValue = vMatch ? vMatch[1] : "";

        let value: string;
        if (type === "s" && sharedStrings[parseInt(rawValue)]) {
          value = sharedStrings[parseInt(rawValue)];
        } else if (type === "n" || type === "e") {
          const xf = styles.cellXfs?.[styleIdx];
          const numFmtId = xf?.numFmtId ?? 0;
          value = this.formatNumber(rawValue, numFmtId, styles.numFmts);
        } else {
          value = rawValue;
        }

        const styleAttrs = this.buildXlsxCellStyle(styleIdx, styles);

        // Place cell at exact column index, filling gaps with empty cells
        while (cells.length <= colIdx) {
          cells.push({ value: "", style: {} });
        }
        cells[colIdx] = { value, style: styleAttrs };
      }
    }

    // Convert map to array, sorted by row index
    const maxRow = Math.max(...rowsMap.keys(), rowsMap.size - 1);
    const rows: XlsxCellData[][] = [];
    for (let i = 0; i <= maxRow; i++) {
      rows.push(rowsMap.get(i) || []);
    }

    // Align all rows to the same number of columns
    let maxCols = 0;
    for (const row of rows) {
      if (row.length > maxCols) maxCols = row.length;
    }
    for (const row of rows) {
      while (row.length < maxCols) {
        row.push({ value: "", style: {} });
      }
    }

    return rows;
  }

  private indexedColor(index: number): string | undefined {
    if (index === 0) return undefined;
    const palette: Record<number, string> = {
      1: "FFFFFF", 2: "FF0000", 3: "00FF00", 4: "0000FF",
      5: "FFFF00", 6: "FF00FF", 7: "00FFFF", 8: "000000",
      9: "FFFFFF", 10: "FF0000", 11: "00FF00", 12: "0000FF",
      13: "FFFF00", 14: "FF00FF", 15: "00FFFF", 16: "800000",
      17: "008000", 18: "000080", 19: "808000", 20: "800080",
      21: "008080", 22: "C0C0C0", 23: "808080", 24: "9999FF",
      25: "993366", 26: "FFFFCC", 27: "CCFFFF", 28: "660066",
      29: "FF8080", 30: "0066CC", 31: "CCCCFF", 32: "000080",
      33: "FF00FF", 34: "FFFF00", 35: "00FFFF", 36: "800080",
      37: "800000", 38: "008080", 39: "0000FF", 40: "666699",
      41: "808080", 42: "003366", 43: "339966", 44: "993300",
      45: "333399", 46: "333333", 47: "666666", 48: "FFFFFF",
      49: "000000", 50: "999999", 51: "993366", 52: "FFFFCC",
      53: "CCFFFF", 54: "660066", 55: "FF8080", 56: "0066CC",
      57: "CCCCFF", 58: "000080", 59: "FF00FF", 60: "FFFF00",
      61: "00FFFF", 62: "800080", 63: "800000",
    };
    return palette[index];
  }

  private isDateNumFmt(numFmtId: number, formatCode: string): boolean {
    // Check built-in date format IDs (Excel standard)
    if ([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47].includes(numFmtId)) return true;
    // Check custom format code for date/time patterns (must contain y AND m/d, or h:m pattern)
    if (formatCode) {
      // Must have explicit date markers: yyyy, yy, mm, dd, hh, etc.
      if (/[yY]/.test(formatCode) && (/[mM]/.test(formatCode) || /[dD]/.test(formatCode))) return true;
      if (/[hH]:[mM]/.test(formatCode)) return true;
    }
    return false;
  }

  private excelSerialToDate(serial: number): string {
    const date = new Date((serial - 25569) * 86400 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  private formatNumber(rawValue: string, numFmtId: number, numFmts: XlsxNumFmt[]): string {
    const num = parseFloat(rawValue);
    if (isNaN(num)) return rawValue;

    const custom = numFmts.find(n => n.numFmtId === numFmtId);
    const fmt = custom ? custom.formatCode : "";

    if (this.isDateNumFmt(numFmtId, fmt)) {
      // Only convert to date if number is a reasonable Excel date serial (1/1/1900 = 1,  > 30000 = ~2082)
      if (num >= 1000 && num < 100000) return this.excelSerialToDate(num);
    }

    if (fmt.includes("%")) return (num * 100).toFixed(1) + "%";

    return rawValue;
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
        if (font.underline) result["text-decoration"] = "underline";
        if (font.strikethrough) result["text-decoration"] = (result["text-decoration"] ? result["text-decoration"] + " " : "") + "line-through";
        // if (font.size) result["font-size"] = `${font.size}pt`;  // disabled
        // if (font.color) result["color"] = `#${font.color}`;  // disabled
      }
    }

    if (xf.fillId != null && xf.fillId > 1) {
      const fill = styles.fills?.[xf.fillId];
      if (fill?.fgColor) {
        // background-color disabled per requirements
        // result["background-color"] = `#${fill.fgColor}`;
      }
    }

    // Border styling disabled - CSS default border handles all cells uniformly
    // XLSX cell borders are not applied to avoid overriding CSS defaults

    if (xf.applyAlignment && xf.alignment) {
      const al = xf.alignment;
      if (al.horizontal) result["text-align"] = al.horizontal === "centerContinuous" ? "center" : al.horizontal;
      if (al.vertical) result["vertical-align"] = al.vertical;
      if (al.wrapText) result["white-space"] = "pre-wrap";
      if (al.indent && al.indent > 0) result["padding-left"] = `${al.indent * 12}px`;
    }

    return result;
  }

  // Map OOXML border style to CSS border style
  private mapBorderStyle(style: string): string {
    const map: Record<string, string> = {
      thin: "solid",
      medium: "solid",
      thick: "solid",
      double: "double",
      hair: "solid",
      dotted: "dotted",
      dashed: "dashed",
      mediumDashed: "dashed",
      dashDot: "dashed",
      mediumDashDot: "dashed",
      dashDotDot: "dashed",
      mediumDashDotDot: "dashed",
      slantDashDot: "dashed",
    };
    return map[style] || "solid";
  }
}


