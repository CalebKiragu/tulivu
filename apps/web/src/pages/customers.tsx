import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, Button, Input } from "@/components/ui";
import { useBusinesses, useCustomers, useCreateCustomer } from "@/lib/queries";

export default function CustomersPage() {
  const businesses = useBusinesses();
  const [businessId, setBusinessId] = useState("");
  const { data, isError, error } = useCustomers(businessId || undefined);
  const create = useCreateCustomer();
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const rows = data?.customers ?? [];

  useEffect(() => {
    const options = businesses.data?.businesses ?? [];
    if (!businessId && options.length > 0) setBusinessId(options[0]!.id);
  }, [businesses.data, businessId]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Client records for one business at a time."
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
      {isError ? <p className="text-sm text-clay">Could not load customers: {error.message}</p> : null}
      {create.error ? <p className="text-sm text-clay">Could not add customer: {create.error.message}</p> : null}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="p-0 overflow-hidden">
          <div className="divide-y divide-line">
            {rows.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted">No customers yet.</p>
            ) : (
              rows.map((customer: any) => (
                <div key={customer.id} className="px-5 py-3">
                  <p className="text-sm font-medium text-ink">{customer.name}</p>
                  <p className="text-xs text-muted">{customer.email || customer.phone || "—"}</p>
                </div>
              ))
            )}
          </div>
        </Card>
        <Card>
          <p className="text-sm font-semibold text-forest">Add customer</p>
          <div className="mt-4 space-y-2">
            <Input placeholder="Full name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            <Input placeholder="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            <Input placeholder="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            <Button
              loading={create.isPending}
              disabled={!form.name || (!businessId && businesses.data?.businesses?.length !== 0)}
              onClick={() =>
                create.mutate(
                  { ...form, ...(businessId ? { businessId } : {}) },
                  { onSuccess: () => setForm({ name: "", email: "", phone: "" }) },
                )
              }
            >
              Add customer
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
