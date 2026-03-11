import { toPng, toSvg } from "html-to-image";

export interface ImageExportOptions {
  scale?: number;
  transparent?: boolean;
}

function getCanvasBackground(): string {
  const isDark = document.documentElement.classList.contains("dark");
  return isDark ? "#0f172a" : "#ffffff";
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
