import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gt, gte, lt, ne, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../db/client.js";
import {
  bookings,
  bookingItems,
  bookingStatusHistory,
  businessHours,
  businesses,
  customerConsents,
  customers,
  organizations,
  services,
  staffAvailability,
  staffProfiles,
  staffServices,
  timeOff,
} from "../db/schema.js";

export class OperationsError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, code = "operations_error", statusCode = 400) {
    super(message);
    this.name = "OperationsError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

function fail(message: string, code = "operations_error", statusCode = 400): never {
  throw new OperationsError(message, code, statusCode);
}

const isoDate = z.string().refine((value) => !Number.isNaN(Date.parse(value)), "Enter a valid date and time.");
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM.");

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1),
  email: z.union([z.string().email(), z.literal("")]).optional(),
  phone: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(4000).optional(),
  businessId: z.string().uuid().optional(),
});

export const createServiceSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().max(4000).optional(),
  shortDescription: z.string().trim().max(300).optional(),
  durationMinutes: z.number().int().positive().max(24 * 60),
  bufferBeforeMinutes: z.number().int().min(0).max(240).optional(),
  bufferAfterMinutes: z.number().int().min(0).max(240).optional(),
  priceCents: z.number().int().nonnegative(),
  currency: z.string().trim().min(3).max(8).optional(),
  category: z.string().trim().max(80).optional(),
  businessId: z.string().uuid().optional(),
  isActive: z.number().int().min(0).max(1).optional(),
  sortOrder: z.number().int().optional(),
});

export const createStaffSchema = z.object({
  name: z.string().trim().min(1),
  title: z.string().trim().max(120).optional(),
  email: z.union([z.string().email(), z.literal("")]).optional(),
  phone: z.string().trim().max(80).optional(),
  businessId: z.string().uuid().optional(),
  serviceIds: z.array(z.string().uuid()).optional(),
});

export const createBookingSchema = z.object({
  customerId: z.string().uuid(),
  staffId: z.string().uuid(),
  serviceId: z.string().uuid(),
  startsAt: isoDate,
  businessId: z.string().uuid().optional(),
  source: z.enum(["manual", "storefront", "admin"]).optional(),
  customerNote: z.string().trim().max(2000).optional(),
  internalNote: z.string().trim().max(2000).optional(),
  idempotencyKey: z.string().trim().min(8).max(200).optional(),
  status: z.enum(["pending", "confirmed"]).optional(),
});

export const rescheduleBookingSchema = z.object({
  startsAt: isoDate,
  reason: z.string().trim().max(500).optional(),
  idempotencyKey: z.string().trim().min(8).max(200).optional(),
});

export const bookingStatusSchema = z.object({
  status: z.enum(["confirmed", "completed", "cancelled", "no_show"]),
  reason: z.string().trim().max(500).optional(),
});

export const hoursSchema = z.object({
  businessId: z.string().uuid(),
  hours: z.array(
    z.object({
      weekday: z.number().int().min(0).max(6),
      opensAt: hhmm,
      closesAt: hhmm,
      isClosed: z.boolean().optional(),
    }),
  ),
});

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function dateKeyFromParts(parts: { year: number; month: number; day: number }): string {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function zonedParts(date: Date, timeZone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const weekday = WEEKDAYS.indexOf(parts.weekday as (typeof WEEKDAYS)[number]);
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    weekday,
  };
}

function zonedTimeToUtc(dateKey: string, time: string, timeZone: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const target = Date.UTC(year!, month! - 1, day!, hour!, minute!, 0, 0);
  let guess = new Date(target);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = zonedParts(guess, timeZone);
    const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0, 0);
    const diff = asUtc - guess.getTime();
    if (diff === 0) break;
    guess = new Date(guess.getTime() - diff);
  }
  return guess;
}

function minuteOfDay(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour! * 60 + minute!;
}

function hashInt(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return hash;
}

