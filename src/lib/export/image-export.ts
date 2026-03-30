import { toPng, toSvg } from "html-to-image";

export interface ImageExportOptions {
  scale?: number;
  transparent?: boolean;
}

function getCanvasBackground(): string {
  const isDark = document.documentElement.classList.contains("dark");
  return isDark ? "#0f172a" : "#ffffff";
}

/** Compute the bounding box of all React Flow nodes in flow coordinates. */
function getNodesBounds(viewport: HTMLElement): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  const nodeElements = viewport.querySelectorAll(".react-flow__node");
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const el of nodeElements) {
    const htmlEl = el as HTMLElement;
    const style = htmlEl.style.transform;
    const match = style.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/);
    if (!match) continue;
    const x = parseFloat(match[1]!);
    const y = parseFloat(match[2]!);
    const w = htmlEl.offsetWidth;
    const h = htmlEl.offsetHeight;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  }

  return { minX, minY, maxX, maxY };
}

export async function exportToPng(
  element: HTMLElement,
  options: ImageExportOptions = {}
): Promise<string> {
  const { scale = 2, transparent = false } = options;

  const dataUrl = await toPng(element, {
    pixelRatio: scale,
    backgroundColor: transparent ? undefined : getCanvasBackground(),
  });

  return dataUrl;
}

/**
 * Capture the full React Flow diagram regardless of current viewport/zoom.
 * Computes the bounding box of all nodes and renders the entire diagram.
 */
export async function exportFullDiagramToPng(
  options: ImageExportOptions = {}
): Promise<{ dataUrl: string; width: number; height: number }> {
  const { scale = 2, transparent = false } = options;

  const viewport = document.querySelector(
    ".react-flow__viewport"
  ) as HTMLElement;
  if (!viewport) throw new Error("Canvas not found");

  const bounds = getNodesBounds(viewport);
  if (!isFinite(bounds.minX)) throw new Error("No nodes found in diagram");

  const padding = 60;
  const contentWidth = Math.ceil(bounds.maxX - bounds.minX + padding * 2);
  const contentHeight = Math.ceil(bounds.maxY - bounds.minY + padding * 2);

  const dataUrl = await toPng(viewport, {
    width: contentWidth,
    height: contentHeight,
    pixelRatio: scale,
    backgroundColor: transparent ? undefined : getCanvasBackground(),
    style: {
      transform: `translate(${-bounds.minX + padding}px, ${-bounds.minY + padding}px)`,
    },
  });

  return {
    dataUrl,
    width: contentWidth * scale,
    height: contentHeight * scale,
  };
}

export async function exportToSvg(
  element: HTMLElement,
  options: ImageExportOptions = {}
): Promise<string> {
  const { transparent = false } = options;

  const dataUrl = await toSvg(element, {
    backgroundColor: transparent ? undefined : getCanvasBackground(),
  });

  return dataUrl;
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

export function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = filename;
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
