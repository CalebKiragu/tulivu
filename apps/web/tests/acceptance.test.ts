import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type {
  CampaignDetail,
  CampaignDraft,
  CampaignSummary,
  MarketingStrategy,
  QualityReport,
} from "@tulivu/shared";
import { createTestHarness, SessionClient, bodyOf, type TestHarness } from "./helpers/app.js";

let harness: TestHarness;

beforeAll(async () => {
  harness = await createTestHarness();
});

afterAll(async () => {
  await harness.close();
});

async function seededCampaign(client: SessionClient): Promise<string> {
  const overview = await client.get("/api/overview");
  const body = bodyOf<{ campaigns: CampaignSummary[] }>(overview);
  return body.campaigns[0]!.id;
}

async function runWorkflow(client: SessionClient, campaignId: string): Promise<void> {
  const started = await client.post(`/api/campaigns/${campaignId}/runs`, {});
  expect(started.statusCode).toBe(202);
  const detail = await client.get(`/api/campaigns/${campaignId}`);
  expect(detail.statusCode).toBe(200);
}

describe("acceptance: strategy to simulated launch", () => {
  it("runs all eight stages and stops at a human approval gate", async () => {
    const client = new SessionClient(harness.app);
    const campaignId = await seededCampaign(client);

    await runWorkflow(client, campaignId);

    const detailResponse = await client.get(`/api/campaigns/${campaignId}`);
    const detail = bodyOf<{ campaign: CampaignDetail; qualityStale: boolean }>(detailResponse).campaign;

    expect(detail.campaign.status).toBe("needs_review");
    expect(Object.keys(detail.artifacts).sort()).toEqual(
      ["audience", "brief", "conversion", "copy", "creative", "draft", "quality", "strategy"].sort(),
    );
    expect(detail.runs[0]?.status).toBe("completed");
    expect(detail.stages.filter((stage) => stage.status === "completed")).toHaveLength(8);

    const quality = detail.artifacts.quality!.content as QualityReport;
    expect(quality.campaignVersion).toBe(detail.campaign.currentVersion);
    expect(quality.checks.length).toBeGreaterThan(0);
    expect(["pass", "warn"]).toContain(quality.verdict);

    const draft = detail.artifacts.draft!.content as CampaignDraft;
    expect(draft.previews?.length).toBe(2);
    for (const preview of draft.previews ?? []) {
      expect(preview.simulated).toBe(true);
      expect(preview.estimatedReach).toBeNull();
      expect(preview.estimatedDailySpend).toBeNull();
    }

    if (quality.verdict === "warn") {
      const unacknowledged = await client.post(`/api/campaigns/${campaignId}/approve`, {
        campaignVersion: detail.campaign.currentVersion,
        acknowledgeWarnings: false,
      });
      expect(unacknowledged.statusCode).toBe(409);
      expect(bodyOf<{ error: { code: string } }>(unacknowledged).error.code).toBe("warnings_unacknowledged");
    }

    const approved = await client.post(`/api/campaigns/${campaignId}/approve`, {
      campaignVersion: detail.campaign.currentVersion,
      acknowledgeWarnings: true,
      note: "Approved for a two-week demo test.",
    });
    expect(approved.statusCode).toBe(200);
    const approvedBody = bodyOf<{ approval: { status: string; campaignVersion: number }; campaign: CampaignDetail }>(
      approved,
    );
    expect(approvedBody.approval.status).toBe("active");
    expect(approvedBody.approval.campaignVersion).toBe(detail.campaign.currentVersion);
    expect(approvedBody.campaign.campaign.status).toBe("approved");

    const execution = await client.post(`/api/campaigns/${campaignId}/execute`, {
      campaignVersion: detail.campaign.currentVersion,
      mode: "demo",
    });
    expect(execution.statusCode).toBe(200);
    const executed = bodyOf<{
      execution: {
        status: string;
        simulated: boolean;
        results: Array<{ platform: string; status: string; simulated: boolean }>;
        failures: unknown[];
      };
      campaign: CampaignDetail;
    }>(execution);
    expect(executed.execution.status).toBe("published_demo");
    expect(executed.execution.simulated).toBe(true);
    expect(executed.execution.failures).toHaveLength(0);
    expect(executed.execution.results).toHaveLength(2);
    for (const result of executed.execution.results) {
      expect(result.simulated).toBe(true);
      expect(result.status).toBe("PAUSED");
    }
    expect(executed.campaign.campaign.status).toBe("published_demo");
    expect(executed.campaign.operations.length).toBe(2);

    const duplicate = await client.post(`/api/campaigns/${campaignId}/execute`, {
      campaignVersion: detail.campaign.currentVersion,
      mode: "demo",
    });
    expect(duplicate.statusCode).toBe(200);
    expect(bodyOf<{ execution: { status: string } }>(duplicate).execution.status).toBe("already_executed");

    const exported = await client.get(`/api/campaigns/${campaignId}/export?format=markdown`);
    expect(exported.statusCode).toBe(200);
    expect(exported.headers["content-type"]).toContain("text/markdown");
    expect(exported.body).toContain(detail.campaign.name);
    expect(exported.body.toLowerCase()).toContain("simulated");
    expect(exported.body.toLowerCase()).toContain("no real");

    const jsonExport = await client.get(`/api/campaigns/${campaignId}/export?format=json`);
    expect(jsonExport.statusCode).toBe(200);
    const bundle = JSON.parse(jsonExport.body) as { campaign: { id: string }; simulated: boolean };
    expect(bundle.campaign.id).toBe(campaignId);
    expect(bundle.simulated).toBe(true);
  });
});

