import { expect, it, vi } from "vitest";
import { workerRequest } from "@/lib/parsing/worker-request";
function fakeWorker() {
  return { postMessage: vi.fn(), terminate: vi.fn(), onmessage: null, onerror: null, onmessageerror: null } as unknown as Worker;
}
it("terminates an active worker and rejects cancellation", async () => {
  const worker = fakeWorker(), controller = new AbortController();
  const result = workerRequest(worker, { content: "large" }, controller.signal);
  controller.abort();
  await expect(result).rejects.toMatchObject({ name: "AbortError" });
  expect(worker.terminate).toHaveBeenCalledOnce();
});
it("returns a successful result and releases the worker", async () => {
  const worker = fakeWorker();
  const result = workerRequest(worker, {});
  worker.onmessage!.call(worker, new MessageEvent("message", { data: { result: [1, 2] } }));
  await expect(result).resolves.toEqual([1, 2]);
  expect(worker.terminate).toHaveBeenCalledOnce();
});
it("rejects parser errors without publishing a partial result", async () => {
  const worker = fakeWorker();
  const result = workerRequest(worker, {});
  worker.onmessage!.call(worker, new MessageEvent("message", { data: { error: "Invalid input" } }));
  await expect(result).rejects.toThrow("Invalid input");
});
