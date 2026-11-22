import { test } from "node:test";
import assert from "node:assert/strict";
import { trainingVideoSource, youtubeEmbedUrl } from "../src/lib/training-video";
import type { TrainingMaterialAccess } from "../src/lib/training";

const id = "M7lc1UVf-VE";
test("authorized YouTube watch, share, shorts, live and embed links use a fixed privacy-enhanced player", () => {
  for (const url of [
    `https://youtube.com/watch?v=${id}`,
    `https://www.youtube.com/watch?v=${id}&si=tracking`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://music.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}`,
    `https://www.youtu.be/${id}/`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube.com/live/${id}`,
    `https://www.youtube.com/embed/${id}`,
    `https://www.youtube-nocookie.com/embed/${id}`,
  ]) {
    const player = new URL(youtubeEmbedUrl(url)!);
    assert.equal(player.origin, "https://www.youtube-nocookie.com");
    assert.equal(player.pathname, "/embed/" + id);
    assert.deepEqual(Object.fromEntries(player.searchParams), {
      autoplay: "0",
      playsinline: "1",
      rel: "0",
    });
  }
});
test("embedding preserves recognized start times and discards tracking, autoplay and arbitrary player parameters", () => {
  for (const [suffix, seconds] of [
    ["?t=90", "90"],
    ["?t=1m30s", "90"],
    ["?t=1h2m3s", "3723"],
    ["?start=42", "42"],
    ["#t=2m", "120"],
  ])
    assert.equal(
      new URL(youtubeEmbedUrl(`https://youtu.be/${id}${suffix}`)!).searchParams.get("start"),
      seconds,
    );
  const player = new URL(
    youtubeEmbedUrl(
      `https://youtube.com/watch?v=${id}&autoplay=1&origin=https://evil.example&enablejsapi=1&si=secret&list=playlist&t=bad`,
    )!,
  );
  assert.deepEqual(Object.fromEntries(player.searchParams), {
    autoplay: "0",
    playsinline: "1",
    rel: "0",
  });
  for (const t of ["-1", "Infinity", "999999999999999999999999", "0", "abc"])
    assert.equal(
      new URL(youtubeEmbedUrl(`https://youtu.be/${id}?t=${t}`)!).searchParams.get("start"),
      null,
    );
});
test("unrecognized hosts, ambiguous IDs and unsafe URLs cannot become an embedded frame", () => {
  for (const url of [
    `http://youtube.com/watch?v=${id}`,
    `https://youtube.com.evil.example/watch?v=${id}`,
    `https://evil.example/youtube.com/watch?v=${id}`,
    `https://youtube.com@evil.example/watch?v=${id}`,
    `https://user:password@youtube.com/watch?v=${id}`,
    `https://youtube.com:8443/watch?v=${id}`,
    "javascript:alert(1)",
    "https://youtube.com/playlist?list=PL123",
    "https://youtube.com/watch?v=short",
    `https://youtube.com/watch?v=${id}&v=${id}`,
    `https://youtu.be/${id}/extra`,
    `https://youtube.com/redirect?v=${id}`,
    "https://youtu.be/%3Cscript%3E",
    "not a URL",
  ])
    assert.equal(youtubeEmbedUrl(url), undefined, url);
});
const file = (patch: Partial<TrainingMaterialAccess> = {}): TrainingMaterialAccess => ({
  materialId: "11111111-1111-4111-8111-111111111111",
  type: "FILE",
  url: "https://storage.example/lesson.mp4?signature=a%2Fb%3D&expires=fixture",
  contentType: "video/mp4",
  fileName: "Video lesson.mp4",
  expiresAt: new Date(Date.now() + 600000).toISOString(),
  ...patch,
});
test("uploaded video playback keeps the exact authorized signed URL and supports generic video-file metadata", () => {
  const access = file();
  assert.deepEqual(trainingVideoSource(access), { kind: "FILE", src: access.url });
  assert.equal(
    trainingVideoSource(file({ contentType: "video/quicktime", fileName: "Lesson.mov" }))?.kind,
    "FILE",
  );
  assert.equal(
    trainingVideoSource(file({ contentType: "application/octet-stream" }))?.kind,
    "FILE",
  );
  assert.equal(trainingVideoSource(file({ contentType: null, fileName: null }))?.kind, "FILE");
  assert.equal(
    trainingVideoSource(file({ type: "LINK", url: `https://youtu.be/${id}`, expiresAt: null }))
      ?.kind,
    "YOUTUBE",
  );
});
test("expired, unsafe, non-video files and ordinary external links retain the existing non-player flow", () => {
  for (const patch of [
    { expiresAt: null },
    { expiresAt: "invalid" },
    { expiresAt: "2000-01-01T00:00:00Z" },
    { url: "http://storage.example/lesson.mp4" },
    { url: "javascript:alert(1)" },
    { contentType: "application/pdf" },
    { contentType: "text/html" },
    { contentType: null, fileName: "Document.pdf", url: "https://storage.example/document.pdf" },
    { type: "LINK" as const, url: "https://example.test/lesson.mp4", expiresAt: null },
  ])
    assert.equal(trainingVideoSource(file(patch)), undefined);
});
