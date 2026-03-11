import { toPng, toSvg } from "html-to-image";

export interface ImageExportOptions {
  scale?: number;
  transparent?: boolean;
}

export async function exportToPng(
  element: HTMLElement,
  options: ImageExportOptions = {}
): Promise<string> {
  const { scale = 2, transparent = false } = options;

  const dataUrl = await toPng(element, {
    pixelRatio: scale,
    backgroundColor: transparent ? undefined : "#0f172a",
  });

  return dataUrl;
}

export async function exportToSvg(
  element: HTMLElement,
  options: ImageExportOptions = {}
): Promise<string> {
  const { transparent = false } = options;

  const dataUrl = await toSvg(element, {
    backgroundColor: transparent ? undefined : "#0f172a",
  });

  return dataUrl;
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}
