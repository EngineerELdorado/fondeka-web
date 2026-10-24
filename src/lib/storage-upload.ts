export type PresignedStorageUpload = {
  url: string;
  method?: string;
  headers: Record<string, string>;
};

const s3Codes = new Set([
  "AccessDenied",
  "AccessForbidden",
  "SignatureDoesNotMatch",
  "ExpiredToken",
  "RequestExpired",
  "InvalidToken",
  "InvalidAccessKeyId",
  "RequestTimeTooSkewed",
  "AuthorizationQueryParametersError",
  "AuthorizationHeaderMalformed",
]);

export class StorageUploadError extends Error {
  constructor(
    readonly code: string,
    readonly status?: number,
    readonly requestId?: string,
  ) {
    // Never retain a URL, response body, canonical request or signature in an Error.
    super("Storage upload failed.");
    this.name = "StorageUploadError";
  }
}

function uploadFailure(status: number, body: string, headerId?: string | null) {
  const snippet = body.slice(0, 16_384);
  const code = /<Code>([A-Za-z0-9]{1,80})<\/Code>/.exec(snippet)?.[1];
  const xmlId = /<RequestId>([A-Za-z0-9+/=_-]{1,128})<\/RequestId>/.exec(snippet)?.[1];
  const requestId = headerId && /^[A-Za-z0-9+/=_-]{1,128}$/.test(headerId) ? headerId : xmlId;
  return new StorageUploadError(
    code && s3Codes.has(code) ? code : "UPLOAD_FAILED",
    status,
    requestId,
  );
}

/** A separate, unauthenticated transport: send the original bytes and signed capability unchanged. */
export function uploadToStorage(
  signed: PresignedStorageUpload,
  file: File,
  options: {
    contentType: string;
    signal: AbortSignal;
    onProgress?: (percentage: number) => void;
  },
) {
  return new Promise<void>((resolve, reject) => {
    if (options.signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const method = signed.method || "PUT";
    let cleanupOnFailure: (() => void) | undefined;
    try {
      // Parse only for validation. Pass the original string to XHR; never rebuild the URL.
      const target = new URL(signed.url);
      if (
        target.protocol !== "https:" ||
        target.username ||
        target.password ||
        target.hash ||
        method !== "PUT"
      )
        throw new StorageUploadError("INVALID_UPLOAD_TARGET");
      if (!signed.headers || typeof signed.headers !== "object" || Array.isArray(signed.headers))
        throw new StorageUploadError("INVALID_UPLOAD_TARGET");
      const headers = Object.entries(signed.headers);
      const names = new Set<string>();
      for (const [name, value] of headers) {
        const normalized = name.toLowerCase();
        if (
          typeof value !== "string" ||
          names.has(normalized) ||
          /^(authorization|proxy-authorization|cookie|cookie2|x-device-.*|x-csrf-.*|x-xsrf-.*|x-api-key)$/i.test(
            name,
          )
        )
          throw new StorageUploadError("INVALID_UPLOAD_TARGET");
        names.add(normalized);
      }
      const task = new XMLHttpRequest();
      let settled = false;
      const finish = (failure?: Error) => {
        if (settled) return;
        settled = true;
        options.signal.removeEventListener("abort", cancel);
        task.onload = task.onerror = task.onabort = null;
        task.upload.onprogress = null;
        if (failure) reject(failure);
        else resolve();
      };
      const cancel = () => {
        task.abort();
        finish(new DOMException("Aborted", "AbortError"));
      };
      cleanupOnFailure = () => finish(new StorageUploadError("INVALID_UPLOAD_TARGET"));
      task.open(method, signed.url);
      task.withCredentials = false;
      for (const [name, value] of headers) task.setRequestHeader(name, value);
      if (!names.has("content-type")) task.setRequestHeader("Content-Type", options.contentType);
      task.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0)
          options.onProgress?.(Math.round((event.loaded / event.total) * 100));
      };
      task.onload = () => {
        if (task.status >= 200 && task.status < 300) finish();
        else if (!task.status) finish(new StorageUploadError("NETWORK_OR_CORS"));
        else
          finish(
            uploadFailure(
              task.status,
              task.responseText,
              task.getResponseHeader("x-amz-request-id"),
            ),
          );
      };
      // Browsers deliberately hide CORS-denied response details. Do not infer a payment/API denial.
      task.onerror = () => finish(new StorageUploadError("NETWORK_OR_CORS"));
      task.onabort = () => finish(new DOMException("Aborted", "AbortError"));
      options.signal.addEventListener("abort", cancel, { once: true });
      if (options.signal.aborted) cancel();
      else task.send(file);
    } catch {
      if (cleanupOnFailure) cleanupOnFailure();
      else reject(new StorageUploadError("INVALID_UPLOAD_TARGET"));
    }
  });
}

export function storageUploadCopy(error: StorageUploadError): [string, string] {
  if (["ExpiredToken", "RequestExpired", "InvalidToken"].includes(error.code))
    return [
      "The upload authorization expired. Choose the file again to start a fresh upload.",
      "L’autorisation d’envoi a expiré. Choisissez à nouveau le fichier pour relancer l’envoi.",
    ];
  if (error.code === "SignatureDoesNotMatch")
    return [
      "Storage could not verify this upload. Try again; if it continues, contact support.",
      "Le stockage n’a pas pu vérifier cet envoi. Réessayez ; si le problème persiste, contactez l’assistance.",
    ];
  if (error.code === "AccessDenied" || error.status === 403)
    return [
      "Storage refused this upload. Try again or contact support with the details below.",
      "Le stockage a refusé cet envoi. Réessayez ou contactez l’assistance avec les détails ci-dessous.",
    ];
  if (error.code === "NETWORK_OR_CORS")
    return [
      "The browser could not complete the upload. Check your connection and retry. If this continues, contact support.",
      "Le navigateur n’a pas pu terminer l’envoi. Vérifiez votre connexion et réessayez. Si le problème persiste, contactez l’assistance.",
    ];
  return [
    "Upload failed. Choose the file again to retry, or contact support.",
    "Échec de l’envoi. Choisissez à nouveau le fichier pour réessayer ou contactez l’assistance.",
  ];
}
