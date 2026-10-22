import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  CircleAlert,
  Megaphone,
  ShieldCheck,
  Sparkles,
  Target,
  Wallet,
} from "lucide-react";
import {
  CHANNELS,
  CURRENCIES,
  OBJECTIVES,
  addDays,
  campaignBriefInputSchema,
  dateInputValue,
  formatDate,
  formatMoney,
  type CampaignBriefInput,
} from "@tulivu/shared";
import { PageHeader } from "@/components/page-header";
import {
  Badge,
  Button,
  Callout,
  Card,
  Checkbox,
  EmptyState,
  Field,
  Input,
  Select,
  Textarea,
  buttonClass,
} from "@/components/ui";
import { useToast } from "@/components/toast";
import { api, apiErrorMessage } from "@/lib/api";
import { useBusinesses, useCreateCampaign } from "@/lib/queries";

interface FieldErrors {
  [key: string]: string[] | undefined;
}

function defaultBrief(currency: string, geography: string, destinationUrl: string): CampaignBriefInput {
  return {
    name: "",
    objective: "sales",
    product: "",
    geography,
    audience: "",
    channels: ["meta"],
    destinationUrl,
    budgetAmount: 45000,
    budgetCurrency: currency as CampaignBriefInput["budgetCurrency"],
    startDate: dateInputValue(),
    durationDays: 14,
    conversionAction: "",
    offer: "",
    competitors: "",
    testimonials: "",
    brandGuidelines: "",
    language: "English",
    excludedAudiences: "",
    instructions: "",
  };
}

