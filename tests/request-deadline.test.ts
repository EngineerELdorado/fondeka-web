import test from "node:test";
import assert from "node:assert/strict";
import { withRequestDeadline } from "../src/lib/request-deadline";

test("completion releases its deadline and parent listener", async () => {
  const parent = new AbortController();
  let child!: AbortSignal;
  assert.equal(
    await withRequestDeadline(5, parent.signal, async (signal) => {
      child = signal;
      return "done";
    }),
    "done",
  );
  parent.abort();
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(child.aborted, false);
});
test("cancellation and its reason reach an in-flight request", async () => {
  const parent = new AbortController();
  const reason = new Error("View closed");
  const request = withRequestDeadline(
    1000,
    parent.signal,
    (signal) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      }),
  );
  parent.abort(reason);
  await assert.rejects(request, (error) => error === reason);
});
test("an already cancelled view sends no request", async () => {
  const parent = new AbortController();
  parent.abort(new Error("Already closed"));
  let called = false;
  await assert.rejects(
    withRequestDeadline(1000, parent.signal, async () => {
      called = true;
    }),
    /Already closed/,
  );
  assert.equal(called, false);
});
test("the deadline covers response processing and expires with a timeout reason", async () => {
  const parent = new AbortController();
  await assert.rejects(
    withRequestDeadline(
      5,
      parent.signal,
      (signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        }),
    ),
    { name: "TimeoutError" },
  );
  assert.equal(parent.signal.aborted, false);
});
test("a failed request releases its deadline and cancellation listener", async () => {
  const parent = new AbortController();
  let child!: AbortSignal;
  await assert.rejects(
    withRequestDeadline(5, parent.signal, async (signal) => {
      child = signal;
      throw new Error("Network failure");
    }),
    /Network failure/,
  );
  parent.abort();
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(child.aborted, false);
});
