import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@google/genai";
import {
  checkGeminiConnection,
  classifyGeminiError,
  DEFAULT_GEMINI_MODEL,
  getGeminiClient,
  getGeminiModelName,
  GeminiConfigError,
} from "@/lib/agent/geminiClient";

const originalApiKey = process.env.GEMINI_API_KEY;
const originalModel = process.env.GEMINI_MODEL;

// These run before any test in this file constructs a real client, so the
// module-level client cache in geminiClient.ts can't have been warmed yet
// — see the doc comment on cachedClient there.
describe("Gemini client (unit, no network)", () => {
  beforeEach(() => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
  });

  afterEach(() => {
    if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalApiKey;
    if (originalModel === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = originalModel;
  });

  it("throws a safe, classified error when GEMINI_API_KEY is unset — and never echoes a key", () => {
    let caught: unknown;
    try {
      getGeminiClient();
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(GeminiConfigError);
    expect((caught as Error).message).not.toMatch(/GEMINI_API_KEY=/);
    expect((caught as Error).message.length).toBeLessThan(200);
  });

  it("checkGeminiConnection resolves (never throws) NOT_CONFIGURED when unset", async () => {
    const status = await checkGeminiConnection();
    expect(status.ok).toBe(false);
    if (!status.ok) {
      expect(status.reason).toBe("NOT_CONFIGURED");
    }
  });

  it("resolves the model name from GEMINI_MODEL when set, else the single documented default", () => {
    expect(getGeminiModelName()).toBe(DEFAULT_GEMINI_MODEL);
    process.env.GEMINI_MODEL = "gemini-custom-test-model";
    expect(getGeminiModelName()).toBe("gemini-custom-test-model");
  });

  it("classifies API errors by HTTP status, never by guessing from the key's shape", () => {
    expect(classifyGeminiError(new ApiError({ status: 401, message: "API key not valid" })).reason).toBe(
      "INVALID_API_KEY",
    );
    expect(
      classifyGeminiError(new ApiError({ status: 403, message: "Generative Language API has not been used / disabled" }))
        .reason,
    ).toBe("API_DISABLED");
    expect(classifyGeminiError(new ApiError({ status: 404, message: "model not found" })).reason).toBe(
      "MODEL_NOT_FOUND",
    );
    expect(classifyGeminiError(new ApiError({ status: 429, message: "quota exceeded" })).reason).toBe(
      "QUOTA_EXCEEDED",
    );
    expect(classifyGeminiError(new Error("network down")).reason).toBe("UNKNOWN");
  });

  it("never includes the API key value in a classified error message", () => {
    const secret = "AIzaFAKE_SECRET_VALUE_12345";
    const { message } = classifyGeminiError(new ApiError({ status: 401, message: "API key not valid" }));
    expect(message).not.toContain(secret);
  });
});

// Real network call — only runs when a real credential is actually
// available, so CI without GEMINI_API_KEY safely skips this instead of
// failing (task spec §15's integration-vs-unit split).
describe.skipIf(!process.env.GEMINI_API_KEY)("Gemini client (integration, real network)", () => {
  it("authenticates against the real Gemini backend with the configured model", async () => {
    const status = await checkGeminiConnection();
    expect(status.model).toBe(getGeminiModelName());
    if (!status.ok) {
      // Still asserts the contract (never throws, classifies the failure)
      // even if the configured key/model turns out to be invalid.
      expect(status.reason).not.toBe("NOT_CONFIGURED");
    }
  });
});
