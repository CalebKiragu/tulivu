import { useEffect, useRef, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import type { ArtifactType, BusinessInput, CampaignBriefInput } from "@tulivu/shared";
import { api } from "./api";

export const queryKeys = {
  config: ["config"] as const,
  overview: ["overview"] as const,
  businesses: ["businesses"] as const,
  business: (id: string) => ["business", id] as const,
  campaigns: ["campaigns"] as const,
  campaign: (id: string) => ["campaign", id] as const,
  activity: (campaignId?: string) => ["activity", campaignId ?? "all"] as const,
  assets: (campaignId?: string) => ["assets", campaignId ?? "all"] as const,
  settings: ["settings"] as const,
  platforms: ["platforms"] as const,
};

async function invalidateWorkspace(queryClient: QueryClient, campaignId?: string): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.campaigns }),
    queryClient.invalidateQueries({ queryKey: queryKeys.overview }),
    queryClient.invalidateQueries({ queryKey: queryKeys.activity(undefined) }),
    ...(campaignId
      ? [
          queryClient.invalidateQueries({ queryKey: queryKeys.campaign(campaignId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.activity(campaignId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.assets(campaignId) }),
        ]
      : [queryClient.invalidateQueries({ queryKey: queryKeys.assets(undefined) })]),
  ]);
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                      */
/* -------------------------------------------------------------------------- */

export function useConfig() {
  return useQuery({
    queryKey: queryKeys.config,
    queryFn: api.config,
    staleTime: 5 * 60_000,
  });
}

export function useOverview() {
  return useQuery({ queryKey: queryKeys.overview, queryFn: api.overview });
}

export function useBusinesses() {
  return useQuery({ queryKey: queryKeys.businesses, queryFn: api.businesses });
}

export function useBusiness(businessId: string | null) {
  return useQuery({
    queryKey: queryKeys.business(businessId ?? "none"),
    queryFn: () => api.business(businessId!),
    enabled: Boolean(businessId),
  });
}

export function useCampaigns() {
  return useQuery({ queryKey: queryKeys.campaigns, queryFn: api.campaigns });
}

export function useCampaign(campaignId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.campaign(campaignId ?? "none"),
    queryFn: () => api.campaign(campaignId!),
    enabled: Boolean(campaignId),
    refetchInterval: (query) => {
      const status = query.state.data?.campaign.campaign.status;
      return status === "running" || status === "executing" ? 5000 : false;
    },
  });
}

export function useActivity(campaignId?: string, limit = 60) {
  return useQuery({
    queryKey: queryKeys.activity(campaignId),
    queryFn: () => api.activity({ ...(campaignId ? { campaignId } : {}), limit }),
    enabled: campaignId !== "",
  });
}

export function useAssets(campaignId?: string) {
  return useQuery({
    queryKey: queryKeys.assets(campaignId),
    queryFn: () => api.assets(campaignId),
  });
}

export function useSettings() {
  return useQuery({ queryKey: queryKeys.settings, queryFn: api.settings });
}

export function usePlatforms() {
  return useQuery({ queryKey: queryKeys.platforms, queryFn: api.platforms });
}

/* -------------------------------------------------------------------------- */
/* Mutations                                                                  */
/* -------------------------------------------------------------------------- */

export function useCreateBusiness() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BusinessInput) => api.createBusiness(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.businesses }),
        queryClient.invalidateQueries({ queryKey: queryKeys.overview }),
        queryClient.invalidateQueries({ queryKey: queryKeys.activity(undefined) }),
      ]);
    },
  });
}

export function useUpdateBusiness() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ businessId, input }: { businessId: string; input: Partial<BusinessInput> }) =>
      api.updateBusiness(businessId, input),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.businesses }),
        queryClient.invalidateQueries({ queryKey: queryKeys.business(variables.businessId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.campaigns }),
        queryClient.invalidateQueries({ queryKey: queryKeys.activity(undefined) }),
      ]);
    },
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { businessId: string; brief: CampaignBriefInput }) => api.createCampaign(input),
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.campaigns }),
        queryClient.invalidateQueries({ queryKey: queryKeys.overview }),
        queryClient.invalidateQueries({ queryKey: queryKeys.activity(undefined) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.businesses }),
        queryClient.setQueryData(queryKeys.campaign(data.campaign.campaign.id), data),
      ]);
    },
  });
}

export function useUpdateCampaign(campaignId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (brief: CampaignBriefInput) => api.updateCampaign(campaignId, brief),
    onSuccess: async () => {
      await invalidateWorkspace(queryClient, campaignId);
    },
  });
}

export function useStartRun(campaignId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.startRun(campaignId),
    onSuccess: async () => {
      await invalidateWorkspace(queryClient, campaignId);
    },
  });
}

export function useCancelRun(campaignId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => api.cancelRun(campaignId, runId),
    onSuccess: async () => {
      await invalidateWorkspace(queryClient, campaignId);
    },
  });
}

export function useResumeRun(campaignId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => api.resumeRun(campaignId, runId),
    onSuccess: async () => {
      await invalidateWorkspace(queryClient, campaignId);
    },
  });
}

export function useRevalidateQuality(campaignId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.revalidateQuality(campaignId),
    onSuccess: async () => {
      await invalidateWorkspace(queryClient, campaignId);
    },
  });
}

export function usePatchArtifact(campaignId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ type, content, note }: { type: ArtifactType; content: unknown; note?: string }) =>
      api.patchArtifact(campaignId, type, content, note),
    onSuccess: async () => {
      await invalidateWorkspace(queryClient, campaignId);
    },
  });
}

export function useApprove(campaignId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { campaignVersion: number; acknowledgeWarnings: boolean; note?: string }) =>
      api.approve(campaignId, input),
    onSuccess: async () => {
      await invalidateWorkspace(queryClient, campaignId);
    },
  });
}

export function useExecute(campaignId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (campaignVersion: number) => api.execute(campaignId, campaignVersion),
    onSuccess: async () => {
      await invalidateWorkspace(queryClient, campaignId);
    },
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { workspaceLabel?: string; defaultCurrency?: string }) => api.updateSettings(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.settings }),
        queryClient.invalidateQueries({ queryKey: queryKeys.overview }),
      ]);
    },
  });
}

export function useResetDemo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.resetDemo,
    onSuccess: async () => {
      queryClient.clear();
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Campaign event stream                                                      */
/* -------------------------------------------------------------------------- */

export interface CampaignStreamEvent {
  type: string;
  payload: Record<string, unknown>;
}

export function useCampaignEvents(campaignId: string | undefined, enabled = true) {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<CampaignStreamEvent | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!campaignId || !enabled || typeof window === "undefined") return;

    let cancelled = false;
    const source = new EventSource(`/api/campaigns/${campaignId}/events`);

    const scheduleInvalidate = () => {
      if (timeout.current) clearTimeout(timeout.current);
      timeout.current = setTimeout(() => {
        void invalidateWorkspace(queryClient, campaignId);
      }, 280);
    };

    source.onopen = () => {
      if (!cancelled) setConnected(true);
    };

    source.onerror = () => {
      if (!cancelled) setConnected(false);
    };

    source.onmessage = (message) => {
      if (cancelled) return;
      try {
        const parsed = JSON.parse(message.data) as CampaignStreamEvent;
        setLastEvent(parsed);
        scheduleInvalidate();
      } catch {
        // Ignore malformed or comment-only frames.
      }
    };

    return () => {
      cancelled = true;
      source.close();
      if (timeout.current) clearTimeout(timeout.current);
      setConnected(false);
    };
  }, [campaignId, enabled, queryClient]);

  return { connected, lastEvent };
}