async function resolveBusinessId(db: Database, ownerId: string, requested?: string | null): Promise<string> {
  if (requested) {
    const [row] = await db
      .select({ id: businesses.id })
      .from(businesses)
      .where(and(eq(businesses.id, requested), eq(businesses.ownerId, ownerId)))
      .limit(1);
    if (!row) fail("Business not found for this workspace.", "business_not_found", 404);
    return row.id;
  }
  const [row] = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.ownerId, ownerId))
    .orderBy(asc(businesses.createdAt))
    .limit(1);
  if (!row) fail("Create a business before adding operations records.", "business_required", 400);
  return row.id;
}

async function resolveTimezone(db: Database, ownerId: string): Promise<string> {
  const [row] = await db
    .select({ timezone: organizations.timezone })
    .from(organizations)
    .where(eq(organizations.ownerId, ownerId))
    .limit(1);
  return row?.timezone ?? "Africa/Nairobi";
}

async function assertCustomer(db: Database, ownerId: string, id: string, businessId?: string | null) {
  const [row] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, id), eq(customers.ownerId, ownerId)))
    .limit(1);
  if (!row) fail("Customer not found for this workspace.", "customer_not_found", 404);
  if (businessId && row.businessId && row.businessId !== businessId) {
    fail("Customer belongs to a different business.", "business_mismatch", 400);
  }
  return row;
}

async function assertService(db: Database, ownerId: string, id: string, businessId?: string | null) {
  const [row] = await db
    .select()
    .from(services)
    .where(and(eq(services.id, id), eq(services.ownerId, ownerId)))
    .limit(1);
  if (!row) fail("Service not found for this workspace.", "service_not_found", 404);
  if (businessId && row.businessId && row.businessId !== businessId) {
    fail("Service belongs to a different business.", "business_mismatch", 400);
  }
  if (row.isActive !== 1) fail("That service is not active.", "service_inactive", 409);
  return row;
}

async function assertStaff(db: Database, ownerId: string, id: string, businessId?: string | null) {
  const [row] = await db
    .select()
    .from(staffProfiles)
    .where(and(eq(staffProfiles.id, id), eq(staffProfiles.ownerId, ownerId)))
    .limit(1);
  if (!row) fail("Staff member not found for this workspace.", "staff_not_found", 404);
  if (businessId && row.businessId && row.businessId !== businessId) {
    fail("Staff member belongs to a different business.", "business_mismatch", 400);
  }
  if (row.isActive !== 1) fail("That staff member is not active.", "staff_inactive", 409);
  return row;
}

async function assertStaffService(db: Database, ownerId: string, staffId: string, serviceId: string) {
  const [row] = await db
    .select({ id: staffServices.id })
    .from(staffServices)
    .where(
      and(
        eq(staffServices.ownerId, ownerId),
        eq(staffServices.staffId, staffId),
        eq(staffServices.serviceId, serviceId),
      ),
    )
    .limit(1);
  if (!row) fail("That staff member does not offer the selected service.", "staff_service_mismatch", 400);
}

