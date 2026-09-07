import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { CHANGE_TYPE_DEFINITIONS } from "./change-types.ts";
import {
  getChangeTypeVisual,
  getEmailChangeIconFilename,
} from "./change-visuals.ts";

describe("change type visuals", () => {
  it("provides an email-safe generated icon for every change type", () => {
    for (const definition of CHANGE_TYPE_DEFINITIONS) {
      const visual = getChangeTypeVisual(definition.type);
      const iconPath = resolve(
        process.cwd(),
        "public",
        "email-assets",
        "change-icons",
        getEmailChangeIconFilename(definition.type),
      );

      expect(visual.iconName).toBeTruthy();
      expect(existsSync(iconPath), `${definition.type} is missing ${iconPath}`).toBe(true);
    }
  });
});
