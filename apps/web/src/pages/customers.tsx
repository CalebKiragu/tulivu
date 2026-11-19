import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, Button, Input } from "@/components/ui";
import { useCustomers, useCreateCustomer } from "@/lib/queries";

export default function CustomersPage() {
  const { data } = useCustomers();
  const create = useCreateCustomer();
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const rows = data?.customers || [];
  return (
    <div className="space-y-6">
      <PageHeader title="Customers" description="Client records for your business." />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="p-0 overflow-hidden">
          <div className="divide-y divide-line">
            {rows.length === 0 ? <p className="px-5 py-6 text-sm text-muted">No customers yet.</p> : rows.map((c:any) => (
              <div key={c.id} className="px-5 py-3"><p className="text-sm font-medium text-ink">{c.name}</p><p className="text-xs text-muted">{c.email || c.phone || "—"}</p></div>
            ))}
          </div>
        </Card>
        <Card>
          <p className="text-sm font-semibold text-forest">Add customer</p>
          <div className="mt-4 space-y-2">
            <Input placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Button loading={create.isPending} onClick={() => create.mutate(form, { onSuccess: () => setForm({ name: "", email: "", phone: "" }) })}>Add customer</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