async function assertSlotAvailable(
  db: Database,
  params: { ownerId: string; businessId: string; staffId: string; startsAt: Date; endsAt: Date; bookingId?: string },
) {
  const timezone = await resolveTimezone(db, params.ownerId);
  const startParts = zonedParts(params.startsAt, timezone);
  const endParts = zonedParts(params.endsAt, timezone);
  if (dateKeyFromParts(startParts) !== dateKeyFromParts(endParts)) {
    fail("Bookings must fit within a single calendar day.", "invalid_slot", 400);
  }

  const startMinute = startParts.hour * 60 + startParts.minute;
  const endMinute = endParts.hour * 60 + endParts.minute;
  const [hoursRow] = await db
    .select()
    .from(businessHours)
    .where(
      and(
        eq(businessHours.ownerId, params.ownerId),
        eq(businessHours.businessId, params.businessId),
        eq(businessHours.weekday, startParts.weekday),
      ),
    )
    .limit(1);
  if (hoursRow?.isClosed === 1) fail("The business is closed on that day.", "business_closed", 409);
  const opensAt = minuteOfDay(hoursRow?.opensAt ?? "09:00");
  const closesAt = minuteOfDay(hoursRow?.closesAt ?? "17:00");
  if (startMinute < opensAt || endMinute > closesAt) {
    fail("The selected time is outside business hours.", "outside_hours", 409);
  }

  const availability = await db
    .select()
    .from(staffAvailability)
    .where(
      and(
        eq(staffAvailability.ownerId, params.ownerId),
        eq(staffAvailability.staffId, params.staffId),
        eq(staffAvailability.weekday, startParts.weekday),
        eq(staffAvailability.isActive, 1),
      ),
    );
  if (availability.length > 0) {
    const fits = availability.some(
      (row) => startMinute >= minuteOfDay(row.startTime) && endMinute <= minuteOfDay(row.endTime),
    );
    if (!fits) fail("The selected time is outside this staff member's availability.", "staff_unavailable", 409);
  }

  const timeOffRows = await db
    .select({ id: timeOff.id })
    .from(timeOff)
    .where(
      and(
        eq(timeOff.ownerId, params.ownerId),
        eq(timeOff.staffId, params.staffId),
        lt(timeOff.startsAt, params.endsAt),
        gt(timeOff.endsAt, params.startsAt),
      ),
    )
    .limit(1);
  if (timeOffRows.length > 0) fail("This staff member is on leave during that time.", "time_off", 409);

  const overlapConditions = [
    eq(bookings.ownerId, params.ownerId),
    eq(bookings.staffId, params.staffId),
    ne(bookings.status, "cancelled"),
    lt(bookings.startsAt, params.endsAt),
    gt(bookings.endsAt, params.startsAt),
  ];
  if (params.bookingId) overlapConditions.push(ne(bookings.id, params.bookingId));
  const overlaps = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(...overlapConditions))
    .limit(1);
  if (overlaps.length > 0) fail("That staff member already has a booking at this time.", "slot_conflict", 409);
}

function uniqueSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50) || "service";
  return `${base}-${randomUUID().slice(0, 8)}`;
}

function makeRef(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let index = 0; index < 6; index += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return `TVL-${out}`;
}

export async function listCustomers(db: Database, ownerId: string, businessId?: string | null) {
  const resolved = businessId ? await resolveBusinessId(db, ownerId, businessId) : null;
  const conditions = [eq(customers.ownerId, ownerId)];
  if (resolved) conditions.push(eq(customers.businessId, resolved));
  return db.select().from(customers).where(and(...conditions)).orderBy(desc(customers.createdAt));
}

export async function createCustomer(
  db: Database,
  ownerId: string,
  input: z.infer<typeof createCustomerSchema>,
) {
  const businessId = await resolveBusinessId(db, ownerId, input.businessId);
  const [row] = await db
    .insert(customers)
    .values({
      id: randomUUID(),
      ownerId,
      businessId,
      name: input.name,
      email: input.email || null,
      phone: input.phone || null,
      notes: input.notes || null,
      isDemo: 0,
    })
    .returning();
  return row;
}

export async function listServices(db: Database, ownerId: string, businessId?: string | null) {
  const resolved = businessId ? await resolveBusinessId(db, ownerId, businessId) : null;
  const conditions = [eq(services.ownerId, ownerId)];
  if (resolved) conditions.push(eq(services.businessId, resolved));
  return db.select().from(services).where(and(...conditions)).orderBy(asc(services.sortOrder));
}

