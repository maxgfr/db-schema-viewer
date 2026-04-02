import type { jsPDF as JsPDFType } from "jspdf";
import { exportFullDiagramToPng } from "./image-export";
import type { Diagram, DBTable, DBField } from "db-schema-toolkit";
import { DATABASE_TYPE_LABELS } from "db-schema-toolkit";
import { t } from "@/lib/i18n/context";

async function createPDF(options: { orientation: string; unit: string; format: string }): Promise<JsPDFType> {
  const { default: jsPDF } = await import("jspdf");
  return new jsPDF(options as unknown as ConstructorParameters<typeof jsPDF>[0]);
}

const MARGIN = 40;
const FOOTER_HEIGHT = 30;
const LINE_HEIGHT = 16;
const HEADING_SIZE = 18;
const SUBHEADING_SIZE = 14;
const BODY_SIZE = 9;
const SMALL_SIZE = 8;

// Colors
const COLOR_PRIMARY = [15, 23, 42] as const; // slate-900
const COLOR_SECONDARY = [100, 116, 139] as const; // slate-500
const COLOR_AMBER = [180, 83, 9] as const; // amber-700
const COLOR_BLUE = [29, 78, 216] as const; // blue-700
const COLOR_BORDER = [203, 213, 225] as const; // slate-300
const COLOR_HEADER_BG = [241, 245, 249] as const; // slate-100
type RGB = readonly [number, number, number];

function setTextColor(pdf: JsPDFType, color: RGB) {
  pdf.setTextColor(color[0], color[1], color[2]);
}

function setDrawColor(pdf: JsPDFType, color: RGB) {
  pdf.setDrawColor(color[0], color[1], color[2]);
}

function setFillColor(pdf: JsPDFType, color: RGB) {
  pdf.setFillColor(color[0], color[1], color[2]);
}

function getPageWidth(pdf: JsPDFType): number {
  return pdf.internal.pageSize.getWidth();
}

function getPageHeight(pdf: JsPDFType): number {
  return pdf.internal.pageSize.getHeight();
}

function getUsableHeight(pdf: JsPDFType): number {
  return getPageHeight(pdf) - MARGIN - FOOTER_HEIGHT;
}

function addFooter(pdf: JsPDFType, pageNumber: number, totalPages: number, diagramName: string) {
  const pageWidth = getPageWidth(pdf);
  const pageHeight = getPageHeight(pdf);
  const y = pageHeight - 20;

  setDrawColor(pdf, COLOR_BORDER);
  pdf.setLineWidth(0.5);
  pdf.line(MARGIN, y - 8, pageWidth - MARGIN, y - 8);

  pdf.setFontSize(SMALL_SIZE);
  setTextColor(pdf, COLOR_SECONDARY);
  pdf.text(diagramName, MARGIN, y);
  pdf.text(t("exportFile.pageOf", { current: pageNumber, total: totalPages }), pageWidth - MARGIN, y, { align: "right" });
}

function addPageWithFooterPlaceholder(pdf: JsPDFType) {
  pdf.addPage();
}

// ── Title Page ──────────────────────────────────────────────────────────

function renderTitlePage(
  pdf: JsPDFType,
  diagram: Diagram
) {
  const pageWidth = getPageWidth(pdf);
  const pageHeight = getPageHeight(pdf);
  const centerX = pageWidth / 2;

  // Title
  pdf.setFontSize(28);
  pdf.setFont("helvetica", "bold");
  setTextColor(pdf, COLOR_PRIMARY);
  pdf.text(diagram.name, centerX, pageHeight * 0.3, { align: "center" });

  // Divider
  setDrawColor(pdf, COLOR_BORDER);
  pdf.setLineWidth(1);
  pdf.line(centerX - 80, pageHeight * 0.33, centerX + 80, pageHeight * 0.33);

  // Database type
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "normal");
  setTextColor(pdf, COLOR_SECONDARY);
  pdf.text(
    DATABASE_TYPE_LABELS[diagram.databaseType],
    centerX,
    pageHeight * 0.38,
    { align: "center" }
  );

  // Stats
  const statsY = pageHeight * 0.48;
  pdf.setFontSize(11);
  setTextColor(pdf, COLOR_PRIMARY);

  const stats = [
    `${t("exportFile.tables")} ${diagram.tables.length}`,
    `${t("exportFile.relationships")} ${diagram.relationships.length}`,
    `${t("exportFile.generated")} ${new Date().toLocaleDateString()}`,
  ];

  stats.forEach((stat, i) => {
    pdf.text(stat, centerX, statsY + i * 22, { align: "center" });
  });
}

// ── Table of Contents ───────────────────────────────────────────────────

