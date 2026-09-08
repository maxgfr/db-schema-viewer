import { expect, it, vi } from "vitest";
import type { Diagram } from "db-schema-toolkit";
const calls = vi.hoisted(() => [] as Array<{ text: string; x: number; y: number; page: number }>);
vi.mock("@/lib/export/image-export", () => ({ exportFullDiagramToPng: async () => ({ dataUrl: "unused", width: 100, height: 100 }) }));
vi.mock("jspdf", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jspdf")>();
  return { default: function PDF(options: any) {
    const pdf = new actual.jsPDF(options);
    const original = pdf.text.bind(pdf);
    pdf.text = ((text: string, x: number, y: number, ...rest: any[]) => {
      calls.push({ text, x, y, page: pdf.getCurrentPageInfo().pageNumber });
      return original(text, x, y, ...rest);
    }) as typeof pdf.text;
    pdf.addImage = vi.fn().mockReturnValue(pdf);
    pdf.save = vi.fn();
    return pdf;
  } };
});
import { exportToPdf } from "@/lib/export/pdf-export";
it("TOC links match actual table pages across long tables and multiple TOC pages", async () => {
  const diagram: Diagram = { id: "d", name: "Large", databaseType: "postgresql", createdAt: "2026-01-01", relationships: [], tables: Array.from({ length: 70 }, (_, i) => ({
    id: `t${i}`, name: `table_${String(i).padStart(3, "0")}`, x: 0, y: 0, indexes: [], isView: false,
    fields: Array.from({ length: i % 2 ? 70 : 3 }, (_, j) => ({ id: `f${i}_${j}`, name: `field_${j}`, type: "TEXT", primaryKey: false, nullable: true, unique: false, isForeignKey: false })),
  })) };
  await exportToPdf(diagram);
  for (const table of diagram.tables) {
    const heading = calls.find((call) => call.text === table.name && call.x === 40)!;
    const tocEntry = calls.find((call) => call.text === table.name && call.x === 60)!;
    const number = calls.find((call) => call.page === tocEntry.page && call.y === tocEntry.y && call.x > 400 && /^\d+$/.test(call.text));
    expect(number?.text, table.name).toBe(String(heading.page));
  }
});
