import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, Button, Input } from "@/components/ui";
import { useBusinesses, useStaff, useCreateStaff, useHours, useSaveHours } from "@/lib/queries";
import type { OpsHours, OpsStaff } from "@/lib/api";

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface HoursForm {
  weekday: number;
  opensAt: string;
  closesAt: string;
  isClosed: boolean;
}

const defaultHours = (): HoursForm[] =>
  Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    opensAt: "09:00",
    closesAt: "17:00",
    isClosed: weekday === 0,
  }));

export default function TeamPage() {
  const businesses = useBusinesses();
  const [businessId, setBusinessId] = useState("");
  const staff = useStaff(businessId || undefined);
  const create = useCreateStaff();
  const hours = useHours(businessId || undefined);
  const save = useSaveHours();
  const [form, setForm] = useState({ name: "", title: "Therapist", email: "" });
  const [hourRows, setHourRows] = useState<HoursForm[]>(defaultHours);

  useEffect(() => {
    const rows = businesses.data?.businesses ?? [];
    if (!businessId && rows.length > 0) setBusinessId(rows[0]!.id);
  }, [businesses.data, businessId]);

  useEffect(() => {
    const rows = hours.data?.hours ?? [];
    if (rows.length === 0) return;
    setHourRows(
      days.map((_, weekday) => {
        const row = rows.find((item: OpsHours) => item.weekday === weekday);
        return {
          weekday,
          opensAt: row?.opensAt ?? "09:00",
          closesAt: row?.closesAt ?? "17:00",
          isClosed: row?.isClosed === 1,
        };
      }),
    );
  }, [hours.data]);

  const staffRows = (staff.data?.staff ?? []) as OpsStaff[];

  return (
    <div className="space-y-6">
      <PageHeader title="Team & Hours" description="Manage staff and business hours for one business at a time." />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <label className="text-sm font-semibold text-forest" htmlFor="team-business">Business</label>
            <select
              id="team-business"
              className="tulivu-input mt-2"
              value={businessId}
              onChange={(event) => setBusinessId(event.target.value)}
            >
              {(businesses.data?.businesses ?? []).map((business) => (
                <option key={business.id} value={business.id}>{business.name}</option>
              ))}
            </select>
          </Card>
          <Card className="p-0 overflow-hidden">
            <div className="border-b border-line px-5 py-3"><p className="text-sm font-semibold text-forest">Team</p></div>
            <div className="divide-y divide-line">
              {staffRows.length === 0 ? <p className="px-5 py-6 text-sm text-muted">No staff yet.</p> : staffRows.map((member) => (
                <div key={member.id} className="px-5 py-3">
                  <p className="text-sm font-medium text-ink">{member.name}</p>
                  <p className="text-xs text-muted">{member.title}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <p className="text-sm font-semibold text-forest">Business hours</p>
            <div className="mt-4 space-y-2">
              {hourRows.map((day, index) => (
                <div key={day.weekday} className="grid grid-cols-[60px_1fr_1fr_80px] items-center gap-2">
                  <p className="text-xs text-muted">{days[day.weekday]}</p>
                  <input
                    className="tulivu-input"
                    type="time"
                    value={day.opensAt}
                    disabled={day.isClosed}
                    onChange={(event) => {
                      const next = [...hourRows];
                      next[index] = { ...day, opensAt: event.target.value };
                      setHourRows(next);
                    }}
                  />
                  <input
                    className="tulivu-input"
                    type="time"
                    value={day.closesAt}
                    disabled={day.isClosed}
                    onChange={(event) => {
                      const next = [...hourRows];
                      next[index] = { ...day, closesAt: event.target.value };
                      setHourRows(next);
                    }}
                  />
                  <label className="flex items-center gap-1 text-xs text-muted">
                    <input
                      type="checkbox"
                      checked={day.isClosed}
                      onChange={(event) => {
                        const next = [...hourRows];
                        next[index] = { ...day, isClosed: event.target.checked };
                        setHourRows(next);
                      }}
                    />
                    Closed
                  </label>
                </div>
              ))}
            </div>
            {(save.error || create.error) && (
              <p className="mt-3 text-xs text-red-600">
                {save.error?.message ?? create.error?.message}
              </p>
            )}
            <Button
              className="mt-4"
              loading={save.isPending}
              disabled={!businessId}
              onClick={() => {
                if (!businessId) return;
                save.mutate({ businessId, hours: hourRows });
              }}
            >
              Save hours
            </Button>
          </Card>
        </div>
        <Card>
          <p className="text-sm font-semibold text-forest">Add staff</p>
          <div className="mt-4 space-y-2">
            <Input placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Button
              loading={create.isPending}
              disabled={!businessId}
              onClick={() => create.mutate({ ...form, businessId }, { onSuccess: () => setForm({ name: "", title: "Therapist", email: "" }) })}
            >
              Add staff
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