function renderTableOfContents(
  pdf: JsPDFType,
  diagram: Diagram,
  tablePageMap: Map<string, number>
) {
  pdf.setFontSize(HEADING_SIZE);
  pdf.setFont("helvetica", "bold");
  setTextColor(pdf, COLOR_PRIMARY);
  pdf.text(t("exportFile.tableOfContents"), MARGIN, MARGIN + 20);

  const pageWidth = getPageWidth(pdf);
  let y = MARGIN + 50;

  // Diagram page entry
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "normal");
  setTextColor(pdf, COLOR_PRIMARY);
  pdf.text(t("exportFile.schemaDiagram"), MARGIN + 10, y);
  pdf.text("3", pageWidth - MARGIN, y, { align: "right" });

  // Dotted line
  setDrawColor(pdf, COLOR_BORDER);
  pdf.setLineDashPattern([1, 2], 0);
  const textWidth = pdf.getTextWidth(t("exportFile.schemaDiagram"));
  pdf.line(MARGIN + 14 + textWidth, y - 2, pageWidth - MARGIN - 15, y - 2);
  pdf.setLineDashPattern([], 0);

  y += LINE_HEIGHT + 4;

  // Section header for tables
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  setTextColor(pdf, COLOR_SECONDARY);
  pdf.text(t("exportFile.tablesSection"), MARGIN + 10, y);
  y += LINE_HEIGHT + 2;

  // Table entries
  const sortedTables = [...diagram.tables].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  for (const table of sortedTables) {
    if (y > getUsableHeight(pdf)) {
      addPageWithFooterPlaceholder(pdf);
      y = MARGIN + 20;
    }

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    setTextColor(pdf, COLOR_PRIMARY);

    const label = table.isView ? `${table.name}${t("exportFile.viewLabel")}` : table.name;
    pdf.text(label, MARGIN + 20, y);

    const pageNum = tablePageMap.get(table.id);
    if (pageNum !== undefined) {
      pdf.text(String(pageNum), pageWidth - MARGIN, y, { align: "right" });

      // Dotted line
      setDrawColor(pdf, COLOR_BORDER);
      pdf.setLineDashPattern([1, 2], 0);
      const tw = pdf.getTextWidth(label);
      pdf.line(MARGIN + 24 + tw, y - 2, pageWidth - MARGIN - 15, y - 2);
      pdf.setLineDashPattern([], 0);
    }

    y += LINE_HEIGHT;
  }
}

// ── Diagram Image Page ──────────────────────────────────────────────────

function renderDiagramPage(
  pdf: JsPDFType,
  pngDataUrl: string,
  imgWidth: number,
  imgHeight: number,
  landscape: boolean
) {
  pdf.addPage("a4", landscape ? "landscape" : "portrait");

  pdf.setFontSize(SUBHEADING_SIZE);
  pdf.setFont("helvetica", "bold");
  setTextColor(pdf, COLOR_PRIMARY);
  pdf.text(t("exportFile.schemaDiagram"), MARGIN, MARGIN + 20);

  const availableWidth = getPageWidth(pdf) - MARGIN * 2;
  const availableHeight = getUsableHeight(pdf) - MARGIN - 30;
  const ratio = Math.min(availableWidth / imgWidth, availableHeight / imgHeight);

  const renderedWidth = imgWidth * ratio;
  const renderedHeight = imgHeight * ratio;

  // Center the image horizontally
  const offsetX = MARGIN + (availableWidth - renderedWidth) / 2;

  pdf.addImage(
    pngDataUrl,
    "PNG",
    offsetX,
    MARGIN + 35,
    renderedWidth,
    renderedHeight
  );
}

// ── Table Detail Pages ──────────────────────────────────────────────────