export async function createService(db: Database, ownerId: string, input: z.infer<typeof createServiceSchema>) {
  const businessId = await resolveBusinessId(db, ownerId, input.businessId);
  const [row] = await db
    .insert(services)
    .values({
      id: randomUUID(),
      ownerId,
      businessId,
      slug: uniqueSlug(input.name),
      name: input.name,
      shortDescription: input.shortDescription ?? input.description ?? "",
      description: input.description ?? "",
      durationMinutes: input.durationMinutes,
      bufferBeforeMinutes: input.bufferBeforeMinutes ?? 10,
      bufferAfterMinutes: input.bufferAfterMinutes ?? 10,
      priceCents: input.priceCents,
      currency: input.currency ?? "KES",
      category: input.category ?? "General",
      isActive: input.isActive ?? 1,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning();
  return row;
}

export async function listStaff(db: Database, ownerId: string, businessId?: string | null) {
  const resolved = businessId ? await resolveBusinessId(db, ownerId, businessId) : null;
  const conditions = [eq(staffProfiles.ownerId, ownerId)];
  if (resolved) conditions.push(eq(staffProfiles.businessId, resolved));
  return db.select().from(staffProfiles).where(and(...conditions)).orderBy(asc(staffProfiles.sortOrder));
}

export async function createStaff(db: Database, ownerId: string, input: z.infer<typeof createStaffSchema>) {
  const businessId = await resolveBusinessId(db, ownerId, input.businessId);
  if (input.serviceIds?.length) {
    for (const serviceId of input.serviceIds) await assertService(db, ownerId, serviceId, businessId);
  }
  const staffId = randomUUID();
  await db.transaction(async (tx) => {
    const t = tx as unknown as Database;
    await t.insert(staffProfiles).values({
      id: staffId,
      ownerId,
      businessId,
      name: input.name,
      title: input.title ?? "Therapist",
      bio: "",
      email: input.email || null,
      phone: input.phone || null,
      isActive: 1,
      sortOrder: 0,
      color: "#244D40",
    });
    if (input.serviceIds?.length) {
      await t.insert(staffServices).values(
        input.serviceIds.map((serviceId) => ({
          id: randomUUID(),
          ownerId,
          staffId,
          serviceId,
        })),
      );
    }
  });
  const [row] = await db.select().from(staffProfiles).where(eq(staffProfiles.id, staffId)).limit(1);
  return row;
}

export interface BookingFilters {
  businessId?: string | null;
  status?: string;
  from?: string;
  to?: string;
}

export async function listBookings(db: Database, ownerId: string, filters: BookingFilters = {}) {
  const resolvedBusiness = filters.businessId ? await resolveBusinessId(db, ownerId, filters.businessId) : null;
  const from = filters.from && !Number.isNaN(Date.parse(filters.from)) ? new Date(filters.from) : null;
  const to = filters.to && !Number.isNaN(Date.parse(filters.to)) ? new Date(filters.to) : null;
  const conditions = [
    eq(bookings.ownerId, ownerId),
    eq(customers.ownerId, ownerId),
    eq(services.ownerId, ownerId),
    eq(staffProfiles.ownerId, ownerId),
  ];
  if (resolvedBusiness) conditions.push(eq(bookings.businessId, resolvedBusiness));
  if (filters.status) conditions.push(eq(bookings.status, filters.status));
  if (from) conditions.push(gte(bookings.startsAt, from));
  if (to) conditions.push(lt(bookings.startsAt, to));
  return db
    .select({ booking: bookings, customer: customers, service: services, staff: staffProfiles })
    .from(bookings)
    .innerJoin(customers, eq(customers.id, bookings.customerId))
    .innerJoin(services, eq(services.id, bookings.serviceId))
    .innerJoin(staffProfiles, eq(staffProfiles.id, bookings.staffId))
    .where(and(...conditions))
    .orderBy(desc(bookings.startsAt));
}

export async function getCalendar(
  db: Database,
  ownerId: string,
  dateKey: string,
  businessId?: string | null,
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || Number.isNaN(Date.parse(`${dateKey}T00:00:00Z`))) {
    fail("Enter a valid calendar date.", "invalid_date", 400);
  }
  const timezone = await resolveTimezone(db, ownerId);
  const start = zonedTimeToUtc(dateKey, "00:00", timezone);
  const next = new Date(Date.parse(`${dateKey}T00:00:00Z`) + 24 * 60 * 60 * 1000);
  const nextKey = next.toISOString().slice(0, 10);
  const end = zonedTimeToUtc(nextKey, "00:00", timezone);
  const resolvedBusiness = businessId ? await resolveBusinessId(db, ownerId, businessId) : null;
  const conditions = [
    eq(bookings.ownerId, ownerId),
    eq(customers.ownerId, ownerId),
    eq(services.ownerId, ownerId),
    eq(staffProfiles.ownerId, ownerId),
    gte(bookings.startsAt, start),
    lt(bookings.startsAt, end),
  ];
  if (resolvedBusiness) conditions.push(eq(bookings.businessId, resolvedBusiness));
  return db
    .select({ booking: bookings, customer: customers, service: services, staff: staffProfiles })
    .from(bookings)
    .innerJoin(customers, eq(customers.id, bookings.customerId))
    .innerJoin(services, eq(services.id, bookings.serviceId))
    .innerJoin(staffProfiles, eq(staffProfiles.id, bookings.staffId))
    .where(and(...conditions))
    .orderBy(asc(bookings.startsAt));
}

export async function listBusinessHours(db: Database, ownerId: string, businessId?: string | null) {
  const resolved = businessId ? await resolveBusinessId(db, ownerId, businessId) : null;
  const conditions = [eq(businessHours.ownerId, ownerId)];
  if (resolved) conditions.push(eq(businessHours.businessId, resolved));
  return db.select().from(businessHours).where(and(...conditions)).orderBy(asc(businessHours.weekday));
}

export async function saveBusinessHours(
  db: Database,
  ownerId: string,
  input: z.infer<typeof hoursSchema>,
) {
  const businessId = await resolveBusinessId(db, ownerId, input.businessId);
  await db.transaction(async (tx) => {
    const t = tx as unknown as Database;
    await t
      .delete(businessHours)
      .where(and(eq(businessHours.ownerId, ownerId), eq(businessHours.businessId, businessId)));
    if (input.hours.length > 0) {
      await t.insert(businessHours).values(
        input.hours.map((hour) => ({
          id: randomUUID(),
          ownerId,
          businessId,
          weekday: hour.weekday,
          opensAt: hour.opensAt,
          closesAt: hour.closesAt,
          isClosed: hour.isClosed ? 1 : 0,
        })),
      );
    }
  });
  return listBusinessHours(db, ownerId, businessId);
}

interface BookingResult {
  booking: typeof bookings.$inferSelect;
  replayed: boolean;
}

export async function createBooking(
  db: Database,
  ownerId: string,
  input: z.infer<typeof createBookingSchema>,
): Promise<BookingResult> {
  const startsAt = new Date(input.startsAt);
  if (input.idempotencyKey) {
    const [existing] = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.ownerId, ownerId), eq(bookings.idempotencyKey, input.idempotencyKey)))
      .limit(1);
    if (existing) return { booking: existing, replayed: true };
  }

  const customer = await assertCustomer(db, ownerId, input.customerId, input.businessId);
  const service = await assertService(db, ownerId, input.serviceId, input.businessId);
  const staff = await assertStaff(db, ownerId, input.staffId, input.businessId);
  if (!service.businessId) fail("The selected service is not linked to a business.", "business_required", 400);
  if (customer.businessId && customer.businessId !== service.businessId) {
    fail("Customer belongs to a different business.", "business_mismatch", 400);
  }
  if (staff.businessId && staff.businessId !== service.businessId) {
    fail("Staff member belongs to a different business.", "business_mismatch", 400);
  }
  await assertStaffService(db, ownerId, staff.id, service.id);

  const totalMinutes = service.bufferBeforeMinutes + service.durationMinutes + service.bufferAfterMinutes;
  const endsAt = new Date(startsAt.getTime() + totalMinutes * 60_000);
  const status = input.status ?? "confirmed";

  return db.transaction(async (tx) => {
    const t = tx as unknown as Database;
    await t.execute(sql`select pg_advisory_xact_lock(${hashInt(staff.id)}::bigint)`);
    await assertSlotAvailable(t, {
      ownerId,
      businessId: service.businessId!,
      staffId: staff.id,
      startsAt,
      endsAt,
    });

    const bookingId = randomUUID();
    try {
      await t.insert(bookings).values({
        id: bookingId,
        ownerId,
        businessId: service.businessId!,
        reference: makeRef(),
        customerId: customer.id,
        staffId: staff.id,
        serviceId: service.id,
        startsAt,
        endsAt,
        status,
        source: input.source ?? "manual",
        priceCents: service.priceCents,
        currency: service.currency,
        customerNote: input.customerNote ?? null,
        internalNote: input.internalNote ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        isDemo: 0,
      });
      await t.insert(bookingItems).values({
        id: randomUUID(),
        ownerId,
        bookingId,
        serviceId: service.id,
        name: service.name,
        durationMinutes: service.durationMinutes,
        priceCents: service.priceCents,
      });
      await t.insert(bookingStatusHistory).values({
        id: randomUUID(),
        ownerId,
        bookingId,
        fromStatus: null,
        toStatus: status,
        reason: "Booking created",
      });
    } catch (error) {
      if (input.idempotencyKey && (error as { code?: string }).code === "23505") {
        const [existing] = await t
          .select()
          .from(bookings)
          .where(and(eq(bookings.ownerId, ownerId), eq(bookings.idempotencyKey, input.idempotencyKey)))
          .limit(1);
        if (existing) return { booking: existing, replayed: true };
      }
      throw error;
    }
    const [booking] = await t.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
    return { booking: booking!, replayed: false };
  });
}

