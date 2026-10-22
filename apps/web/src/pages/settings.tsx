import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BadgeCheck,
  Brain,
  CircuitBoard,
  Database,
  FlaskConical,
  Image as ImageIcon,
  KeyRound,
  RotateCcw,
  Save,
  Server,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { CURRENCIES, formatDate, type CurrencyCode } from "@tulivu/shared";
import { PageHeader, SectionHeading } from "@/components/page-header";
import {
  Badge,
  Button,
  Callout,
  Card,
  Field,
  Input,
  Modal,
  PageSkeleton,
  SectionLabel,
  Select,
} from "@/components/ui";
import { useToast } from "@/components/toast";
import { apiErrorMessage } from "@/lib/api";
import {
  usePlatforms,
  useResetDemo,
  useSettings,
  useUpdateSettings,
} from "@/lib/queries";

function ProviderRow({
  label,
  value,
  detail,
  icon,
  configured,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  configured?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-line bg-[#fffdf8] px-4 py-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest/[0.055] text-forest">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">{label}</p>
          {configured !== undefined ? (
            <Badge tone={configured ? "success" : "gold"}>{configured ? "Configured" : "Demo fallback"}</Badge>
          ) : null}
        </div>
        <p className="mt-1 text-xs font-semibold text-forest">{value}</p>
        <p className="mt-0.5 text-[10px] leading-4 text-muted">{detail}</p>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const settings = useSettings();
  const platforms = usePlatforms();
  const update = useUpdateSettings();
  const reset = useResetDemo();
  const navigate = useNavigate();
  const { push } = useToast();

  const [workspaceLabel, setWorkspaceLabel] = useState("");
  const [defaultCurrency, setDefaultCurrency] = useState<CurrencyCode>("KES");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetWord, setResetWord] = useState("");

  const preferences = settings.data?.preferences ?? {};
  const savedLabel = settings.data?.workspace.name ?? "Demo workspace";
  const savedCurrency = (typeof preferences.defaultCurrency === "string" ? preferences.defaultCurrency : "KES") as CurrencyCode;
  const dirty = workspaceLabel.trim() !== savedLabel || defaultCurrency !== savedCurrency;

  useEffect(() => {
    if (!settings.data) return;
    setWorkspaceLabel(settings.data.workspace.name);
    setDefaultCurrency(
      (typeof settings.data.preferences.defaultCurrency === "string"
        ? settings.data.preferences.defaultCurrency
        : "KES") as CurrencyCode,
    );
  }, [settings.data]);

  if (settings.isLoading) return <PageSkeleton />;

  if (settings.isError || !settings.data) {
    return (
      <Card>
        <div className="p-6 text-center">
          <p className="text-sm font-semibold text-forest">Settings could not load</p>
          <p className="mx-auto mt-1 max-w-md text-[11px] leading-5 text-muted">
            The API did not respond. Check the server and try again.
          </p>
          <Button className="mt-4" onClick={() => void settings.refetch()}>
            Try again
          </Button>
        </div>
      </Card>
    );
  }

  const provider = settings.data.provider;

  async function save() {
    try {
      await update.mutateAsync({
        workspaceLabel: workspaceLabel.trim() || "Demo workspace",
        defaultCurrency,
      });
      push({ title: "Settings saved", description: "Workspace preferences were updated.", tone: "success" });
    } catch (error) {
      push({ title: "Settings were not saved", description: apiErrorMessage(error), tone: "error" });
    }
  }

  async function doReset() {
    try {
      await reset.mutateAsync();
      setResetOpen(false);
      setResetWord("");
      push({
        title: "Demo workspace reset",
        description: "Your isolated workspace was reseeded. Campaigns and activity were replaced.",
        tone: "success",
      });
      navigate("/app/overview");
    } catch (error) {
      push({ title: "The workspace was not reset", description: apiErrorMessage(error), tone: "error" });
    }
  }

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Settings"
        title={
          <>
            Calm defaults, <span className="italic text-leaf">clear boundaries.</span>
          </>
        }
        description="This is a demo workspace. Provider details are read-only here and come from server environment configuration, never from the browser."
      />

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <SectionHeading
              title="Workspace"
              description={`Seeded ${formatDate(settings.data.workspace.createdAt, "datetime")} · isolated to this browser session`}
            />
          </div>
          <div className="space-y-4 p-5">
            <Field label="Workspace label" htmlFor="workspace-label" hint="Shown in the sidebar and on exported packages.">
              <Input
                id="workspace-label"
                value={workspaceLabel}
                onChange={(event) => setWorkspaceLabel(event.target.value)}
                maxLength={80}
                placeholder="Demo workspace"
              />
            </Field>
            <Field label="Default currency" htmlFor="default-currency" hint="Used when creating a new business or campaign.">
              <Select
                id="default-currency"
                value={defaultCurrency}
                onChange={(event) => setDefaultCurrency(event.target.value as CurrencyCode)}
              >
                {CURRENCIES.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.code} · {currency.label}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={save} loading={update.isPending} disabled={!dirty}>
                <Save className="h-3.5 w-3.5" aria-hidden />
                Save preferences
              </Button>
              {dirty ? <span className="text-[10px] font-medium text-gold-deep">Unsaved changes</span> : null}
            </div>

            <div className="rounded-xl border border-line bg-paper/60 px-4 py-3">
              <div className="flex items-center gap-2 text-forest">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                <p className="text-[10px] font-bold uppercase tracking-[0.1em]">Isolation</p>
              </div>
              <p className="mt-1.5 text-[10px] leading-4 text-muted">
                Each visitor gets a separate seeded workspace backed by a signed session cookie. Ownership is checked
                server-side on every request. This is demo authentication, not a login system.
              </p>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <SectionHeading
              title="Providers"
              description="Model-agnostic by design. The mock provider is a first-class path."
            />
          </div>
          <div className="space-y-3 p-5">
            <ProviderRow
              label="Text model"
              value={provider.modelConfigured ? provider.modelName : "Mock provider"}
              detail={`${provider.modelProvider} · ${provider.workflowMode} workflow`}
              icon={<Brain className="h-4 w-4" aria-hidden />}
              configured={provider.modelConfigured}
            />
            <ProviderRow
              label="Image model"
              value={provider.imageProvider}
              detail="Generated imagery is optional. Template creatives always work."
              icon={<ImageIcon className="h-4 w-4" aria-hidden />}
            />
            <ProviderRow
              label="Research"
              value={provider.researchProvider}
              detail="Without a live research provider, audience work is explicitly labelled as hypothesis."
              icon={<CircuitBoard className="h-4 w-4" aria-hidden />}
            />
            <ProviderRow
              label="Ad platform adapter"
              value={provider.adapterMode === "demo" ? "Demo adapter" : "Live adapter"}
              detail={
                provider.adapterMode === "demo"
                  ? "Creates paused simulated records only. No live account is contacted."
                  : "Live adapter selected. Publishing still requires explicit approval and configured credentials."
              }
              icon={<Server className="h-4 w-4" aria-hidden />}
            />
            <ProviderRow
              label="Persistence"
              value={provider.persistence === "postgres" ? "PostgreSQL" : "Embedded PGlite"}
              detail={
                provider.persistence === "postgres"
                  ? "DATABASE_URL is configured. The same schema and migrations are used."
                  : "Local development uses PGlite. Set DATABASE_URL for PostgreSQL."
              }
              icon={<Database className="h-4 w-4" aria-hidden />}
            />
            {Object.keys(provider.taskModels).length > 0 ? (
              <div className="rounded-xl border border-line bg-paper/60 px-4 py-3">
                <SectionLabel>Task profiles</SectionLabel>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Object.entries(provider.taskModels).map(([task, model]) => (
                    <span
                      key={task}
                      className="rounded-full border border-line bg-[#fffdf8] px-2 py-1 text-[9px] font-medium text-ink"
                    >
                      {task}: {model}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            <p className="flex items-start gap-2 px-1 text-[10px] leading-4 text-muted">
              <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              Provider keys live in server environment variables. They are never sent to this page, stored in the
              browser or included in exports.
            </p>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <SectionHeading
            title="Platform capabilities"
            description="What the configured adapter can and cannot do. This is a capability report, not a publishing guarantee."
          />
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          {(platforms.data?.capabilities ?? []).map((capability) => (
            <div key={capability.id} className="rounded-xl border border-line bg-[#fffdf8] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-forest">{capability.label}</p>
                <Badge tone={capability.mode === "demo" ? "gold" : "forest"}>{capability.mode}</Badge>
              </div>
              <ul className="mt-3 space-y-1.5 text-[10px] leading-4 text-muted">
                <li className="flex items-center gap-1.5">
                  <BadgeCheck className={`h-3 w-3 ${capability.supportsDraftCreation ? "text-leaf" : "text-muted/40"}`} aria-hidden />
                  {capability.supportsDraftCreation ? "Creates draft structures" : "No draft creation"}
                </li>
                <li className="flex items-center gap-1.5">
                  <BadgeCheck className={`h-3 w-3 ${capability.supportsPublishing ? "text-leaf" : "text-muted/40"}`} aria-hidden />
                  {capability.supportsPublishing
                    ? capability.mode === "demo"
                      ? "Simulates publish calls only"
                      : "Supports publishing calls"
                    : "Publishing is unavailable"}
                </li>
                <li className="flex items-center gap-1.5">
                  <FlaskConical className={`h-3 w-3 ${capability.createsPausedResources ? "text-gold-deep" : "text-muted/40"}`} aria-hidden />
                  {capability.createsPausedResources ? "Creates paused resources" : "Does not create paused resources"}
                </li>
              </ul>
              {capability.warnings.length > 0 ? (
                <div className="mt-3 space-y-1 border-t border-line pt-2.5">
                  {capability.warnings.map((warning, index) => (
                    <p key={`${warning}-${index}`} className="flex gap-1.5 text-[9px] leading-4 text-[#6d5620]">
                      <TriangleAlert className="mt-0.5 h-2.5 w-2.5 shrink-0" aria-hidden />
                      {warning}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
          {platforms.isLoading ? <p className="text-[11px] text-muted">Loading capabilities…</p> : null}
          {!platforms.isLoading && (platforms.data?.capabilities.length ?? 0) === 0 ? (
            <p className="text-[11px] text-muted">No platform capabilities were reported.</p>
          ) : null}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-clay/20 bg-[#fbf4f0] px-5 py-4">
          <div className="flex items-center gap-2 text-[#743d2b]">
            <TriangleAlert className="h-4 w-4" aria-hidden />
            <h2 className="text-base font-medium">Demo controls</h2>
          </div>
          <p className="mt-1 text-[11px] leading-5 text-[#743d2b]/80">
            Resetting deletes this browser&apos;s seeded workspace and creates a fresh one. Other visitors are not
            affected, and no live data exists to delete.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="text-xs font-semibold text-forest">Reset this demo workspace</p>
            <p className="mt-0.5 text-[10px] leading-4 text-muted">
              Businesses, campaigns, artifacts, assets, approvals and audit events are replaced with the seed.
            </p>
          </div>
          <Button variant="danger" onClick={() => setResetOpen(true)}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Reset demo
          </Button>
        </div>
      </Card>

      <Callout tone="info" icon={<FlaskConical className="h-4 w-4" aria-hidden />} title="What this demo does not do">
        It does not log into Meta or Google, does not spend money, does not create live audiences and does not fabricate
        performance results. Live adapters are stubs that fail safely until real credentials and platform review exist.
      </Callout>

      <Modal
        open={resetOpen}
        onClose={() => {
          setResetOpen(false);
          setResetWord("");
        }}
        title="Reset this workspace?"
        description="This cannot be undone. It only affects your isolated demo session."
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setResetOpen(false);
                setResetWord("");
              }}
              disabled={reset.isPending}
            >
              Keep workspace
            </Button>
            <Button variant="danger" onClick={doReset} loading={reset.isPending} disabled={resetWord.trim().toLowerCase() !== "reset"}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Reset workspace
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Callout tone="danger" icon={<TriangleAlert className="h-4 w-4" aria-hidden />} title="Everything in this demo session is replaced">
            The seeded business, sample campaign, activity and any work you created will be removed.
          </Callout>
          <Field label="Type reset to confirm" htmlFor="reset-confirmation">
            <Input
              id="reset-confirmation"
              value={resetWord}
              onChange={(event) => setResetWord(event.target.value)}
              placeholder="reset"
              autoComplete="off"
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
