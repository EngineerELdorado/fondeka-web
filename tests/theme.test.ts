import { test } from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { resolveTheme, themeInitScript, themeStorageKey } from "../src/lib/theme";

test("the portal defaults to dark and only accepts an explicit light preference", () => {
  for (const value of [null, undefined, "system", "dark", "invalid"])
    assert.equal(resolveTheme(value), "dark");
  assert.equal(resolveTheme("light"), "light");
});

test("the theme initialization restores the saved preference before rendering", () => {
  for (const [stored, expected] of [
    [null, "dark"],
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

test("blocked browser storage still opens in dark mode", () => {
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
  assert.equal(root.dataset.theme, "dark");
});