export async function rescheduleBooking(
  db: Database,
  ownerId: string,
  bookingId: string,
  input: z.infer<typeof rescheduleBookingSchema>,
): Promise<BookingResult> {
  if (input.idempotencyKey) {
    const [existing] = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.ownerId, ownerId), eq(bookings.idempotencyKey, input.idempotencyKey)))
      .limit(1);
    if (existing && existing.id !== bookingId) return { booking: existing, replayed: true };
  }

  const [booking] = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.id, bookingId), eq(bookings.ownerId, ownerId)))
    .limit(1);
  if (!booking) fail("Booking not found for this workspace.", "booking_not_found", 404);
  if (booking.status === "cancelled" || booking.status === "completed") {
    fail("A finished booking cannot be rescheduled.", "invalid_transition", 409);
  }
  const service = await assertService(db, ownerId, booking.serviceId);
  if (!service.businessId) fail("The booking service is not linked to a business.", "business_required", 400);
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(
    startsAt.getTime() + (service.bufferBeforeMinutes + service.durationMinutes + service.bufferAfterMinutes) * 60_000,
  );

  return db.transaction(async (tx) => {
    const t = tx as unknown as Database;
    await t.execute(sql`select pg_advisory_xact_lock(${hashInt(booking.staffId)}::bigint)`);
    await assertSlotAvailable(t, {
      ownerId,
      businessId: service.businessId!,
      staffId: booking.staffId,
      startsAt,
      endsAt,
      bookingId: booking.id,
    });
    await t
      .update(bookings)
      .set({ startsAt, endsAt, updatedAt: new Date() })
      .where(eq(bookings.id, booking.id));
    await t.insert(bookingStatusHistory).values({
      id: randomUUID(),
      ownerId,
      bookingId: booking.id,
      fromStatus: booking.startsAt.toISOString(),
      toStatus: booking.status,
      reason: input.reason ? `Rescheduled: ${input.reason}` : "Rescheduled",
    });
    const [updated] = await t.select().from(bookings).where(eq(bookings.id, booking.id)).limit(1);
    return { booking: updated!, replayed: false };
  });
}

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled", "no_show"],
  no_show: [],
  completed: [],
  cancelled: [],
};

