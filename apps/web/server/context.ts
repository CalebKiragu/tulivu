import type { AppConfig } from "./config.js";
import type { Database } from "./db/client.js";
import { createImageProvider, type ImageGenerationProvider } from "./providers/images.js";
import { createProviderRegistry, type ProviderRegistry } from "./providers/index.js";
import { createPlatformRegistry, type PlatformRegistry } from "./integrations/platforms.js";
import { createToolRegistry, type ToolRegistry } from "./tools/registry.js";
import { LocalAssetStorage, type AssetStorage } from "./services/storage.js";
import { createWorkflowEngine, type WorkflowEngine } from "./workflow/engine.js";
import type { StageDeps } from "./workflow/stage-context.js";

export interface AppContext extends StageDeps {
  workflow: WorkflowEngine;
}

export function createAppContext(config: AppConfig, db: Database): AppContext {
  const providers: ProviderRegistry = createProviderRegistry(config);
  const imageProvider: ImageGenerationProvider = createImageProvider(config);
  const platforms: PlatformRegistry = createPlatformRegistry(config);
  const storage: AssetStorage = new LocalAssetStorage(config.assetsDir);
  const tools: ToolRegistry = createToolRegistry({ db, config, storage, imageProvider, platforms });
  const stageDeps: StageDeps = { db, config, providers, tools, storage, imageProvider, platforms };
  const workflow = createWorkflowEngine(stageDeps);
  return { ...stageDeps, workflow };
}
