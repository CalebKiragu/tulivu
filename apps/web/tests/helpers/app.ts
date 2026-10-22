import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { FastifyInstance, InjectOptions } from "fastify";
import { buildApp } from "../../server/app.js";
import { loadConfig } from "../../server/config.js";
import { createDatabase } from "../../server/db/client.js";

type InjectResponse = Awaited<ReturnType<FastifyInstance["inject"]>>;

export interface TestHarness {
  app: FastifyInstance;
  close: () => Promise<void>;
}

export async function createTestHarness(): Promise<TestHarness> {
  const dir = await mkdtemp(path.join(tmpdir(), "tulivu-test-"));
  const config = loadConfig({
    nodeEnv: "test",
    workflowInline: true,
    adapterMode: "demo",
    pgliteDir: "memory",
    dataDir: dir,
    assetsDir: path.join(dir, "assets"),
    sessionSecret: "test-session-secret-with-more-than-32-characters",
    rateLimitMax: 10_000,
  });
  const handle = await createDatabase(config);
  const { app } = await buildApp({ config, db: handle.db });

  return {
    app,
    close: async () => {
      await app.close();
      await handle.close();
      await rm(dir, { recursive: true, force: true });
    },
  };
}

/**
 * A tiny session-aware client. @fastify/secure-session rotates the cookie on
 * the first request, so every test workspace must replay the exact header.
 */
export class SessionClient {
  private cookie = "";

  constructor(private readonly app: FastifyInstance) {}

  async request(
    method: InjectOptions["method"],
    url: string,
    payload?: Record<string, unknown>,
  ): Promise<InjectResponse> {
    const response = await this.app.inject({
      method,
      url,
      ...(payload !== undefined ? { payload } : {}),
      headers: this.cookie ? { cookie: this.cookie } : {},
    });

    const cookies = response.cookies;
    if (cookies.length > 0) {
      this.cookie = cookies.map((cookie) => `${cookie.name}=${encodeURIComponent(cookie.value)}`).join("; ");
    }
    return response;
  }

  get(url: string) {
    return this.request("GET", url);
  }

  post(url: string, payload: Record<string, unknown> = {}) {
    return this.request("POST", url, payload);
  }

  patch(url: string, payload: Record<string, unknown>) {
    return this.request("PATCH", url, payload);
  }
}

export function bodyOf<T>(response: InjectResponse): T {
  return response.json() as T;
}
