import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  Globe2,
  MapPin,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { CURRENCIES, formatDate, initials, type BusinessInput } from "@tulivu/shared";
import { PageHeader } from "@/components/page-header";
import {
  Badge,
  Button,
  Callout,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageSkeleton,
  Select,
  Spinner,
  Textarea,
  buttonClass,
} from "@/components/ui";
import { useToast } from "@/components/toast";
import { apiErrorMessage } from "@/lib/api";
import { useBusinesses, useBusiness, useCreateBusiness, useUpdateBusiness } from "@/lib/queries";

type BrandProfile = BusinessInput["brandProfile"];

const emptyBrandProfile: BrandProfile = {
  voice: "",
  tone: "",
  colors: ["#173D35", "#D9C58D", "#F5F1E7"],
  logoUrl: "",
  usps: [],
  competitors: [],
  bannedClaims: [],
  approvedCtas: [],
  existingMaterials: "",
  goals: "",
};

const emptyBusiness: BusinessInput = {
  name: "",
  description: "",
  websiteUrl: "",
  industry: "",
  country: "Kenya",
  city: "",
  targetCustomers: "",
  defaultCurrency: "KES",
  socialUrls: [],
  brandProfile: emptyBrandProfile,
};

function BrandSwatches({ colors }: { colors: string[] }) {
  if (colors.length === 0) {
    return <span className="text-[10px] text-muted">No brand colours set</span>;
  }
  return (
    <div className="flex items-center gap-1" aria-label="Brand colours">
      {colors.map((color, index) => (
        <span
          key={`${color}-${index}`}
          className="h-4 w-4 rounded-full border border-black/5 shadow-sm"
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
}

function toLines(values: string[]): string {
  return values.join("\n");
}

function fromLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function BusinessFormModal({
  open,
  businessId,
  onClose,
}: {
  open: boolean;
  businessId: string | null;
  onClose: () => void;
}) {
  const detail = useBusiness(open ? businessId : null);
  const createMutation = useCreateBusiness();
  const updateMutation = useUpdateBusiness();
  const [form, setForm] = useState<BusinessInput>(emptyBusiness);
  const [error, setError] = useState<string | null>(null);
  const { push } = useToast();

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (!businessId) {
      setForm(emptyBusiness);
      return;
    }
    const business = detail.data?.business;
    if (business) {
      const { id: _id, ...input } = business;
      setForm({
        ...emptyBusiness,
        ...input,
        brandProfile: { ...emptyBrandProfile, ...input.brandProfile },
      });
    }
  }, [open, businessId, detail.data]);

  function update<K extends keyof BusinessInput>(key: K, value: BusinessInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateBrand<K extends keyof BrandProfile>(key: K, value: BrandProfile[K]) {
    setForm((current) => ({
      ...current,
      brandProfile: { ...current.brandProfile, [key]: value },
    }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (businessId) {
        await updateMutation.mutateAsync({ businessId, input: form });
        push({ title: "Business profile updated", tone: "success" });
      } else {
        await createMutation.mutateAsync(form);
        push({ title: "Business profile created", description: "You can use it for a campaign now.", tone: "success" });
      }
      onClose();
    } catch (caught) {
      setError(apiErrorMessage(caught));
    }
  }

  const pending = createMutation.isPending || updateMutation.isPending;
  const loadingDetail = Boolean(businessId) && detail.isLoading;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={businessId ? "Edit business profile" : "Add a business"}
      description="These are the facts Tulivu is allowed to use. Gaps are recorded, never invented."
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="business-form" loading={pending} disabled={loadingDetail}>
            {businessId ? "Save profile" : "Create business"}
          </Button>
        </>
      }
    >
      {loadingDetail ? (
        <div className="flex justify-center py-16">
          <Spinner label="Loading profile" />
        </div>
      ) : (
        <form id="business-form" onSubmit={submit} className="space-y-7">
          {error ? (
            <Callout tone="danger" title="Could not save this profile">
              {error}
            </Callout>
          ) : null}

          <section className="space-y-4">
            <div>
              <p className="tulivu-label text-gold-deep">The basics</p>
              <h3 className="mt-1 text-lg text-forest">Who the business is</h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Business name" htmlFor="business-name">
                <Input
                  id="business-name"
                  value={form.name}
                  onChange={(event) => update("name", event.target.value)}
                  placeholder="Mkono Skincare"
                  required
                />
              </Field>
              <Field label="Industry" htmlFor="business-industry">
                <Input
                  id="business-industry"
                  value={form.industry}
                  onChange={(event) => update("industry", event.target.value)}
                  placeholder="Beauty & personal care"
                  required
                />
              </Field>
            </div>
            <Field
              label="Business description"
              htmlFor="business-description"
              hint="Plain facts about what it does, how it is made, and what makes it different. At least 20 characters."
            >
              <Textarea
                id="business-description"
                value={form.description}
                onChange={(event) => update("description", event.target.value)}
                rows={4}
                placeholder="A Nairobi-based skincare studio making small-batch barrier repair products…"
                required
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Website" htmlFor="business-website" optional hint="Include https://">
                <Input
                  id="business-website"
                  type="url"
                  value={form.websiteUrl}
                  onChange={(event) => update("websiteUrl", event.target.value)}
                  placeholder="https://example.co.ke"
                />
              </Field>
              <Field label="Default currency" htmlFor="business-currency">
                <Select
                  id="business-currency"
                  value={form.defaultCurrency}
                  onChange={(event) => update("defaultCurrency", event.target.value as BusinessInput["defaultCurrency"])}
                >
                  {CURRENCIES.map((currency) => (
                    <option key={currency.code} value={currency.code}>
                      {currency.code} — {currency.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Country" htmlFor="business-country">
                <Input
                  id="business-country"
                  value={form.country}
                  onChange={(event) => update("country", event.target.value)}
                  required
                />
              </Field>
              <Field label="City" htmlFor="business-city" optional>
                <Input
                  id="business-city"
                  value={form.city}
                  onChange={(event) => update("city", event.target.value)}
                  placeholder="Nairobi"
                />
              </Field>
              <Field label="Social profiles" htmlFor="business-social" optional hint="One URL per line.">
                <Textarea
                  id="business-social"
                  rows={2}
                  value={toLines(form.socialUrls)}
                  onChange={(event) => update("socialUrls", fromLines(event.target.value))}
                  placeholder="https://instagram.com/…"
                />
              </Field>
            </div>
          </section>

          <div className="border-t border-line pt-6">
            <section className="space-y-4">
              <div>
                <p className="tulivu-label text-gold-deep">The customer</p>
                <h3 className="mt-1 text-lg text-forest">Who the work is for</h3>
              </div>
              <Field
                label="Target customers"
                htmlFor="business-customers"
                hint="Be specific about needs, habits and context. At least 10 characters."
              >
                <Textarea
                  id="business-customers"
                  value={form.targetCustomers}
                  onChange={(event) => update("targetCustomers", event.target.value)}
                  rows={4}
                  placeholder="Women and men aged 20–38 in urban Kenya with sensitive, reactive or acne-prone skin…"
                  required
                />
              </Field>
            </section>
          </div>

          <div className="border-t border-line pt-6">
            <section className="space-y-4">
              <div>
                <p className="tulivu-label text-gold-deep">The brand</p>
                <h3 className="mt-1 text-lg text-forest">Voice, truth and limits</h3>
                <p className="mt-1 text-xs text-muted">
                  Tulivu uses these during copy and creative production. Approved CTAs and banned claims are treated as
                  hard guidance.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Voice" htmlFor="business-voice" optional>
                  <Textarea
                    id="business-voice"
                    rows={3}
                    value={form.brandProfile.voice}
                    onChange={(event) => updateBrand("voice", event.target.value)}
                    placeholder="Calm, specific, quietly confident…"
                  />
                </Field>
                <Field label="Tone" htmlFor="business-tone" optional>
                  <Textarea
                    id="business-tone"
                    rows={3}
                    value={form.brandProfile.tone}
                    onChange={(event) => updateBrand("tone", event.target.value)}
                    placeholder="Warm, plain-spoken, evidence-aware…"
                  />
                </Field>
              </div>

              <Field label="Brand colours" hint="Up to six six-digit hex colours. The first three guide templates.">
                <div className="flex flex-wrap items-center gap-2">
                  {form.brandProfile.colors.map((color, index) => (
                    <div key={`${index}-${color}`} className="flex items-center gap-1 rounded-lg border border-line bg-[#fffdf8] p-1">
                      <input
                        type="color"
                        aria-label={`Brand colour ${index + 1}`}
                        value={color}
                        onChange={(event) => {
                          const next = [...form.brandProfile.colors];
                          next[index] = event.target.value;
                          updateBrand("colors", next);
                        }}
                        className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
                      />
                      <span className="px-1 font-mono text-[9px] uppercase text-muted">{color}</span>
                      {form.brandProfile.colors.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => updateBrand("colors", form.brandProfile.colors.filter((_, item) => item !== index))}
                          className="rounded p-1 text-muted hover:bg-forest/[0.06] hover:text-clay"
                          aria-label={`Remove brand colour ${index + 1}`}
                        >
                          <Trash2 className="h-3 w-3" aria-hidden />
                        </button>
                      ) : null}
                    </div>
                  ))}
                  {form.brandProfile.colors.length < 6 ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => updateBrand("colors", [...form.brandProfile.colors, "#E5E0D5"])}
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden />
                      Add colour
                    </Button>
                  ) : null}
                </div>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Logo URL" htmlFor="business-logo" optional hint="Used for reference. No logo is invented.">
                  <Input
                    id="business-logo"
                    type="url"
                    value={form.brandProfile.logoUrl}
                    onChange={(event) => updateBrand("logoUrl", event.target.value)}
                    placeholder="https://…/logo.svg"
                  />
                </Field>
                <Field label="Approved CTAs" htmlFor="business-ctas" optional hint="One per line.">
                  <Textarea
                    id="business-ctas"
                    rows={2}
                    value={toLines(form.brandProfile.approvedCtas)}
                    onChange={(event) => updateBrand("approvedCtas", fromLines(event.target.value))}
                    placeholder={"Shop the barrier ritual\nFind your routine"}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Unique selling points" htmlFor="business-usps" optional hint="One per line. Only supplied truths.">
                  <Textarea
                    id="business-usps"
                    rows={4}
                    value={toLines(form.brandProfile.usps)}
                    onChange={(event) => updateBrand("usps", fromLines(event.target.value))}
                  />
                </Field>
                <Field label="Banned claims" htmlFor="business-banned" optional hint="One per line. Copy must not use these.">
                  <Textarea
                    id="business-banned"
                    rows={4}
                    value={toLines(form.brandProfile.bannedClaims)}
                    onChange={(event) => updateBrand("bannedClaims", fromLines(event.target.value))}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Competitors" htmlFor="business-competitors" optional hint="One per line.">
                  <Textarea
                    id="business-competitors"
                    rows={3}
                    value={toLines(form.brandProfile.competitors)}
                    onChange={(event) => updateBrand("competitors", fromLines(event.target.value))}
                  />
                </Field>
                <Field label="Brand goals" htmlFor="business-goals" optional>
                  <Textarea
                    id="business-goals"
                    rows={3}
                    value={form.brandProfile.goals}
                    onChange={(event) => updateBrand("goals", event.target.value)}
                    placeholder="Grow first-time orders from Nairobi and Mombasa…"
                  />
                </Field>
              </div>

              <Field label="Existing materials" htmlFor="business-materials" optional>
                <Textarea
                  id="business-materials"
                  rows={2}
                  value={form.brandProfile.existingMaterials}
                  onChange={(event) => updateBrand("existingMaterials", event.target.value)}
                  placeholder="Product photography and ingredient cards exist. No video assets yet."
                />
              </Field>
            </section>
          </div>
        </form>
      )}
    </Modal>
  );
}

export default function BusinessesPage() {
  const businesses = useBusinesses();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  function openCreate() {
    setEditingId(null);
    setFormOpen(true);
  }

  function openEdit(id: string) {
    setEditingId(id);
    setFormOpen(true);
  }

  if (businesses.isLoading) return <PageSkeleton />;

  const list = businesses.data?.businesses ?? [];

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Businesses"
        title="The ground truth."
        description="A campaign can only be as honest as the business profile behind it. Keep these facts current; Tulivu records what is missing."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden />
            Add business
          </Button>
        }
      />

      <Callout tone="info" icon={<Sparkles className="h-4 w-4 text-gold-deep" aria-hidden />}>
        Each demo visitor gets an isolated workspace. Business profiles created here are private to this session and are
        used to ground every campaign artifact.
      </Callout>

      {businesses.isError ? (
        <EmptyState
          title="Businesses could not load"
          description={apiErrorMessage(businesses.error)}
          action={
            <Button onClick={() => void businesses.refetch()}>Try again</Button>
          }
        />
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Building2 className="h-5 w-5" aria-hidden />}
            title="Add the first business"
            description="Start with the facts: what it does, who it serves and how it sounds. The demo workspace usually includes one sample profile."
            action={<Button onClick={openCreate}>Add business</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((business) => (
            <Card key={business.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-forest text-sm font-semibold text-gold">
                    {initials(business.name)}
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-lg leading-tight text-forest">{business.name}</h2>
                    <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                      {business.industry}
                    </p>
                  </div>
                </div>
                <Badge tone="neutral">{business.campaignCount} {business.campaignCount === 1 ? "campaign" : "campaigns"}</Badge>
              </div>

              <p className="mt-4 line-clamp-3 text-[11px] leading-5 text-muted">{business.description}</p>

              <div className="mt-4 space-y-1.5 text-[10px] text-muted">
                <p className="flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                  {[business.city, business.country].filter(Boolean).join(", ")}
                </p>
                {business.websiteUrl ? (
                  <p className="flex min-w-0 items-center gap-1.5">
                    <Globe2 className="h-3 w-3 shrink-0" aria-hidden />
                    <span className="truncate">{business.websiteUrl.replace(/^https?:\/\//, "")}</span>
                  </p>
                ) : null}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-line pt-3.5">
                <BrandSwatches colors={business.brandColors} />
                <span className="text-[9px] text-muted">Updated {formatDate(business.updatedAt)}</span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(business.id)}
                  className={buttonClass({ variant: "secondary", size: "sm", className: "flex-1" })}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                  Edit
                </button>
                <Link
                  to={`/app/campaigns/new?business=${business.id}`}
                  className={buttonClass({ size: "sm", className: "flex-1" })}
                >
                  New campaign
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
            </Card>
          ))}

          <button
            type="button"
            onClick={openCreate}
            className="flex min-h-[260px] flex-col items-center justify-center rounded-[1.25rem] border border-dashed border-forest/20 bg-[#fffdf8]/50 p-6 text-center transition hover:border-forest/40 hover:bg-paper"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-paper text-forest">
              <Plus className="h-5 w-5" aria-hidden />
            </span>
            <span className="mt-3 text-sm font-semibold text-forest">Add another business</span>
            <span className="mt-1 max-w-[220px] text-[10px] leading-4 text-muted">
              Keep separate brands, audiences and voices in their own profiles.
            </span>
          </button>
        </div>
      )}

      <BusinessFormModal open={formOpen} businessId={editingId} onClose={() => setFormOpen(false)} />
    </div>
  );
}