function renderFieldsTable(
  pdf: JsPDFType,
  fields: DBField[],
  startY: number,
  _diagram: Diagram
): number {
  const pageWidth = getPageWidth(pdf);
  const tableWidth = pageWidth - MARGIN * 2;

  // Column definitions
  const cols = [
    { label: t("exportFile.column"), width: tableWidth * 0.22, align: "left" as const },
    { label: t("exportFile.type"), width: tableWidth * 0.20, align: "left" as const },
    { label: t("exportFile.pk"), width: tableWidth * 0.06, align: "center" as const },
    { label: t("exportFile.fk"), width: tableWidth * 0.06, align: "center" as const },
    { label: t("exportFile.nullable"), width: tableWidth * 0.08, align: "center" as const },
    { label: t("exportFile.unique"), width: tableWidth * 0.08, align: "center" as const },
    { label: t("exportFile.default"), width: tableWidth * 0.15, align: "left" as const },
    { label: t("exportFile.references"), width: tableWidth * 0.15, align: "left" as const },
  ];

  const rowHeight = 14;
  let y = startY;

  // Header row
  setFillColor(pdf, COLOR_HEADER_BG);
  pdf.rect(MARGIN, y - 9, tableWidth, rowHeight, "F");
  setDrawColor(pdf, COLOR_BORDER);
  pdf.setLineWidth(0.5);
  pdf.rect(MARGIN, y - 9, tableWidth, rowHeight, "S");

  pdf.setFontSize(SMALL_SIZE);
  pdf.setFont("helvetica", "bold");
  setTextColor(pdf, COLOR_PRIMARY);

  let colX = MARGIN + 4;
  for (const col of cols) {
    if (col.align === "center") {
      pdf.text(col.label, colX + col.width / 2, y - 1, { align: "center" });
    } else {
      pdf.text(col.label, colX, y - 1);
    }
    colX += col.width;
  }

  y += rowHeight;

  // Data rows
  for (const field of fields) {
    if (y > getUsableHeight(pdf)) {
      addPageWithFooterPlaceholder(pdf);
      y = MARGIN + 20;
    }

    // Row background (alternate)
    setDrawColor(pdf, COLOR_BORDER);
    pdf.setLineWidth(0.3);
    pdf.line(MARGIN, y + 3, MARGIN + tableWidth, y + 3);

    pdf.setFontSize(BODY_SIZE);
    colX = MARGIN + 4;

    const isPK = field.primaryKey ?? false;
    const isFK = field.isForeignKey ?? false;
    const isNullable = field.nullable ?? true;
    const isUnique = field.unique ?? false;

    // Field name with color coding
    if (isPK) {
      pdf.setFont("helvetica", "bold");
      setTextColor(pdf, COLOR_AMBER);
    } else if (isFK) {
      pdf.setFont("helvetica", "bold");
      setTextColor(pdf, COLOR_BLUE);
    } else {
      pdf.setFont("helvetica", "normal");
      setTextColor(pdf, COLOR_PRIMARY);
    }
    pdf.text(truncateText(pdf, field.name, cols[0]!.width - 8), colX, y);
    colX += cols[0]!.width;

    // Type
    pdf.setFont("helvetica", "normal");
    setTextColor(pdf, COLOR_SECONDARY);
    pdf.text(truncateText(pdf, field.type, cols[1]!.width - 8), colX, y);
    colX += cols[1]!.width;

    // PK
    setTextColor(pdf, COLOR_PRIMARY);
    pdf.text(isPK ? "Y" : "", colX + cols[2]!.width / 2, y, { align: "center" });
    colX += cols[2]!.width;

    // FK
    pdf.text(isFK ? "Y" : "", colX + cols[3]!.width / 2, y, { align: "center" });
    colX += cols[3]!.width;

    // Nullable
    pdf.text(isNullable ? "Y" : "N", colX + cols[4]!.width / 2, y, { align: "center" });
    colX += cols[4]!.width;

    // Unique
    pdf.text(isUnique ? "Y" : "", colX + cols[5]!.width / 2, y, { align: "center" });
    colX += cols[5]!.width;

    // Default
    setTextColor(pdf, COLOR_SECONDARY);
    const defaultVal = field.default ?? "";
    pdf.text(truncateText(pdf, defaultVal, cols[6]!.width - 8), colX, y);
    colX += cols[6]!.width;

    // References
    if (field.references) {
      setTextColor(pdf, COLOR_BLUE);
      const refText = `${field.references.table}.${field.references.field}`;
      pdf.text(truncateText(pdf, refText, cols[7]!.width - 8), colX, y);
    }

    y += rowHeight;
  }

  return y;
}

function truncateText(pdf: JsPDFType, text: string, maxWidth: number): string {
  if (pdf.getTextWidth(text) <= maxWidth) return text;
  while (text.length > 0 && pdf.getTextWidth(text + "...") > maxWidth) {
    text = text.slice(0, -1);
  }
  return text + "...";
}

