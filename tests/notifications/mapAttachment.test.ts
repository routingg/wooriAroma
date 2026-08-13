import { describe, expect, it } from "vitest";
import { getSketchmapAttachment, SKETCHMAP_CONTENT_ID } from "@/lib/notifications/mapAttachment";

describe("getSketchmapAttachment", () => {
  it("reads public/sketchmap.png and returns a Resend inline-attachment descriptor", () => {
    const attachment = getSketchmapAttachment();

    expect(attachment).not.toBeNull();
    expect(attachment?.filename).toBe("sketchmap.png");
    expect(attachment?.content_type).toBe("image/png");
    expect(attachment?.content_id).toBe(SKETCHMAP_CONTENT_ID);
    expect(attachment?.content.length).toBeGreaterThan(0);
    // A PNG file, base64-encoded, always starts with this prefix (magic bytes 89 50 4E 47).
    expect(attachment?.content.startsWith("iVBORw0KGgo")).toBe(true);
  });

  it("caches the result across calls (same reference)", () => {
    expect(getSketchmapAttachment()).toBe(getSketchmapAttachment());
  });
});
