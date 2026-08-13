import { readFileSync } from "node:fs";
import path from "node:path";

/** Referenced from templates/email.ts as `<img src="cid:...">`. */
export const SKETCHMAP_CONTENT_ID = "woori-aroma-sketchmap";

const SKETCHMAP_PATH = path.join(process.cwd(), "public", "sketchmap.png");

export interface EmailAttachment {
  filename: string;
  content: string;
  content_type: string;
  content_id: string;
}

let cached: EmailAttachment | null | undefined;

/**
 * Reads the single source-of-truth directions image (public/sketchmap.png —
 * also what the admin preview UI serves directly) and returns it as a
 * Resend inline attachment descriptor (content_id → referenced via
 * `cid:` in the HTML template). Cached per server process since the file
 * is a static asset that never changes at runtime and re-reading +
 * re-base64-encoding a multi-MB image on every send would be wasteful.
 * Returns null (never throws) if the file is missing — callers must
 * degrade to sending the email without the inline image rather than
 * failing the whole send.
 */
export function getSketchmapAttachment(): EmailAttachment | null {
  if (cached !== undefined) return cached;

  try {
    const buffer = readFileSync(SKETCHMAP_PATH);
    cached = {
      filename: "sketchmap.png",
      content: buffer.toString("base64"),
      content_type: "image/png",
      content_id: SKETCHMAP_CONTENT_ID,
    };
  } catch (error) {
    console.error(`[notifications] failed to read sketchmap attachment at ${SKETCHMAP_PATH}`, error);
    cached = null;
  }

  return cached;
}
