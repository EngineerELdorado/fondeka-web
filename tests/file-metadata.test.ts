import { test } from "node:test";
import assert from "node:assert/strict";
import { fileFormat, fileSizeLabel } from "../src/lib/file-metadata";

test("uploaded files show an intelligible format without displaying private storage identifiers", () => {
  assert.equal(fileFormat({ fileName: "My lesson.PDF" }), "PDF");
  assert.equal(fileFormat({ contentType: "application/pdf; charset=utf-8" }), "PDF");
  assert.equal(
    fileFormat({
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
    "DOCX",
  );
  assert.equal(fileFormat({}, "commerce-training-assets/7/secret-id.epub"), "EPUB");
  assert.equal(fileFormat({ contentType: "application/octet-stream" }), undefined);
  assert.equal(fileFormat({}), undefined);
});
test("known sizes are localized in binary units, while missing or invalid sizes remain unknown", () => {
  assert.equal(fileSizeLabel(1572864, "en"), "1.5 MiB");
  assert.equal(fileSizeLabel(1572864, "fr"), "1,5 Mio");
  assert.equal(fileSizeLabel(1024), "1 KiB");
  assert.equal(fileSizeLabel(1), "1 B");
  for (const size of [undefined, null, 0, -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1])
    assert.equal(fileSizeLabel(size), undefined);
});
