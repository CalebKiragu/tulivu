export const CURRENCIES = [
  { code: "KES", label: "Kenyan shilling", symbol: "KSh", locale: "en-KE" },
  { code: "USD", label: "US dollar", symbol: "$", locale: "en-US" },
  { code: "EUR", label: "Euro", symbol: "€", locale: "de-DE" },
  { code: "GBP", label: "British pound", symbol: "£", locale: "en-GB" },
  { code: "NGN", label: "Nigerian naira", symbol: "₦", locale: "en-NG" },
  { code: "ZAR", label: "South African rand", symbol: "R", locale: "en-ZA" },
  { code: "GHS", label: "Ghanaian cedi", symbol: "₵", locale: "en-GH" },
  { code: "TZS", label: "Tanzanian shilling", symbol: "TSh", locale: "en-TZ" },
  { code: "UGX", label: "Ugandan shilling", symbol: "USh", locale: "en-UG" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

export const CHANNELS = [
  {
    id: "meta",
    label: "Meta Ads",
    description: "Facebook and Instagram placements",
    short: "Meta",
  },
  {
    id: "google",
    label: "Google Ads",
    description: "Search campaign with responsive search ads",
    short: "Google",
  },
] as const;

export type ChannelId = (typeof CHANNELS)[number]["id"];

export const OBJECTIVES = [
  { id: "awareness", label: "Brand awareness", description: "Reach new people and stay memorable." },
  { id: "traffic", label: "Website traffic", description: "Send qualified visitors to a destination." },
  { id: "leads", label: "Lead generation", description: "Collect enquiries or sign-ups." },
  { id: "sales", label: "Sales / conversions", description: "Drive purchases on a site or in store." },
  { id: "engagement", label: "Engagement", description: "Start conversations and build community." },
  { id: "app_installs", label: "App installs", description: "Grow installed app usage." },
] as const;

export type ObjectiveId = (typeof OBJECTIVES)[number]["id"];

export const CAMPAIGN_STATUSES = [
  { id: "draft", label: "Draft", tone: "neutral", description: "Brief captured, agent not started." },
  { id: "running", label: "Agent running", tone: "active", description: "Tulivu is working through the plan." },
  { id: "needs_review", label: "Needs review", tone: "attention", description: "Package is ready for a human decision." },
  { id: "approved", label: "Approved", tone: "success", description: "This exact version is approved." },
  { id: "executing", label: "Executing", tone: "active", description: "Approved actions are being submitted." },
  { id: "published_demo", label: "Simulated launch", tone: "success", description: "Demo resources created. No real ads were published." },
  { id: "failed", label: "Needs attention", tone: "danger", description: "A step failed and can be resumed." },
  { id: "cancelled", label: "Cancelled", tone: "neutral", description: "The run was stopped by a person." },
] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number]["id"];

export const WORKFLOW_STAGES = [
  { name: "intake", label: "Intake & requirements", short: "Intake", description: "Normalise the brief, surface gaps and safe defaults." },
  { name: "strategy", label: "Marketing strategy", short: "Strategy", description: "Positioning, message, structure and success metric." },
  { name: "audience", label: "Audience & market research", short: "Audience", description: "Segments, needs, objections and keyword themes." },
  { name: "copy", label: "Campaign & copy generation", short: "Copy", description: "Channel-specific copy validated against platform limits." },
  { name: "creative", label: "Creative production", short: "Creative", description: "Brand-aligned templates, copy-only variants and optional imagery." },
  { name: "conversion", label: "Conversion readiness", short: "Landing page", description: "Destination checks, tracking guidance and CTA readiness." },
  { name: "assembly", label: "Campaign assembly", short: "Assembly", description: "Assemble a platform-neutral draft and provider previews." },
  { name: "quality", label: "Independent quality review", short: "Quality", description: "Deterministic checks first, optional model critique second." },
] as const;

export type StageName = (typeof WORKFLOW_STAGES)[number]["name"];

export const STAGE_NAMES = WORKFLOW_STAGES.map((stage) => stage.name) as StageName[];

export const ARTIFACT_TYPES = [
  "brief",
  "strategy",
  "audience",
  "copy",
  "creative",
  "conversion",
  "draft",
  "quality",
] as const;

export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

export const ARTIFACT_LABELS: Record<ArtifactType, string> = {
  brief: "Campaign brief",
  strategy: "Marketing strategy",
  audience: "Audience research",
  copy: "Ad copy",
  creative: "Creative package",
  conversion: "Conversion readiness",
  draft: "Campaign configuration",
  quality: "Quality review",
};

export const STAGE_STATE_LABELS = {
  pending: "Waiting",
  running: "Working",
  completed: "Complete",
  failed: "Failed",
  skipped: "Skipped",
  awaiting_approval: "Awaiting approval",
  cancelled: "Cancelled",
} as const;
