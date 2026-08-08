import sharp from "sharp";

const maximumDecodedImagePixels = 36_000_000;
const supportedImageFormats = new Set(["jpeg", "png", "webp"]);

export async function readSupportedImageDimensions(buffer: Buffer) {
  const metadata = await sharp(buffer, {
    failOn: "warning",
    limitInputPixels: maximumDecodedImagePixels,
  }).metadata();

  if (!metadata.format || !supportedImageFormats.has(metadata.format)) {
    throw new Error("The uploaded file is not a supported JPG, PNG, or WebP image.");
  }

  if (!metadata.width || !metadata.height) {
    throw new Error("The uploaded image dimensions could not be determined.");
  }

  return {
    width: metadata.width,
    height: metadata.height,
  };
}