export default function NewCampaignPage() {
  const businesses = useBusinesses();
  const createCampaign = useCreateCampaign();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedBusiness = searchParams.get("business");
  const [businessId, setBusinessId] = useState(requestedBusiness ?? "");
  const [brief, setBrief] = useState<CampaignBriefInput>(defaultBrief("KES", "Kenya", ""));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [startImmediately, setStartImmediately] = useState(true);
  const { push } = useToast();

  const selectedBusiness = useMemo(
    () => businesses.data?.businesses.find((business) => business.id === businessId) ?? null,
    [businesses.data, businessId],
  );

  useEffect(() => {
    if (!businesses.data || businessId) return;
    const first = businesses.data.businesses[0];
    if (first) {
      setBusinessId(first.id);
      setBrief((current) => ({
        ...current,
        budgetCurrency: first.defaultCurrency as CampaignBriefInput["budgetCurrency"],
        geography: [first.city, first.country].filter(Boolean).join(", ") || current.geography,
        destinationUrl: current.destinationUrl || first.websiteUrl,
      }));
    }
  }, [businesses.data, businessId]);

  function update<K extends keyof CampaignBriefInput>(key: K, value: CampaignBriefInput[K]) {
    setBrief((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  }

  function toggleChannel(channel: CampaignBriefInput["channels"][number]) {
    setBrief((current) => {
      const channels = current.channels.includes(channel)
        ? current.channels.filter((item) => item !== channel)
        : [...current.channels, channel];
      return { ...current, channels };
    });
    setFieldErrors((current) => ({ ...current, channels: undefined }));
  }

  function selectBusiness(id: string) {
    setBusinessId(id);
    const business = businesses.data?.businesses.find((item) => item.id === id);
    setBrief((current) => ({
      ...current,
      ...(business
        ? {
            budgetCurrency: business.defaultCurrency as CampaignBriefInput["budgetCurrency"],
            geography: [business.city, business.country].filter(Boolean).join(", ") || current.geography,
            destinationUrl: business.websiteUrl || current.destinationUrl,
          }
        : {}),
    }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = campaignBriefInputSchema.safeParse(brief);
    if (!parsed.success) {
      const errors = parsed.error.flatten().fieldErrors as FieldErrors;
      setFieldErrors(errors);
      setFormError("A few fields need attention before this brief can be saved.");
      return;
    }
    if (!businessId) {
      setFormError("Choose the business this campaign belongs to.");
      return;
    }
    try {
      const response = await createCampaign.mutateAsync({ businessId, brief: parsed.data });
      const id = response.campaign.campaign.id;
      if (startImmediately) {
        try {
          await api.startRun(id);
          push({
            title: "Campaign created · agent running",
            description: "The eight-stage workflow is now preparing your package.",
            tone: "success",
          });
        } catch (caught) {
          push({
            title: "Campaign created, but the run did not start",
            description: apiErrorMessage(caught),
            tone: "error",
          });
        }
      } else {
        push({ title: "Campaign brief created", description: "Start the agent from the campaign workspace.", tone: "success" });
      }
      navigate(`/app/campaigns/${id}`);
    } catch (caught) {
      setFormError(apiErrorMessage(caught));
    }
  }

  if (businesses.isLoading) return null;

  if (!businesses.isLoading && (businesses.data?.businesses.length ?? 0) === 0) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="New campaign" title="Add a business first." back={{ to: "/app/campaigns", label: "Campaigns" }} />
        <Card>
          <EmptyState
            icon={<Megaphone className="h-5 w-5" aria-hidden />}
            title="A campaign needs a business profile"
            description="Tulivu grounds every campaign in the facts you supply. Add a business, then return to the brief."
            action={
              <Link to="/app/businesses" className={buttonClass()}>
                Go to businesses
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  const endDate = addDays(brief.startDate || dateInputValue(), brief.durationDays || 1);
  const destinationRequired = ["traffic", "leads", "sales"].includes(brief.objective);

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="New campaign"
        title="Start with a clear brief."
        description="The agent can work with gaps — but only if they are visible. Supply what you know, leave the rest empty, and Tulivu will record the difference."
        back={{ to: "/app/campaigns", label: "Campaigns" }}
        actions={<Badge tone="gold">Nothing is published</Badge>}
      />

      <form onSubmit={submit} className="grid items-start gap-6 xl:grid-cols-[1.55fr_1fr]">
        <div className="space-y-5">
          {formError ? (
            <Callout tone="danger" icon={<CircleAlert className="h-4 w-4" aria-hidden />} title="The brief is not ready">
              {formError}
            </Callout>
          ) : null}

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-forest text-gold">
                <Target className="h-3.5 w-3.5" aria-hidden />
              </span>
              <div>
                <p className="tulivu-label text-gold-deep">01 · The frame</p>
                <h2 className="text-lg leading-tight text-forest">Business and objective</h2>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Business" htmlFor="campaign-business">
                <Select id="campaign-business" value={businessId} onChange={(event) => selectBusiness(event.target.value)}>
                  {businesses.data?.businesses.map((business) => (
                    <option key={business.id} value={business.id}>
                      {business.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Campaign name"
                htmlFor="campaign-name"
                error={fieldErrors.name?.[0]}
                hint="Specific enough to recognise in a list."
              >
                <Input
                  id="campaign-name"
                  value={brief.name}
                  onChange={(event) => update("name", event.target.value)}
                  placeholder="Barrier Repair Launch — Nairobi"
                />
              </Field>
            </div>

            <div className="mt-4">
              <p className="tulivu-label mb-2">Objective</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {OBJECTIVES.map((objective) => {
                  const selected = brief.objective === objective.id;
                  return (
                    <button
                      key={objective.id}
                      type="button"
                      onClick={() => update("objective", objective.id)}
                      className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                        selected
                          ? "border-forest bg-forest/[0.045] ring-1 ring-forest/15"
                          : "border-line bg-[#fffdf8] hover:border-forest/25"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                          selected ? "border-forest bg-forest text-ivory" : "border-line bg-white"
                        }`}
                      >
                        {selected ? <Check className="h-2.5 w-2.5" aria-hidden /> : null}
                      </span>
                      <span>
                        <span className="block text-xs font-semibold text-forest">{objective.label}</span>
                        <span className="mt-0.5 block text-[10px] leading-4 text-muted">{objective.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-forest text-gold">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
              </span>
              <div>
                <p className="tulivu-label text-gold-deep">02 · The offer</p>
                <h2 className="text-lg leading-tight text-forest">Product, audience and action</h2>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <Field label="Product or service" htmlFor="campaign-product" error={fieldErrors.product?.[0]}>
                <Textarea
                  id="campaign-product"
                  rows={2}
                  value={brief.product}
                  onChange={(event) => update("product", event.target.value)}
                  placeholder="Barrier Repair Duo: a fragrance-free cleanser and moisturiser for sensitive, acne-prone skin"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Geography" htmlFor="campaign-geography" error={fieldErrors.geography?.[0]}>
                  <Input
                    id="campaign-geography"
                    value={brief.geography}
                    onChange={(event) => update("geography", event.target.value)}
                    placeholder="Nairobi and Mombasa, Kenya"
                  />
                </Field>
                <Field label="Language" htmlFor="campaign-language" error={fieldErrors.language?.[0]}>
                  <Input
                    id="campaign-language"
                    value={brief.language}
                    onChange={(event) => update("language", event.target.value)}
                    placeholder="English with light Swahili warmth"
                  />
                </Field>
              </div>
              <Field
                label="Audience"
                htmlFor="campaign-audience"
                error={fieldErrors.audience?.[0]}
                hint="Who they are, what they need and what makes them hesitate. This is context, not a platform targeting spec."
              >
                <Textarea
                  id="campaign-audience"
                  rows={3}
                  value={brief.audience}
                  onChange={(event) => update("audience", event.target.value)}
                  placeholder="Women and men aged 20–38 with sensitive or acne-prone skin who already buy skincare online…"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Primary conversion action" htmlFor="campaign-conversion" error={fieldErrors.conversionAction?.[0]}>
                  <Input
                    id="campaign-conversion"
                    value={brief.conversionAction}
                    onChange={(event) => update("conversionAction", event.target.value)}
                    placeholder="Purchase of the Barrier Repair Duo"
                  />
                </Field>
                <Field label="Offer" htmlFor="campaign-offer" optional hint="Only a real, supplied offer.">
                  <Input
                    id="campaign-offer"
                    value={brief.offer}
                    onChange={(event) => update("offer", event.target.value)}
                    placeholder="A free travel-size balm on orders over KES 3,500"
                  />
                </Field>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-forest text-gold">
                <Wallet className="h-3.5 w-3.5" aria-hidden />
              </span>
              <div>
                <p className="tulivu-label text-gold-deep">03 · The shape</p>
                <h2 className="text-lg leading-tight text-forest">Channels, budget and timing</h2>
              </div>
            </div>

            <div className="mt-5">
              <p className="tulivu-label mb-2">Channels</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {CHANNELS.map((channel) => {
                  const selected = brief.channels.includes(channel.id);
                  return (
                    <button
                      key={channel.id}
                      type="button"
                      onClick={() => toggleChannel(channel.id)}
                      className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                        selected
                          ? "border-forest bg-forest/[0.045] ring-1 ring-forest/15"
                          : "border-line bg-[#fffdf8] hover:border-forest/25"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          selected ? "border-forest bg-forest text-ivory" : "border-line bg-white"
                        }`}
                      >
                        {selected ? <Check className="h-2.5 w-2.5" aria-hidden /> : null}
                      </span>
                      <span>
                        <span className="block text-xs font-semibold text-forest">{channel.label}</span>
                        <span className="mt-0.5 block text-[10px] leading-4 text-muted">{channel.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {fieldErrors.channels?.[0] ? (
                <p className="mt-1.5 text-[11px] font-medium text-clay" role="alert">{fieldErrors.channels[0]}</p>
              ) : null}
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Total budget" htmlFor="campaign-budget" error={fieldErrors.budgetAmount?.[0]}>
                <div className="flex gap-2">
                  <Input
                    id="campaign-budget"
                    type="number"
                    min={1}
                    step="1"
                    value={brief.budgetAmount || ""}
                    onChange={(event) => update("budgetAmount", Number(event.target.value))}
                    placeholder="45000"
                  />
                  <Select
                    aria-label="Budget currency"
                    className="w-28 shrink-0"
                    value={brief.budgetCurrency}
                    onChange={(event) =>
                      update("budgetCurrency", event.target.value as CampaignBriefInput["budgetCurrency"])
                    }
                  >
                    {CURRENCIES.map((currency) => (
                      <option key={currency.code} value={currency.code}>
                        {currency.code}
                      </option>
                    ))}
                  </Select>
                </div>
              </Field>
              <Field label="Duration" htmlFor="campaign-duration" error={fieldErrors.durationDays?.[0]}>
                <div className="relative">
                  <Input
                    id="campaign-duration"
                    type="number"
                    min={1}
                    max={365}
                    value={brief.durationDays || ""}
                    onChange={(event) => update("durationDays", Number(event.target.value))}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-muted">
                    days
                  </span>
                </div>
              </Field>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Start date" htmlFor="campaign-start" error={fieldErrors.startDate?.[0]}>
                <Input
                  id="campaign-start"
                  type="date"
                  value={brief.startDate}
                  onChange={(event) => update("startDate", event.target.value)}
                />
              </Field>
              <Field label="End date" hint="Derived from the start date and duration. Tulivu does not invent it.">
                <div className="flex h-10 items-center gap-2 rounded-xl border border-line bg-paper/70 px-3 text-xs font-semibold text-forest">
                  <CalendarDays className="h-3.5 w-3.5 text-muted" aria-hidden />
                  {formatDate(endDate, "long")}
                </div>
              </Field>
            </div>

            <div className="mt-4">
              <Field
                label="Destination URL"
                htmlFor="campaign-destination"
                error={fieldErrors.destinationUrl?.[0]}
                hint={
                  destinationRequired
                    ? "Required for this objective. The conversion stage checks syntax and records whether it is reachable."
                    : "Optional for this objective. If supplied, the conversion stage will check it."
                }
              >
                <Input
                  id="campaign-destination"
                  type="url"
                  value={brief.destinationUrl}
                  onChange={(event) => update("destinationUrl", event.target.value)}
                  placeholder="https://example.co.ke/shop/product"
                />
              </Field>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-forest text-gold">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              </span>
              <div>
                <p className="tulivu-label text-gold-deep">04 · The guardrails</p>
                <h2 className="text-lg leading-tight text-forest">What must stay true</h2>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <Field label="Excluded audiences" htmlFor="campaign-excluded" optional>
                <Textarea
                  id="campaign-excluded"
                  rows={2}
                  value={brief.excludedAudiences}
                  onChange={(event) => update("excludedAudiences", event.target.value)}
                  placeholder="People under 18; people seeking medical treatment or a cure…"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Competitors" htmlFor="campaign-competitors" optional>
                  <Textarea
                    id="campaign-competitors"
                    rows={2}
                    value={brief.competitors}
                    onChange={(event) => update("competitors", event.target.value)}
                  />
                </Field>
                <Field label="Real testimonials" htmlFor="campaign-testimonials" optional hint="Quoted only if supplied. Never invented.">
                  <Textarea
                    id="campaign-testimonials"
                    rows={2}
                    value={brief.testimonials}
                    onChange={(event) => update("testimonials", event.target.value)}
                  />
                </Field>
              </div>
              <Field label="Brand guidelines for this campaign" htmlFor="campaign-brand" optional>
                <Textarea
                  id="campaign-brand"
                  rows={2}
                  value={brief.brandGuidelines}
                  onChange={(event) => update("brandGuidelines", event.target.value)}
                  placeholder="Use the forest green and warm ivory palette. Keep essential ad text editable."
                />
              </Field>
              <Field label="Instructions to the agent" htmlFor="campaign-instructions" optional>
                <Textarea
                  id="campaign-instructions"
                  rows={3}
                  value={brief.instructions}
                  onChange={(event) => update("instructions", event.target.value)}
                  placeholder="Keep the tone calm and specific. Do not promise to cure acne."
                />
              </Field>
            </div>
          </Card>
        </div>

        <div className="space-y-4 xl:sticky xl:top-24">
          <Card className="overflow-hidden">
            <div className="border-b border-line bg-paper/70 px-5 py-4">
              <p className="tulivu-label text-gold-deep">Brief summary</p>
              <h2 className="mt-1 text-lg leading-tight text-forest">{brief.name || "Untitled campaign"}</h2>
              <p className="mt-1 text-[11px] text-muted">{selectedBusiness?.name ?? "No business selected"}</p>
            </div>
            <div className="space-y-3 p-5 text-[11px]">
              <div className="flex items-start justify-between gap-4 border-b border-line/70 pb-3">
                <span className="text-muted">Objective</span>
                <span className="text-right font-semibold text-forest">
                  {OBJECTIVES.find((item) => item.id === brief.objective)?.label ?? brief.objective}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4 border-b border-line/70 pb-3">
                <span className="text-muted">Budget</span>
                <span className="text-right font-semibold text-forest">
                  {brief.budgetAmount > 0 ? formatMoney(brief.budgetAmount, brief.budgetCurrency) : "Not set"}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4 border-b border-line/70 pb-3">
                <span className="text-muted">Schedule</span>
                <span className="text-right font-semibold text-forest">
                  {formatDate(brief.startDate)} → {formatDate(endDate)}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4 border-b border-line/70 pb-3">
                <span className="text-muted">Channels</span>
                <span className="text-right font-semibold text-forest">
                  {brief.channels.length
                    ? brief.channels.map((channel) => CHANNELS.find((item) => item.id === channel)?.short ?? channel).join(" + ")
                    : "None selected"}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-muted">Destination</span>
                <span className="max-w-[60%] break-all text-right font-semibold text-forest">
                  {brief.destinationUrl ? brief.destinationUrl.replace(/^https?:\/\//, "") : "None"}
                </span>
              </div>
            </div>

            <div className="border-t border-line p-5">
              <Checkbox
                checked={startImmediately}
                onChange={setStartImmediately}
                label="Start the 8-stage agent after creating"
                description="You can also inspect the brief first and start it from the campaign workspace."
              />
              <Button type="submit" loading={createCampaign.isPending} className="mt-3 w-full" size="lg">
                {createCampaign.isPending ? "Creating campaign" : "Create campaign"}
                {!createCampaign.isPending ? <ArrowRight className="h-4 w-4" aria-hidden /> : null}
              </Button>
              <Link
                to="/app/campaigns"
                className="mt-2 flex items-center justify-center gap-1 py-2 text-[11px] font-semibold text-muted transition hover:text-forest"
              >
                Cancel
                <ChevronRight className="h-3 w-3" aria-hidden />
              </Link>
            </div>
          </Card>

          <Callout tone="info" icon={<ShieldCheck className="h-4 w-4 text-leaf" aria-hidden />} title="What happens next">
            <p>
              The agent produces versioned artifacts and an independent quality review. It cannot approve or publish the
              campaign. That remains a separate human decision.
            </p>
          </Callout>

          <div className="rounded-xl border border-line bg-[#fffdf8] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Demo boundary</p>
            <p className="mt-1.5 text-[10px] leading-4 text-muted">
              No live ad account is connected. Even after approval, execution creates simulated paused resources and
              labels them clearly.
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}
