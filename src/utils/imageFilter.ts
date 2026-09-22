/**
 * Image sanity helpers used to reject tracking pixels / spacers that feeds
 * sometimes expose as the item's main image (e.g. NPR's "npr-rss-pixel.png").
 *
 * We intentionally do NOT measure images on the server: doing so would require
 * downloading every image just to read its dimensions, which is slow and
 * bandwidth-heavy. Instead we use a cheap filename heuristic here, and the
 * client validates real dimensions via `naturalWidth` / `naturalHeight` on
 * load (the browser already downloaded the image to display it, so it's free).
 */

/** Images with either side below this (in px) are treated as tracking pixels. */
export const MIN_IMAGE_DIMENSION = 64;

/**
 * Filename/path heuristic for classic tracking pixels, spacers and beacons.
 *
 * The keyword may appear anywhere in the URL as long as it is immediately
 * followed by an image extension (or ends the URL/query), so it catches
 * `npr-rss-pixel.png`, `pixel.png`, `mypixel.png`, `?img=pixel.png`, as well
 * as `1x1.gif`, `spacer.png`, `blank.gif`, `transparent.gif`, `beacon.jpg`.
 * It does NOT match legitimate names like `pixel-art.png` or `beacon-hill.jpg`.
 */
const TRACKING_IMAGE_PATTERN =
  /(?:1x1|spacer|blank|transparent|tracking|beacon|pixel)(?:[._-]\d+)?(?:\.(?:gif|png|jpe?g|webp|svg))?(?:$|[?#"'\s])/i;

/** Known analytics hosts that serve invisible tracking images. */
const TRACKING_HOST_PATTERN =
  /feedburner\.com|doubleclick\.net|google-analytics\.com|scorecardresearch\.com/i;

/** True when a URL is (very likely) a tracking pixel rather than a real image. */
export function isLikelyTrackingImage(url?: string | null): boolean {
  if (!url) return false;
  return TRACKING_IMAGE_PATTERN.test(url) || TRACKING_HOST_PATTERN.test(url);
}

/** True when an image's measured dimensions are too small to be a real visual. */
export function isImageTooSmall(width?: number | null, height?: number | null): boolean {
  // Unknown dimensions: don't reject (let onLoad/onError decide).
  if (!width || !height) return false;
  return width < MIN_IMAGE_DIMENSION || height < MIN_IMAGE_DIMENSION;
}