export async function updateBookingStatus(
  db: Database,
  ownerId: string,
  bookingId: string,
  input: z.infer<typeof bookingStatusSchema>,
): Promise<BookingResult> {
  const [booking] = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.id, bookingId), eq(bookings.ownerId, ownerId)))
    .limit(1);
  if (!booking) fail("Booking not found for this workspace.", "booking_not_found", 404);
  if (booking.status === input.status) return { booking, replayed: true };
  if (!ALLOWED_TRANSITIONS[booking.status]?.includes(input.status)) {
    fail(`Cannot change status from ${booking.status} to ${input.status}.`, "invalid_transition", 409);
  }

  await db.transaction(async (tx) => {
    const t = tx as unknown as Database;
    await t
      .update(bookings)
      .set({ status: input.status, updatedAt: new Date() })
      .where(eq(bookings.id, booking.id));
    await t.insert(bookingStatusHistory).values({
      id: randomUUID(),
      ownerId,
      bookingId: booking.id,
      fromStatus: booking.status,
      toStatus: input.status,
      reason: input.reason ?? null,
    });
  });
  const [updated] = await db.select().from(bookings).where(eq(bookings.id, booking.id)).limit(1);
  return { booking: updated!, replayed: false };
}

export async function listBookingStatusHistory(db: Database, ownerId: string, bookingId: string) {
  const [booking] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(eq(bookings.id, bookingId), eq(bookings.ownerId, ownerId)))
    .limit(1);
  if (!booking) fail("Booking not found for this workspace.", "booking_not_found", 404);
  return db
    .select()
    .from(bookingStatusHistory)
    .where(and(eq(bookingStatusHistory.ownerId, ownerId), eq(bookingStatusHistory.bookingId, bookingId)))
    .orderBy(asc(bookingStatusHistory.createdAt));
}