describe("acceptance: edits void review and approval", () => {
  it("bumps versions, blocks approval, then supports a quality-only re-review", async () => {
    const client = new SessionClient(harness.app);
    const campaignId = await seededCampaign(client);
    await runWorkflow(client, campaignId);

    const before = bodyOf<{ campaign: CampaignDetail }>(
      await client.get(`/api/campaigns/${campaignId}`),
    ).campaign;
    const strategy = before.artifacts.strategy!.content as MarketingStrategy;

    const edited = await client.patch(`/api/campaigns/${campaignId}/artifacts/strategy`, {
      content: {
        ...strategy,
        valueProposition: `${strategy.valueProposition} Edited by a reviewer for this test.`,
      },
      note: "Acceptance test: clarify the proposition.",
    });
    expect(edited.statusCode).toBe(200);
    const editBody = bodyOf<{ campaignVersion: number; qualityStale: boolean }>(edited);
    expect(editBody.campaignVersion).toBe(before.campaign.currentVersion + 1);
    expect(editBody.qualityStale).toBe(true);

    const staleDetail = bodyOf<{ campaign: CampaignDetail; qualityStale: boolean }>(
      await client.get(`/api/campaigns/${campaignId}`),
    );
    expect(staleDetail.qualityStale).toBe(true);
    expect(staleDetail.campaign.campaign.currentVersion).toBe(editBody.campaignVersion);

    const staleApproval = await client.post(`/api/campaigns/${campaignId}/approve`, {
      campaignVersion: staleDetail.campaign.campaign.currentVersion,
      acknowledgeWarnings: true,
    });
    expect(staleApproval.statusCode).toBe(409);
    expect(bodyOf<{ error: { code: string } }>(staleApproval).error.code).toBe("quality_stale");

    const prematureExecution = await client.post(`/api/campaigns/${campaignId}/execute`, {
      campaignVersion: staleDetail.campaign.campaign.currentVersion,
      mode: "demo",
    });
    expect(prematureExecution.statusCode).toBe(409);
    expect(bodyOf<{ error: { code: string } }>(prematureExecution).error.code).toBe("approval_required");

    const invalidArtifact = await client.patch(`/api/campaigns/${campaignId}/artifacts/strategy`, {
      content: { valueProposition: 42 },
    });
    expect(invalidArtifact.statusCode).toBe(400);
    expect(bodyOf<{ error: { code: string } }>(invalidArtifact).error.code).toBe("invalid_artifact");

    const readOnlyQuality = await client.patch(`/api/campaigns/${campaignId}/artifacts/quality`, {
      content: {},
    });
    expect(readOnlyQuality.statusCode).toBe(403);
    expect(bodyOf<{ error: { code: string } }>(readOnlyQuality).error.code).toBe("quality_read_only");

    const revalidated = await client.post(`/api/campaigns/${campaignId}/quality/revalidate`, {});
    expect(revalidated.statusCode).toBe(202);

    const reviewed = bodyOf<{ campaign: CampaignDetail; qualityStale: boolean }>(
      await client.get(`/api/campaigns/${campaignId}`),
    );
    expect(reviewed.qualityStale).toBe(false);
    const quality = reviewed.campaign.artifacts.quality!.content as QualityReport;
    expect(quality.campaignVersion).toBe(reviewed.campaign.campaign.currentVersion);
    expect(reviewed.campaign.campaign.currentVersion).toBe(editBody.campaignVersion);
    expect(reviewed.campaign.artifacts.strategy!.version).toBe(strategy ? before.artifacts.strategy!.version + 1 : 1);

    const approval = await client.post(`/api/campaigns/${campaignId}/approve`, {
      campaignVersion: reviewed.campaign.campaign.currentVersion,
      acknowledgeWarnings: true,
      note: "Re-approved after the quality-only review.",
    });
    expect(approval.statusCode).toBe(200);

    const execution = await client.post(`/api/campaigns/${campaignId}/execute`, {
      campaignVersion: reviewed.campaign.campaign.currentVersion,
      mode: "demo",
    });
    expect(execution.statusCode).toBe(200);
    expect(bodyOf<{ execution: { status: string } }>(execution).execution.status).toBe("published_demo");
  });
});
