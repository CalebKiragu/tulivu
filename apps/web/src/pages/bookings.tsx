import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, Badge } from "@/components/ui";
import { useBookings, useBusinesses, useCancelBooking } from "@/lib/queries";
import type { OpsBooking } from "@/lib/api";

export default function BookingsPage() {
  const businesses = useBusinesses();
  const [businessId, setBusinessId] = useState("");
  const cancel = useCancelBooking();
  const { data, isError, error } = useBookings(businessId ? { businessId } : {});
  const rows = (data?.bookings ?? []) as OpsBooking[];

  useEffect(() => {
    const options = businesses.data?.businesses ?? [];
    if (!businessId && options.length > 0) setBusinessId(options[0]!.id);
  }, [businesses.data, businessId]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bookings"
        description="All appointments across your workspace."
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
      {isError ? <p className="text-sm text-clay">Could not load bookings: {error.message}</p> : null}
      {cancel.error ? <p className="text-sm text-clay">Could not cancel booking: {cancel.error.message}</p> : null}
      <Card className="p-0 overflow-hidden">
        <div className="divide-y divide-line">
          {rows.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted">No bookings yet.</p>
          ) : (
            rows.map((booking) => (
              <div key={booking.id} className="flex items-center gap-4 px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-ink">{booking.reference}</p>
                  <p className="text-xs text-muted">
                    {new Date(booking.startsAt).toLocaleString()} · {formatMoney(booking.priceCents, booking.currency)}
                  </p>
                </div>
                <Badge tone={booking.status === "confirmed" ? "success" : "neutral"}>{booking.status}</Badge>
                {booking.status !== "cancelled" && booking.status !== "completed" ? (
                  <button
                    type="button"
                    className="ml-auto text-xs font-semibold text-clay hover:underline disabled:opacity-50"
                    disabled={cancel.isPending}
                    onClick={() => cancel.mutate({ bookingId: booking.id, reason: "Cancelled from dashboard" })}
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

function formatMoney(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}
