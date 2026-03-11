import jsPDF from "jspdf";
import { exportToPng } from "./image-export";
import type { Diagram } from "@/lib/domain";
import { DATABASE_TYPE_LABELS } from "@/lib/domain";

export async function exportToPdf(
  element: HTMLElement,
  diagram: Diagram
): Promise<void> {
  const pngDataUrl = await exportToPng(element, { scale: 2 });

  const img = new Image();
  img.src = pngDataUrl;
  await new Promise<void>((resolve) => {
    img.onload = () => resolve();
  });

  const pdf = new jsPDF({
    orientation: img.width > img.height ? "landscape" : "portrait",
    unit: "pt",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 40;

  // Title
  pdf.setFontSize(18);
  pdf.text(diagram.name, margin, margin);

  // Subtitle
  pdf.setFontSize(10);
  pdf.setTextColor(128);
  pdf.text(
    `${DATABASE_TYPE_LABELS[diagram.databaseType]} | ${diagram.tables.length} tables | ${diagram.relationships.length} relationships | ${new Date().toLocaleDateString()}`,
    margin,
    margin + 20
  );

  // Diagram image
  const availableWidth = pageWidth - margin * 2;
  const availableHeight = pageHeight - margin * 2 - 40;
  const ratio = Math.min(availableWidth / img.width, availableHeight / img.height);

  pdf.addImage(
    pngDataUrl,
    "PNG",
    margin,
    margin + 30,
    img.width * ratio,
    img.height * ratio
  );

  pdf.save(`${diagram.name.replace(/\s+/g, "-").toLowerCase()}.pdf`);
}
