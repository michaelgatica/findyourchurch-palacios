export const churchLogoMinimumDimension = 256;
export const churchLogoMaximumDimension = 2048;

/**
 * Logos are rendered in a fixed square brand frame. Keep the upload square
 * so the renderer can use contain without distorting or silently cropping it.
 */
export function getChurchLogoDimensionError(width?: number, height?: number) {
  if (!width || !height) {
    return "Logo dimensions could not be read. Please upload a square PNG, JPG, or WebP image.";
  }

  if (width < churchLogoMinimumDimension || height < churchLogoMinimumDimension) {
    return `Logo must be at least ${churchLogoMinimumDimension}x${churchLogoMinimumDimension}px.`;
  }

  if (width > churchLogoMaximumDimension || height > churchLogoMaximumDimension) {
    return `Logo must be no larger than ${churchLogoMaximumDimension}x${churchLogoMaximumDimension}px.`;
  }

  const aspectRatio = width / height;

  if (aspectRatio < 0.95 || aspectRatio > 1.05) {
    return "Logo must be square (within 5% of a 1:1 aspect ratio) so it is not stretched or cropped.";
  }

  return undefined;
}
