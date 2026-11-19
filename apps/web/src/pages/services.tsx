import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, Button, Input } from "@/components/ui";
import { useServices, useCreateService } from "@/lib/queries";

export default function ServicesPage() {
  const { data } = useServices();
  const create = useCreateService();
  const [form, setForm] = useState({ name: "", description: "", durationMinutes: 60, priceCents: 0, category: "General" });
  const rows = data?.services || [];
  return (
    <div className="space-y-6">
      <PageHeader title="Services" description="Treatments and offerings available for booking." />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="p-0 overflow-hidden">
          <div className="divide-y divide-line">
            {rows.length === 0 ? <p className="px-5 py-6 text-sm text-muted">No services yet.</p> : rows.map((s:any) => (
              <div key={s.id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1"><p className="text-sm font-medium text-ink">{s.name}</p><p className="text-xs text-muted">{s.durationMinutes} min · {s.category}</p></div>
                <p className="text-sm font-semibold text-forest">{(s.priceCents/100).toFixed(2)} {s.currency}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <p className="text-sm font-semibold text-forest">Add service</p>
          <div className="mt-4 space-y-2">
            <Input placeholder="Service name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Input type="number" placeholder="Duration (minutes)" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })} />
            <Input type="number" placeholder="Price (cents)" value={form.priceCents} onChange={(e) => setForm({ ...form, priceCents: Number(e.target.value) })} />
            <Button loading={create.isPending} onClick={() => create.mutate(form, { onSuccess: () => setForm({ name: "", description: "", durationMinutes: 60, priceCents: 0, category: "General" }) })}>Add service</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
