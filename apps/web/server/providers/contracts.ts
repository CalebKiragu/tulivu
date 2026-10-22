import { z } from "zod";
import { adCopySchema } from "@tulivu/shared";

export const adCopyDraftSchema = adCopySchema.omit({
  validation: true,
  generatedAt: true,
  constraintsVersion: true,
});

export const qualityCritiqueSchema = z.object({
  summary: z.string().min(1).max(1200),
  suggestions: z.array(z.string().min(1).max(400)).max(8),
});

export type QualityCritique = z.infer<typeof qualityCritiqueSchema>;

export const SCHEMA_NAMES = {
  brief: "CampaignBriefArtifact",
  strategy: "MarketingStrategy",
  audience: "AudienceResearch",
  copy: "AdCopyDraft",
  quality: "QualityCritique",
} as const;