function renderTableDetail(
  pdf: JsPDFType,
  table: DBTable,
  currentY: number,
  diagram: Diagram
): { endY: number; startedNewPage: boolean } {
  // Estimate the height needed
  const headerHeight = 30;
  const minRequired = headerHeight + 14 * 3; // At least header + 2 field rows

  let y = currentY;
  let startedNewPage = false;

  // If we don't have room for even the minimum, start a new page
  if (y + minRequired > getUsableHeight(pdf)) {
    addPageWithFooterPlaceholder(pdf);
    y = MARGIN + 20;
    startedNewPage = true;
  }

  // Table heading
  pdf.setFontSize(SUBHEADING_SIZE);
  pdf.setFont("helvetica", "bold");
  setTextColor(pdf, COLOR_PRIMARY);

  const tableLabel = table.isView ? `${table.name}${t("exportFile.viewLabel")}` : table.name;
  pdf.text(tableLabel, MARGIN, y);

  if (table.comment) {
    y += 14;
    pdf.setFontSize(BODY_SIZE);
    pdf.setFont("helvetica", "italic");
    setTextColor(pdf, COLOR_SECONDARY);
    pdf.text(table.comment, MARGIN, y);
  }

  y += 18;

  // Fields table
  y = renderFieldsTable(pdf, table.fields, y, diagram);

  // Indexes
  if (table.indexes.length > 0) {
    y += 12;

    if (y + LINE_HEIGHT * 2 > getUsableHeight(pdf)) {
      addPageWithFooterPlaceholder(pdf);
      y = MARGIN + 20;
    }

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    setTextColor(pdf, COLOR_PRIMARY);
    pdf.text(t("exportFile.indexes"), MARGIN, y);
    y += LINE_HEIGHT;

    for (const index of table.indexes) {
      if (y > getUsableHeight(pdf)) {
        addPageWithFooterPlaceholder(pdf);
        y = MARGIN + 20;
      }

      pdf.setFontSize(BODY_SIZE);
      pdf.setFont("helvetica", "normal");
      setTextColor(pdf, COLOR_SECONDARY);

      const uniqueLabel = index.unique ? t("exportFile.uniqueLabel") : "";
      const indexText = `${index.name}: (${index.columns.join(", ")})${uniqueLabel}`;
      pdf.text(indexText, MARGIN + 10, y);
      y += LINE_HEIGHT;
    }
  }

  return { endY: y + 16, startedNewPage };
}

// ── Main Export ─────────────────────────────────────────────────────────

export async function exportToPdf(
  diagram: Diagram
): Promise<void> {
  const { dataUrl: pngDataUrl, width: imgWidth, height: imgHeight } =
    await exportFullDiagramToPng({ scale: 2 });

  // Use landscape for the diagram page if the image is wider than tall
  const diagramIsLandscape = imgWidth > imgHeight;

  const pdf = await createPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  });

  // ── Page 1: Title ──
  renderTitlePage(pdf, diagram);

  // We need to first render all table detail pages to know page numbers,
  // then come back and render the TOC. We'll do a two-pass approach:
  // Pass 1: render table details into a temporary PDF to calculate page assignments.
  // Pass 2: render everything into the real PDF.

  // Since jsPDF doesn't support easy page re-ordering, we'll calculate
  // page numbers by simulating the layout first.

  const tablePageMap = new Map<string, number>();
  const sortedTables = [...diagram.tables].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  // Simulate table detail layout to determine page numbers
  // Page 1 = title, Page 2 = TOC, Page 3 = diagram, Page 4+ = tables
  let simPageNumber = 4;
  let simY = MARGIN + 20;

  const simPdf = await createPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  simPdf.setFontSize(BODY_SIZE);

  for (const table of sortedTables) {
    const headerHeight = 30 + (table.comment ? 14 : 0);
    const minRequired = headerHeight + 14 * 3;

    if (simY + minRequired > getUsableHeight(simPdf)) {
      simPageNumber++;
      simY = MARGIN + 20;
    }

    tablePageMap.set(table.id, simPageNumber);

    // Estimate how much space this table takes
    const fieldsHeight = (table.fields.length + 1) * 14;
    const indexesHeight = table.indexes.length > 0 ? (table.indexes.length + 1) * LINE_HEIGHT + 22 : 0;
    const totalHeight = headerHeight + 18 + fieldsHeight + indexesHeight + 16;

    simY += totalHeight;

    // Check if fields would overflow to next pages
    while (simY > getUsableHeight(simPdf)) {
      simY -= (getUsableHeight(simPdf) - MARGIN - 20);
      simPageNumber++;
    }
  }

  // ── Page 2: Table of Contents ──
  addPageWithFooterPlaceholder(pdf);
  renderTableOfContents(pdf, diagram, tablePageMap);

  // ── Page 3: Diagram Image (landscape if diagram is wide) ──
  renderDiagramPage(pdf, pngDataUrl, imgWidth, imgHeight, diagramIsLandscape);

  // ── Page 4+: Table Details (back to portrait) ──
  pdf.addPage("a4", "portrait");
  let currentY = MARGIN + 20;

  // Section title on first detail page
  pdf.setFontSize(HEADING_SIZE);
  pdf.setFont("helvetica", "bold");
  setTextColor(pdf, COLOR_PRIMARY);
  pdf.text(t("exportFile.tableDetails"), MARGIN, currentY);
  currentY += 30;

  for (const table of sortedTables) {
    const result = renderTableDetail(pdf, table, currentY, diagram);
    currentY = result.endY;
  }

  // ── Add footers to all pages ──
  const finalTotalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= finalTotalPages; i++) {
    pdf.setPage(i);
    addFooter(pdf, i, finalTotalPages, diagram.name);
  }

  pdf.save(`${diagram.name.replace(/\s+/g, "-").toLowerCase()}.pdf`);
}
