import test from "node:test";
import assert from "node:assert/strict";
import { StorageUploadError, storageUploadCopy, uploadToStorage } from "../src/lib/storage-upload";

const url =
  "https://storage.example/commerce-training-assets/7/test.pdf?X-Amz-Signature=fixture-secret%2B&value=a%20b+%2f";
const file = new File(["fictional worksheet"], "test.pdf", { type: "application/pdf" });
const signed = {
  url,
  method: "PUT",
  headers: { "content-type": "application/pdf; signed=exact", "x-amz-meta-purpose": "training" },
};

class FakeXHR {
  static instances: FakeXHR[] = [];
  withCredentials = true;
  method?: string;
  url?: string;
  body?: unknown;
  headers: [string, string][] = [];
  upload: {
    onprogress:
      ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | null;
  } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  status = 0;
  responseText = "";
  requestId: string | null = null;
  aborted = false;
  constructor() {
    FakeXHR.instances.push(this);
  }
  open(method: string, target: string) {
    this.method = method;
    this.url = target;
  }
  setRequestHeader(name: string, value: string) {
    this.headers.push([name, value]);
  }
  send(body: unknown) {
    this.body = body;
  }
  getResponseHeader(name: string) {
    return name.toLowerCase() === "x-amz-request-id" ? this.requestId : null;
  }
  abort() {
    this.aborted = true;
    this.onabort?.();
  }
  respond(status: number, body = "") {
    this.status = status;
    this.responseText = body;
    this.onload?.();
  }
}
async function withXHR(run: () => Promise<void>) {
  const original = globalThis.XMLHttpRequest;
  FakeXHR.instances = [];
  globalThis.XMLHttpRequest = FakeXHR as unknown as typeof XMLHttpRequest;
  try {
    await run();
  } finally {
    globalThis.XMLHttpRequest = original;
  }
}
const options = () => ({ contentType: file.type, signal: new AbortController().signal });

test("direct upload preserves the exact signed URL, method, headers and raw file, without portal credentials", () =>
  withXHR(async () => {
    const progress: number[] = [];
    const promise = uploadToStorage(signed, file, {
      ...options(),
      onProgress: (value) => progress.push(value),
    });
    const task = FakeXHR.instances[0];
    assert.equal(task.url, url);
    assert.equal(task.method, signed.method);
    assert.equal(task.body, file);
    assert.equal(task.withCredentials, false);
    assert.deepEqual(task.headers, Object.entries(signed.headers));
    assert.ok(!task.headers.some(([name]) => /authorization|device|cookie|csrf/i.test(name)));
    task.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 });
    assert.deepEqual(progress, [50]);
    task.respond(200);
    await promise;
    assert.equal(task.upload.onprogress, null);
  }));

test("only an absent content-type uses the requested MIME; a signed MIME is never replaced or duplicated", () =>
  withXHR(async () => {
    for (const name of ["Content-Type", "content-type", "CONTENT-TYPE"]) {
      const promise = uploadToStorage(
        { ...signed, headers: { [name]: "application/x-signed-exact" } },
        file,
        options(),
      );
      const task = FakeXHR.instances.at(-1)!;
      assert.deepEqual(task.headers, [[name, "application/x-signed-exact"]]);
      task.respond(204);
      await promise;
    }
    const promise = uploadToStorage({ ...signed, method: undefined, headers: {} }, file, options());
    const task = FakeXHR.instances.at(-1)!;
    assert.equal(task.method, "PUT");
    assert.deepEqual(task.headers, [["Content-Type", "application/pdf"]]);
    task.respond(200);
    await promise;
  }));

test("S3 signature failures expose only status, safe code and support ID, never canonical requests or credentials", () =>
  withXHR(async () => {
    const promise = uploadToStorage(signed, file, options());
    FakeXHR.instances[0].respond(
      403,
      `<Error><Code>SignatureDoesNotMatch</Code><RequestId>SAFE1234</RequestId><Message>${url}</Message><StringToSign>private-signing-data</StringToSign><SignatureProvided>fixture-secret</SignatureProvided></Error>`,
    );
    await assert.rejects(promise, (failure: unknown) => {
      assert.ok(failure instanceof StorageUploadError);
      assert.equal(failure.status, 403);
      assert.equal(failure.code, "SignatureDoesNotMatch");
      assert.equal(failure.requestId, "SAFE1234");
      assert.doesNotMatch(
        JSON.stringify(failure) + failure.message + failure.stack,
        /fixture-secret|private-signing-data|X-Amz|storage\.example/,
      );
      assert.match(storageUploadCopy(failure)[0], /could not verify/);
      assert.match(storageUploadCopy(failure)[1], /vérifier/);
      return true;
    });
  }));

test("access denial, expiry and unknown S3 failures remain distinct without retaining unsafe XML", () =>
  withXHR(async () => {
    for (const code of ["AccessDenied", "ExpiredToken", "RequestExpired", "UnknownPrivateValue"]) {
      const promise = uploadToStorage(signed, file, options());
      FakeXHR.instances
        .at(-1)!
        .respond(403, `<Error><Code>${code}</Code><Message>${url}</Message></Error>`);
      await assert.rejects(promise, (failure: unknown) => {
        assert.ok(failure instanceof StorageUploadError);
        assert.equal(failure.code, code === "UnknownPrivateValue" ? "UPLOAD_FAILED" : code);
        assert.doesNotMatch(JSON.stringify(failure), /fixture-secret|UnknownPrivateValue/);
        if (code === "ExpiredToken" || code === "RequestExpired")
          assert.match(storageUploadCopy(failure)[0], /expired/);
        return true;
      });
    }
  }));

test("a browser network/CORS failure is unresolved rather than inventing an S3 HTTP status", () =>
  withXHR(async () => {
    const promise = uploadToStorage(signed, file, options());
    FakeXHR.instances[0].onerror?.();
    await assert.rejects(promise, (failure: unknown) => {
      assert.ok(failure instanceof StorageUploadError);
      assert.equal(failure.code, "NETWORK_OR_CORS");
      assert.equal(failure.status, undefined);
      return true;
    });
  }));

test("cancel aborts the direct upload, removes handlers and never reports successful file persistence", () =>
  withXHR(async () => {
    const controller = new AbortController();
    const promise = uploadToStorage(signed, file, { ...options(), signal: controller.signal });
    controller.abort();
    await assert.rejects(promise, { name: "AbortError" });
    assert.equal(FakeXHR.instances[0].aborted, true);
    assert.equal(FakeXHR.instances[0].onload, null);
    await assert.rejects(
      uploadToStorage(signed, file, { ...options(), signal: controller.signal }),
      { name: "AbortError" },
    );
    assert.equal(FakeXHR.instances.length, 1);
  }));

test("invalid capabilities and authentication headers are rejected before sending any bytes", () =>
  withXHR(async () => {
    for (const capability of [
      { ...signed, url: "http://storage.example/upload" },
      { ...signed, url: url + "#changed" },
      { ...signed, method: "POST" },
      ...[
        "Authorization",
        "X-Device-Session",
        "X-Device-Id",
        "Cookie",
        "X-CSRF-Token",
        "X-API-Key",
      ].map((name) => ({ ...signed, headers: { [name]: "must-never-send" } })),
      { ...signed, headers: { "Content-Type": "application/pdf", "content-type": "text/plain" } },
    ]) {
      await assert.rejects(
        uploadToStorage(capability, file, options()),
        (failure: unknown) =>
          failure instanceof StorageUploadError && failure.code === "INVALID_UPLOAD_TARGET",
      );
    }
    assert.equal(FakeXHR.instances.length, 0);
  }));
