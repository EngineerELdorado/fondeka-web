import { test } from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { resolveTheme, themeInitScript, themeStorageKey } from "../src/lib/theme";

test("public guides default to dark and the portal defaults to light", () => {
  for (const [pathname, expected] of [
    ["/api-guides", "dark"],
    ["/developers/guides", "light"],
    ["/login", "light"],
    ["", "light"],
  ]) {
    for (const value of [null, undefined, "system", "invalid"])
      assert.equal(resolveTheme(value, pathname), expected);
    assert.equal(resolveTheme("light", pathname), "light");
    assert.equal(resolveTheme("dark", pathname), "dark");
  }
});

test("the theme initialization restores the saved preference before rendering", () => {
  for (const [pathname, stored, expected] of [
    ["/api-guides", null, "dark"],
    ["/api-guides", "invalid", "dark"],
    ["/api-guides", "light", "light"],
    ["/api-guides", "dark", "dark"],
    ["/developers/guides", null, "light"],
    ["/developers/guides", "invalid", "light"],
    ["/developers/guides", "light", "light"],
    ["/developers/guides", "dark", "dark"],
  ]) {
    const root = { dataset: {} as Record<string, string>, style: {} as Record<string, string> };
    runInNewContext(themeInitScript, {
      document: { documentElement: root },
      window: {
        location: { pathname },
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

test("blocked browser storage uses the page's default theme", () => {
  for (const [pathname, expected] of [
    ["/api-guides", "dark"],
    ["/developers/guides", "light"],
  ]) {
    const root = { dataset: {} as Record<string, string>, style: {} as Record<string, string> };
    runInNewContext(themeInitScript, {
      document: { documentElement: root },
      window: {
        location: { pathname },
        localStorage: {
          getItem() {
            throw new Error("Storage is disabled");
          },
        },
      },
    });
    assert.equal(root.dataset.theme, expected);
    assert.equal(root.style.colorScheme, expected);
  }
});
