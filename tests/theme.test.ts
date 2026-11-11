import { test } from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import {
  guideThemeStorageKey,
  resolveTheme,
  themeInitScript,
  themeStorageKey,
} from "../src/lib/theme";

test("both guide areas default to dark and the workspace defaults to light", () => {
  for (const [pathname, expected] of [
    ["/api-guides", "dark"],
    ["/developers/guides", "dark"],
    ["/overview", "light"],
    ["/login", "light"],
    ["", "light"],
  ]) {
    for (const value of [null, undefined, "system", "invalid"])
      assert.equal(resolveTheme(value, pathname), expected);
    assert.equal(resolveTheme("light", pathname), "light");
    assert.equal(resolveTheme("dark", pathname), "dark");
  }
});

test("opening guides preserves the explicit dark workspace preference", () => {
  for (const pathname of ["/api-guides", "/developers/guides"]) {
    assert.equal(resolveTheme("light", pathname, "dark"), "dark");
    assert.equal(resolveTheme("dark", pathname, "dark"), "dark");
    assert.equal(resolveTheme(null, pathname, "dark"), "dark");
    assert.equal(resolveTheme("light", pathname, "light"), "light");
    assert.equal(resolveTheme("light", pathname, null), "light");
  }
});

test("initial rendering respects the dark workspace preference and saved guide overrides", () => {
  for (const [pathname, workspaceTheme, guideTheme, expected] of [
    ["/api-guides", "light", null, "dark"],
    ["/api-guides", "light", "invalid", "dark"],
    ["/api-guides", "dark", "light", "dark"],
    ["/api-guides", "dark", null, "dark"],
    ["/api-guides", "light", "light", "light"],
    ["/api-guides", null, "light", "light"],
    ["/api-guides", "light", "dark", "dark"],
    ["/developers/guides", "light", null, "dark"],
    ["/developers/guides", "dark", "light", "dark"],
    ["/developers/guides", "dark", null, "dark"],
    ["/developers/guides", "light", "light", "light"],
    ["/developers/guides", null, "light", "light"],
    ["/developers/guides", "light", "dark", "dark"],
    ["/overview", null, "dark", "light"],
    ["/overview", "invalid", "dark", "light"],
    ["/overview", "light", "dark", "light"],
    ["/overview", "dark", "light", "dark"],
  ]) {
    const preferences = new Map([
      [themeStorageKey, workspaceTheme],
      [guideThemeStorageKey, guideTheme],
    ]);
    const root = { dataset: {} as Record<string, string>, style: {} as Record<string, string> };
    runInNewContext(themeInitScript, {
      document: { documentElement: root },
      window: {
        location: { pathname },
        localStorage: {
          getItem(key: string) {
            assert.ok(preferences.has(key));
            return preferences.get(key);
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
    ["/developers/guides", "dark"],
    ["/overview", "light"],
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