export async function recordConsent(
  db: Database,
  ownerId: string,
  input: { customerId: string; type: string; granted: boolean; source?: string },
) {
  await assertCustomer(db, ownerId, input.customerId);
  await db
    .insert(customerConsents)
    .values({
      id: randomUUID(),
      ownerId,
      customerId: input.customerId,
      type: input.type,
      granted: input.granted ? 1 : 0,
      source: input.source ?? "booking",
    })
    .onConflictDoNothing();
}

export async function seedDemoOperations(db: Database, ownerId: string, businessId?: string | null) {
  const existing = await db.select({ id: services.id }).from(services).where(eq(services.ownerId, ownerId)).limit(1);
  if (existing.length > 0) return;

  const resolvedBusiness = businessId ?? (await resolveBusinessId(db, ownerId));
  const deepTissueId = randomUUID();
  const facialId = randomUUID();
  await db.insert(services).values([
    {
      id: deepTissueId,
      ownerId,
      businessId: resolvedBusiness,
      slug: `deep-tissue-massage-${randomUUID().slice(0, 6)}`,
      name: "Deep Tissue Massage",
      shortDescription: "Focused muscle relief",
      description: "Deep tissue massage to release tension and knots.",
      durationMinutes: 60,
      bufferBeforeMinutes: 10,
      bufferAfterMinutes: 10,
      priceCents: 450000,
      currency: "KES",
      category: "Massage",
      isActive: 1,
      sortOrder: 0,
    },
    {
      id: facialId,
      ownerId,
      businessId: resolvedBusiness,
      slug: `aromatherapy-facial-${randomUUID().slice(0, 6)}`,
      name: "Aromatherapy Facial",
      shortDescription: "Rejuvenating facial",
      description: "Gentle cleansing, exfoliation, and aromatherapy massage.",
      durationMinutes: 45,
      bufferBeforeMinutes: 5,
      bufferAfterMinutes: 5,
      priceCents: 380000,
      currency: "KES",
      category: "Facial",
      isActive: 1,
      sortOrder: 1,
    },
  ]);

  const staffId = randomUUID();
  await db.insert(staffProfiles).values({
    id: staffId,
    ownerId,
    businessId: resolvedBusiness,
    name: "Amani Wanjiru",
    title: "Lead Therapist",
    bio: "Specialist in therapeutic massage.",
    isActive: 1,
    sortOrder: 0,
    color: "#244D40",
  });
  await db.insert(staffServices).values([
    { id: randomUUID(), ownerId, staffId, serviceId: deepTissueId },
    { id: randomUUID(), ownerId, staffId, serviceId: facialId },
  ]);

  await db.insert(customers).values({
    id: randomUUID(),
    ownerId,
    businessId: resolvedBusiness,
    name: "Zawadi Mwangi",
    email: "zawadi@example.com",
    phone: "+254700000000",
    isDemo: 1,
  });

  await db.insert(businessHours).values(
    Array.from({ length: 7 }, (_, weekday) => ({
      id: randomUUID(),
      ownerId,
      businessId: resolvedBusiness,
      weekday,
      opensAt: "09:00",
      closesAt: "17:00",
      isClosed: weekday === 0 ? 1 : 0,
    })),
  );
}
