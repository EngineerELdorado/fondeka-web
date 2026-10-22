import { test } from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { resolveTheme, themeInitScript, themeStorageKey } from "../src/lib/theme";

test("the portal defaults to light and preserves an explicit dark preference", () => {
  for (const value of [null, undefined, "system", "light", "invalid"])
    assert.equal(resolveTheme(value), "light");
  assert.equal(resolveTheme("dark"), "dark");
});

test("the theme initialization restores the saved preference before rendering", () => {
  for (const [stored, expected] of [
    [null, "light"],
    ["light", "light"],
    ["dark", "dark"],
  ]) {
    const root = { dataset: {} as Record<string, string>, style: {} as Record<string, string> };
    runInNewContext(themeInitScript, {
      document: { documentElement: root },
      window: {
        localStorage: {
          getItem(key: string) {
            assert.equal(key, themeStorageKey);
            return stored;
          },
        },
      },
    });
    assert.equal(root.dataset.theme, expected);
    assert.equal(root.style.colorScheme, expected);
  }
});

test("blocked browser storage still opens in light mode", () => {
  const root = { dataset: {} as Record<string, string>, style: {} as Record<string, string> };
  runInNewContext(themeInitScript, {
    document: { documentElement: root },
    window: {
      localStorage: {
        getItem() {
          throw new Error("Storage is disabled");
        },
      },
    },
  });
  assert.equal(root.dataset.theme, "light");
});
