import test from "node:test";
import assert from "node:assert/strict";
import { managedVideoCleanupCandidates } from "../src/lib/media";

const scope = "commerce-product-videos";
const old = `https://cdn.fondeka.com/${scope}/42/old-video.mp4`;

test("cleanup deduplicates replaced videos and retains every referenced URL", () => {
  assert.deepEqual(managedVideoCleanupCandidates(scope, [old, old, null], [old]), []);
  assert.deepEqual(
    managedVideoCleanupCandidates(
      scope,
      [old, old, null],
      [`https://cdn.fondeka.com/${scope}/42/new.mov`],
    ),
    [old],
  );
});

test("cleanup rejects external hosts, other scopes, images and signed credentials", () => {
  const unsafe = [
    old.replace("cdn.fondeka.com", "attacker.example"),
    old.replace("cdn.fondeka.com", "cdn.fondeka.com.attacker.example"),
    old.replace(scope, "commerce-store-videos"),
    old.replace(scope, "commerce-product-images"),
    old.replace(".mp4", ".jpg"),
    old + "?X-Amz-Signature=secret",
    old + "#fragment",
    old.replace("https:", "http:"),
    old.replace("/42/", "/42/../"),
    old.replace("/old-video", "/%2e%2e/old-video"),
    old.replace("https://", "https://user:password@"),
  ];
  assert.deepEqual(managedVideoCleanupCandidates(scope, unsafe, []), []);
});

test("cleanup uses a configured HTTPS public base without accepting sibling paths", () => {
  const value = `https://media.example/assets/${scope}/42/old.mov`;
  assert.deepEqual(
    managedVideoCleanupCandidates(scope, [value], [], "https://media.example/assets"),
    [value],
  );
  assert.deepEqual(
    managedVideoCleanupCandidates(
      scope,
      [value.replace("/assets/", "/assets-other/")],
      [],
      "https://media.example/assets",
    ),
    [],
  );
  assert.deepEqual(
    managedVideoCleanupCandidates(scope, [value], [], "http://media.example/assets"),
    [],
  );
});

test("cleanup accepts backend-configured S3 media hosts and never arbitrary buckets", () => {
  const value = old.replace("cdn.fondeka.com", "fondeka-media-prod.s3.amazonaws.com");
  assert.deepEqual(managedVideoCleanupCandidates(scope, [value], []), [value]);
  assert.deepEqual(
    managedVideoCleanupCandidates(scope, [value.replace("fondeka-media-prod", "other-bucket")], []),
    [],
  );
});
