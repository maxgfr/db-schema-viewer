import type { Diagram } from "db-schema-toolkit";
import { createProject, parseProject, type Project } from "@/lib/project/project";
import { workerRequest } from "./worker-request";

export async function parseSchemaInput(content: string, fileName?: string, signal?: AbortSignal): Promise<Project> {
  signal?.throwIfAborted();
  if (fileName?.toLowerCase().endsWith(".json")) return parseProject(content);
  const worker = new Worker(new URL("../../workers/schema.worker.ts", import.meta.url));
  const diagram = await workerRequest<Diagram>(worker, { content, fileName }, signal);
  return createProject(diagram);
}
