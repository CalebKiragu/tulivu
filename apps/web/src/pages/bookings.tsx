import { PageHeader } from "@/components/page-header";
import { Card, Badge } from "@/components/ui";
import { useBookings } from "@/lib/queries";

export default function BookingsPage() {
  const { data } = useBookings();
  const rows = data?.bookings || [];
  return (
    <div className="space-y-6">
      <PageHeader title="Bookings" description="All appointments across your workspace." />
      <Card className="p-0 overflow-hidden">
        <div className="divide-y divide-line">
          {rows.length === 0 ? <p className="px-5 py-6 text-sm text-muted">No bookings yet.</p> : rows.map((r:any) => (
            <div key={r.booking.id} className="flex items-center gap-4 px-5 py-3">
              <div><p className="text-sm font-medium text-ink">{r.customer.name}</p><p className="text-xs text-muted">{r.booking.reference} · {r.service.name}</p></div>
              <div className="ml-auto text-right"><p className="text-xs text-ink">{new Date(r.booking.startsAt).toLocaleString()}</p><p className="text-xs text-muted">{r.staff.name}</p></div>
              <Badge tone={r.booking.status === 'confirmed' ? 'success' : r.booking.status === 'cancelled' ? 'danger' : 'neutral'}>{r.booking.status}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
