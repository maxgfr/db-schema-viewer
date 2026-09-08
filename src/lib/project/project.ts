import { z } from "zod";
import { Diagram } from "db-schema-toolkit";

export const AnnotationSchema = z.object({
  id: z.string(), text: z.string(), x: z.number(), y: z.number(),
  color: z.string().regex(/^[0-5]$/),
});
export const ViewSettingsSchema = z.object({
  erdNotation: z.enum(["crowsfoot", "uml", "chen"]).optional(),
  coloredEdges: z.boolean().optional(),
  viewport: z.object({ x: z.number(), y: z.number(), zoom: z.number().positive() }).optional(),
  filters: z.object({
    search: z.string().default(""),
    namespace: z.string().nullable().default(null),
    focusTableId: z.string().nullable().default(null),
  }).optional(),
});
export type SharedViewSettings = z.infer<typeof ViewSettingsSchema>;
export type NavigationFilters = NonNullable<SharedViewSettings["filters"]>;
export const DEFAULT_FILTERS: NavigationFilters = { search: "", namespace: null, focusTableId: null };

export const ProjectSchema = z.object({
  format: z.literal("db-schema-viewer"),
  version: z.literal(1),
  updatedAt: z.string().optional(),
  diagram: Diagram,
  annotations: z.array(AnnotationSchema).default([]),
  viewSettings: ViewSettingsSchema.default({}),
});
export type Project = z.infer<typeof ProjectSchema>;

export function createProject(diagram: Diagram): Project {
  return { format: "db-schema-viewer", version: 1, diagram, annotations: [], viewSettings: {} };
}

/** Explicit whitelist: credentials, chats and dump rows never enter project files. */
export function serializeProject(project: Project): string {
  return JSON.stringify(ProjectSchema.parse(project), null, 2);
}
export function parseProject(content: string): Project {
  return ProjectSchema.parse(JSON.parse(content));
}
