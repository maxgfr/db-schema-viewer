/** Convert a snake_case, kebab-case, or space-separated name to camelCase. */
export function toCamelCase(name: string): string {
  const parts = name.split(/[_\-\s]+/);
  return parts
    .map((part, i) =>
      i === 0
        ? part.toLowerCase()
        : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
    )
    .join("");
}
