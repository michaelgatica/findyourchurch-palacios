import assert from "node:assert/strict";

import {
  churchLogoMaximumDimension,
  churchLogoMinimumDimension,
  getChurchLogoDimensionError,
} from "@/lib/validation/church-logo";

assert.equal(getChurchLogoDimensionError(512, 512), undefined);
assert.equal(getChurchLogoDimensionError(churchLogoMinimumDimension, churchLogoMinimumDimension), undefined);
assert.equal(getChurchLogoDimensionError(churchLogoMaximumDimension, churchLogoMaximumDimension), undefined);
assert.match(getChurchLogoDimensionError(128, 128) ?? "", /at least 256x256/);
assert.match(getChurchLogoDimensionError(4096, 4096) ?? "", /no larger than 2048x2048/);
assert.match(getChurchLogoDimensionError(1200, 600) ?? "", /must be square/);

console.log("Church logo validation checks passed.");
