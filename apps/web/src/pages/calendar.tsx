import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, Button, Badge } from "@/components/ui";
import {
  useBusinesses,
  useCalendar,
  useStaff,
  useServices,
  useCustomers,
  useCreateBooking,
} from "@/lib/queries";
import type { OpsBookingInput } from "@/lib/api";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export default function CalendarPage() {
  const [date, setDate] = useState(todayKey());
  const [businessId, setBusinessId] = useState("");
  const businesses = useBusinesses();
  const cal = useCalendar(date, businessId || undefined);
  const staff = useStaff(businessId || undefined);
  const services = useServices(businessId || undefined);
  const customers = useCustomers(businessId || undefined);
  const createBooking = useCreateBooking();
  const [form, setForm] = useState({ customerId: "", staffId: "", serviceId: "", startsAt: `${todayKey()}T09:00` });

  useEffect(() => {
    const rows = businesses.data?.businesses ?? [];
    if (!businessId && rows.length > 0) setBusinessId(rows[0]!.id);
  }, [businesses.data, businessId]);

  const items = cal.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description="Day view of appointments, scoped to one business."
        actions={
          <div className="flex gap-2">
            <select
              className="tulivu-input h-9 w-auto"
              value={businessId}
              onChange={(event) => setBusinessId(event.target.value)}
            >
              {(businesses.data?.businesses ?? []).map((business) => (
                <option key={business.id} value={business.id}>{business.name}</option>
              ))}
            </select>
            <input
              type="date"
              value={date}
              onChange={(event) => {
                setForm((current) => ({ ...current, startsAt: `${event.target.value}T09:00` }));
                setDate(event.target.value);
              }}
              className="tulivu-input h-9 w-auto"
            />
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="p-0 overflow-hidden">
          <div className="border-b border-line px-5 py-3"><p className="text-sm font-semibold text-forest">Appointments</p></div>
          <div className="divide-y divide-line">
            {items.length === 0 ? <p className="px-5 py-6 text-sm text-muted">No appointments for this day.</p> : items.map((item) => (
              <div key={item.booking.id} className="flex items-center gap-4 px-5 py-3">
                <div className="w-16 text-right">
                  <p className="text-xs font-semibold text-ink">
                    {new Date(item.booking.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-ink">{item.customer.name} · {item.service.name}</p>
                  <p className="text-xs text-muted">{item.staff.name}</p>
                </div>
                <Badge tone={item.booking.status === "confirmed" ? "success" : "neutral"}>{item.booking.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <p className="text-sm font-semibold text-forest">New booking</p>
          <p className="mt-1 text-xs text-muted">Duration and price come from the selected service.</p>
          <div className="mt-4 space-y-3">
            <select className="tulivu-input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">Select client</option>
              {(customers.data?.customers ?? []).map((customer) => (
                <option key={customer.id} value={customer.id}>{customer.name}</option>
              ))}
            </select>
            <select className="tulivu-input" value={form.serviceId} onChange={(e) => setForm({ ...form, serviceId: e.target.value })}>
              <option value="">Select service</option>
              {(services.data?.services ?? []).map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} ({service.durationMinutes}m · {(service.priceCents / 100).toFixed(2)} {service.currency})
                </option>
              ))}
            </select>
            <select className="tulivu-input" value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })}>
              <option value="">Select staff</option>
              {(staff.data?.staff ?? []).map((member) => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </select>
            <input
              type="datetime-local"
              className="tulivu-input"
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
            />
            {createBooking.error && <p className="text-xs text-red-600">{createBooking.error.message}</p>}
            <Button
              loading={createBooking.isPending}
              disabled={!businessId}
              onClick={() => {
                if (!form.customerId || !form.staffId || !form.serviceId || !businessId) return;
                const input: OpsBookingInput = {
                  customerId: form.customerId,
                  staffId: form.staffId,
                  serviceId: form.serviceId,
                  startsAt: new Date(form.startsAt).toISOString(),
                  businessId,
                  source: "admin",
                  idempotencyKey: crypto.randomUUID(),
                };
                createBooking.mutate(input, {
                  onSuccess: () => setForm({ customerId: "", staffId: "", serviceId: "", startsAt: `${date}T09:00` }),
                });
              }}
            >
              Create booking
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
