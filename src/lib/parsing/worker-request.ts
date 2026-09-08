/** One worker per operation: terminating it cancels even synchronous parser work. */
export function workerRequest<T>(worker: Worker, payload: unknown, signal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const finish = () => { worker.terminate(); signal?.removeEventListener("abort", abort); };
    const abort = () => { finish(); reject(new DOMException("Cancelled", "AbortError")); };
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener("abort", abort, { once: true });
    worker.onmessage = (event: MessageEvent<{ result?: T; error?: string }>) => {
      finish();
      if (event.data.result !== undefined) resolve(event.data.result);
      else reject(new Error(event.data.error ?? "Import failed"));
    };
    worker.onerror = (event) => { finish(); reject(new Error(event.message || "Import failed")); };
    worker.onmessageerror = () => { finish(); reject(new Error("Invalid worker response")); };
    try { worker.postMessage(payload); } catch (error) { finish(); reject(error); }
  });
}
