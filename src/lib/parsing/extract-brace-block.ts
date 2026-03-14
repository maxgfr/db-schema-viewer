/**
 * Extract the content between a matched pair of braces starting at startIdx.
 * Returns the inner content (excluding the braces) or null if unbalanced.
 */
export function extractBraceBlock(
  content: string,
  startIdx: number,
): string | null {
  let depth = 0;
  for (let i = startIdx; i < content.length; i++) {
    if (content[i] === "{") depth++;
    else if (content[i] === "}") {
      depth--;
      if (depth === 0) return content.substring(startIdx + 1, i);
    }
  }
  return null;
}
