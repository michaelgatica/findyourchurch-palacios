import assert from "node:assert/strict";
import sharp from "sharp";

import {
  churchLogoMaximumDimension,
  churchLogoMinimumDimension,
  getChurchLogoDimensionError,
} from "@/lib/validation/church-logo";
import { readSupportedImageDimensions } from "@/lib/validation/image-dimensions";

async function main() {
  assert.equal(getChurchLogoDimensionError(512, 512), undefined);
  assert.equal(getChurchLogoDimensionError(churchLogoMinimumDimension, churchLogoMinimumDimension), undefined);
  assert.equal(getChurchLogoDimensionError(churchLogoMaximumDimension, churchLogoMaximumDimension), undefined);
  assert.match(getChurchLogoDimensionError(128, 128) ?? "", /at least 256x256/);
  assert.match(getChurchLogoDimensionError(4096, 4096) ?? "", /no larger than 2048x2048/);
  assert.match(getChurchLogoDimensionError(1200, 600) ?? "", /must be square/);

  const png = await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 0, g: 71, b: 38, alpha: 1 },
    },
  }).png().toBuffer();
  assert.deepEqual(await readSupportedImageDimensions(png), { width: 512, height: 512 });
  await assert.rejects(
    readSupportedImageDimensions(Buffer.from("not an image")),
    /unsupported image format|supported JPG, PNG, or WebP image/i,
  );

  console.log("Church logo validation checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
