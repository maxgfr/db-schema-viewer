import type { ParsedDumpTable } from "db-schema-toolkit/data";
import type { DataRequest } from "@/workers/data.worker";
import { workerRequest } from "./worker-request";
export function loadData(request: DataRequest, signal?: AbortSignal): Promise<ParsedDumpTable[]> {
  const worker = new Worker(new URL("../../workers/data.worker.ts", import.meta.url));
  return workerRequest(worker, request, signal);
}
