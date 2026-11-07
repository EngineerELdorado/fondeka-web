/** Compose cancellation and a deadline without newer AbortSignal static APIs. */
export async function withRequestDeadline<T>(
  timeoutMs: number,
  parent: AbortSignal | null | undefined,
  request: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort(parent?.reason);
  if (parent?.aborted) cancel();
  else parent?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(
    () => controller.abort(new DOMException("The request timed out.", "TimeoutError")),
    timeoutMs,
  );
  try {
    if (controller.signal.aborted) throw controller.signal.reason;
    return await request(controller.signal);
  } finally {
    clearTimeout(timer);
    parent?.removeEventListener("abort", cancel);
  }
}
