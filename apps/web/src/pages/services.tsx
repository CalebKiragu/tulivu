import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, Button, Input } from "@/components/ui";
import { useBusinesses, useServices, useCreateService } from "@/lib/queries";

export default function ServicesPage() {
  const businesses = useBusinesses();
  const [businessId, setBusinessId] = useState("");
  const { data, isError, error } = useServices(businessId || undefined);
  const create = useCreateService();
  const [form, setForm] = useState({
    name: "",
    description: "",
    durationMinutes: 60,
    priceCents: 0,
    category: "General",
  });
  const rows = data?.services ?? [];

  useEffect(() => {
    const options = businesses.data?.businesses ?? [];
    if (!businessId && options.length > 0) setBusinessId(options[0]!.id);
  }, [businesses.data, businessId]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Services"
        description="Treatments and offerings available for booking."
        actions={
          <select
            aria-label="Filter by business"
            className="tulivu-input h-9 w-auto"
            value={businessId}
            onChange={(event) => setBusinessId(event.target.value)}
          >
            <option value="">All businesses</option>
            {(businesses.data?.businesses ?? []).map((business) => (
              <option key={business.id} value={business.id}>{business.name}</option>
            ))}
          </select>
        }
      />
      {isError ? <p className="text-sm text-clay">Could not load services: {error.message}</p> : null}
      {create.error ? <p className="text-sm text-clay">Could not add service: {create.error.message}</p> : null}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="p-0 overflow-hidden">
          <div className="divide-y divide-line">
            {rows.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted">No services yet.</p>
            ) : (
              rows.map((service: any) => (
                <div key={service.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-ink">{service.name}</p>
                    <p className="text-xs text-muted">{service.durationMinutes}m · {service.category || "General"}</p>
                  </div>
                  <span className="text-xs font-semibold text-forest">
                    {(service.priceCents / 100).toFixed(2)} {service.currency}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
        <Card>
          <p className="text-sm font-semibold text-forest">Add service</p>
          <div className="mt-4 space-y-2">
            <Input placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            <Input
              placeholder="Description"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                min={15}
                step={15}
                aria-label="Duration in minutes"
                value={form.durationMinutes}
                onChange={(event) => setForm({ ...form, durationMinutes: Number(event.target.value) })}
              />
              <Input
                type="number"
                min={0}
                step={50}
                aria-label="Price in cents"
                value={form.priceCents}
                onChange={(event) => setForm({ ...form, priceCents: Number(event.target.value) })}
              />
            </div>
            <Input placeholder="Category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
            <Button
              loading={create.isPending}
              disabled={!form.name || form.durationMinutes <= 0 || (!businessId && (businesses.data?.businesses?.length ?? 0) > 0)}
              onClick={() =>
                create.mutate(
                  {
                    ...form,
                    ...(businessId ? { businessId } : {}),
                  },
                  {
                    onSuccess: () =>
                      setForm({ name: "", description: "", durationMinutes: 60, priceCents: 0, category: "General" }),
                  },
                )
              }
            >
              Add service
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
