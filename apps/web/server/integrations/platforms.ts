import {
  DemoAdPlatformAdapter,
  GoogleAdsAdapter,
  MetaAdsAdapter,
  type AdPlatformAdapter,
} from "@tulivu/ad-platforms";
import type { ChannelId } from "@tulivu/shared";
import type { AppConfig } from "../config.js";

export interface PlatformRegistry {
  mode: "demo" | "live";
  forChannel(channel: ChannelId): AdPlatformAdapter;
  demo: DemoAdPlatformAdapter;
}

/**
 * The demo adapter implements every channel, while the workflow and API call
 * `forChannel` once per channel. Scope the shared demo adapter to a single
 * channel so results are not emitted once per caller and once per adapter.
 */
function scopeDemoAdapter(demo: DemoAdPlatformAdapter, channel: ChannelId): AdPlatformAdapter {
  return {
    async getCapabilities() {
      return (await demo.getCapabilities()).filter((capability) => capability.id === channel);
    },
    async validateCampaign(campaign) {
      return (await demo.validateCampaign(campaign)).filter((result) => result.platform === channel);
    },
    async previewCampaign(campaign) {
      return (await demo.previewCampaign(campaign)).filter((preview) => preview.platform === channel);
    },
    async createDraft(campaign) {
      return (await demo.createDraft(campaign)).filter((draft) => draft.platform === channel);
    },
    async publishCampaign(campaign) {
      return (await demo.publishCampaign!(campaign)).filter((result) => result.platform === channel);
    },
    async getCampaignStatus(externalId) {
      return demo.getCampaignStatus!(externalId);
    },
  };
}

export function createPlatformRegistry(config: AppConfig): PlatformRegistry {
  const demo = new DemoAdPlatformAdapter({
    failForCampaignName: config.demoFailExecution ? /.*/ : undefined,
  });
  const meta = new MetaAdsAdapter();
  const google = new GoogleAdsAdapter();
  return {
    mode: config.adapterMode,
    demo,
    forChannel(channel) {
      if (config.adapterMode === "demo") return scopeDemoAdapter(demo, channel);
      return channel === "meta" ? meta : google;
    },
  };
}
