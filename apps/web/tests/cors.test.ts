import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestHarness, type TestHarness } from "./helpers/app.js";

const allowedOrigin = "https://d1od9e2r6kgpgt.amplifyapp.com";

describe("credentialed CORS for a static frontend", () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await createTestHarness({ corsOrigins: [allowedOrigin] });
  });

  afterAll(async () => {
    await harness.close();
  });

  it("answers allowed preflight requests with credentials", async () => {
    const response = await harness.app.inject({
      method: "OPTIONS",
      url: "/api/config",
      headers: {
        origin: allowedOrigin,
        "access-control-request-method": "GET",
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(allowedOrigin);
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("does not add CORS headers for unknown origins", async () => {
    const response = await harness.app.inject({
      method: "GET",
      url: "/api/config",
      headers: { origin: "https://not-allowed.example.com" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
