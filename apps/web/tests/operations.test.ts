import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestHarness, SessionClient, bodyOf, type TestHarness } from "./helpers/app.js";

interface ServiceRecord {
  id: string;
  businessId: string | null;
  name: string;
  durationMinutes: number;
  priceCents: number;
  currency: string;
}

interface StaffRecord {
  id: string;
  businessId: string | null;
  name: string;
}

interface CustomerRecord {
  id: string;
  businessId: string | null;
  name: string;
}

interface BookingRecord {
  id: string;
  businessId: string | null;
  customerId: string;
  staffId: string;
  serviceId: string;
  startsAt: string;
  endsAt: string;
  status: string;
  priceCents: number;
  currency: string;
  isDemo: number;
  reference: string;
}

let harnessA: TestHarness;
let harnessB: TestHarness;
let clientA: SessionClient;
let clientB: SessionClient;
let serviceA: ServiceRecord;
let staffA: StaffRecord;
let customerA: CustomerRecord;
let serviceB: ServiceRecord;
let staffB: StaffRecord;
let customerB: CustomerRecord;

const mondayMorning = "2026-11-23T09:00:00+03:00";

function bookingPayload(overrides: Record<string, unknown> = {}) {
  return {
    customerId: customerA.id,
    staffId: staffA.id,
    serviceId: serviceA.id,
    startsAt: mondayMorning,
    priceCents: 1,
    durationMinutes: 5,
    ...overrides,
  };
}

async function setupWorkspace(client: SessionClient) {
  await client.get("/api/overview");
  const services = bodyOf<{ services: ServiceRecord[] }>(await client.get("/api/operations/services")).services;
  const staff = bodyOf<{ staff: StaffRecord[] }>(await client.get("/api/operations/staff")).staff;
  const customers = bodyOf<{ customers: CustomerRecord[] }>(await client.get("/api/operations/customers")).customers;
  const service = services.find((row) => row.name === "Deep Tissue Massage")!;
  const businessId = service.businessId!;
  await client.put("/api/operations/hours", {
    businessId,
    hours: Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      opensAt: "09:00",
      closesAt: "17:00",
      isClosed: false,
    })),
  });
  return { service, staff: staff[0]!, customer: customers[0]!, businessId };
}

const secondBusiness = {
  name: "Tulivu Second Studio",
  description: "A second location used to verify business-scoped settings.",
  websiteUrl: "https://example.com/second",
  industry: "Wellness",
  country: "Kenya",
  city: "Nairobi",
  targetCustomers: "Adults in Nairobi.",
  defaultCurrency: "KES",
  socialUrls: [],
  brandProfile: {
    voice: "Plain.",
    tone: "Calm.",
    colors: ["#173D35"],
    logoUrl: "",
    usps: [],
    competitors: [],
    bannedClaims: [],
    approvedCtas: [],
    existingMaterials: "",
    goals: "",
  },
};

beforeAll(async () => {
  harnessA = await createTestHarness();
  harnessB = await createTestHarness();
  clientA = new SessionClient(harnessA.app);
  clientB = new SessionClient(harnessB.app);
  const workspaceA = await setupWorkspace(clientA);
  const workspaceB = await setupWorkspace(clientB);
  serviceA = workspaceA.service;
  staffA = workspaceA.staff;
  customerA = workspaceA.customer;
  serviceB = workspaceB.service;
  staffB = workspaceB.staff;
  customerB = workspaceB.customer;
});

afterAll(async () => {
  await harnessA.close();
  await harnessB.close();
});

describe("operations acceptance", () => {
  it("creates a booking with service-derived price, duration, business and real-user flag", async () => {
    const response = await clientA.post("/api/operations/bookings", bookingPayload({ idempotencyKey: randomUUID() }));
    expect(response.statusCode).toBe(201);
    const body = bodyOf<{ booking: BookingRecord; replayed: boolean }>(response);
    expect(body.replayed).toBe(false);
    expect(body.booking).toMatchObject({
      businessId: serviceA.businessId,
      customerId: customerA.id,
      staffId: staffA.id,
      serviceId: serviceA.id,
      priceCents: serviceA.priceCents,
      currency: serviceA.currency,
      status: "confirmed",
      isDemo: 0,
    });
    const expectedEnd = new Date(new Date(mondayMorning).getTime() + 80 * 60_000).toISOString();
    expect(new Date(body.booking.endsAt).toISOString()).toBe(expectedEnd);
  });

  it("rejects a second booking that overlaps the same staff member", async () => {
    const response = await clientA.post(
      "/api/operations/bookings",
      bookingPayload({ idempotencyKey: randomUUID(), customerNote: "second attempt" }),
    );
    expect(response.statusCode).toBe(409);
    expect(bodyOf<{ error: { code: string } }>(response).error.code).toBe("slot_conflict");
  });

  it("denies cross-workspace customer, service and staff references", async () => {
    const response = await clientA.post(
      "/api/operations/bookings",
      bookingPayload({
        customerId: customerB.id,
        serviceId: serviceB.id,
        staffId: staffB.id,
        idempotencyKey: randomUUID(),
      }),
    );
    expect(response.statusCode).toBe(404);
    expect(bodyOf<{ error: { code: string } }>(response).error.code).toBe("customer_not_found");
  });

  it("returns 400 for invalid dates instead of a server error", async () => {
    const response = await clientA.post("/api/operations/bookings", bookingPayload({ startsAt: "not-a-date" }));
    expect(response.statusCode).toBe(400);
    expect(bodyOf<{ error: { code: string } }>(response).error.code).toBe("validation_error");
  });

  it("replays an idempotent booking retry without creating a duplicate", async () => {
    const key = `retry-${randomUUID()}`;
    const startsAt = "2026-11-23T11:00:00+03:00";
    const first = await clientA.post("/api/operations/bookings", bookingPayload({ startsAt, idempotencyKey: key }));
    const second = await clientA.post("/api/operations/bookings", bookingPayload({ startsAt, idempotencyKey: key }));
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    const firstBody = bodyOf<{ booking: BookingRecord; replayed: boolean }>(first);
    const secondBody = bodyOf<{ booking: BookingRecord; replayed: boolean }>(second);
    expect(secondBody.replayed).toBe(true);
    expect(secondBody.booking.id).toBe(firstBody.booking.id);
    const list = bodyOf<{ bookings: Array<{ booking: BookingRecord }> }>(
      await clientA.get("/api/operations/bookings"),
    );
    expect(list.bookings.filter((row) => row.booking.id === firstBody.booking.id)).toHaveLength(1);
  });

  it("rejects bookings outside business hours", async () => {
    const response = await clientA.post(
      "/api/operations/bookings",
      bookingPayload({ startsAt: "2026-11-23T18:00:00+03:00", idempotencyKey: randomUUID() }),
    );
    expect(response.statusCode).toBe(409);
    expect(bodyOf<{ error: { code: string } }>(response).error.code).toBe("outside_hours");
  });

  it("cancels a booking, records status history and treats a repeat as a replay", async () => {
    const created = await clientA.post(
      "/api/operations/bookings",
      bookingPayload({ startsAt: "2026-11-23T13:00:00+03:00", idempotencyKey: randomUUID() }),
    );
    const bookingId = bodyOf<{ booking: BookingRecord }>(created).booking.id;
    const cancelled = await clientA.post(`/api/operations/bookings/${bookingId}/cancel`, {
      reason: "Client requested cancellation",
    });
    expect(cancelled.statusCode).toBe(200);
    expect(bodyOf<{ booking: BookingRecord }>(cancelled).booking.status).toBe("cancelled");
    const repeated = await clientA.post(`/api/operations/bookings/${bookingId}/cancel`, {});
    expect(bodyOf<{ booking: BookingRecord }>(repeated).booking.status).toBe("cancelled");
    const history = bodyOf<{ history: Array<{ toStatus: string }> }>(
      await clientA.get(`/api/operations/bookings/${bookingId}/history`),
    );
    expect(history.history.map((row) => row.toStatus)).toEqual(["confirmed", "cancelled"]);
  });

  it("saves business hours only for the selected business", async () => {
    const createdBusiness = bodyOf<{ business: { id: string } }>(
      await clientA.post("/api/businesses", secondBusiness),
    ).business;
    await clientA.put("/api/operations/hours", {
      businessId: createdBusiness.id,
      hours: Array.from({ length: 7 }, (_, weekday) => ({
        weekday,
        opensAt: "08:00",
        closesAt: "16:00",
        isClosed: false,
      })),
    });
    const original = bodyOf<{ hours: Array<{ opensAt: string; closesAt: string }> }>(
      await clientA.get(`/api/operations/hours?businessId=${serviceA.businessId}`),
    );
    const second = bodyOf<{ hours: Array<{ opensAt: string; closesAt: string }> }>(
      await clientA.get(`/api/operations/hours?businessId=${createdBusiness.id}`),
    );
    expect(original.hours).toHaveLength(7);
    expect(original.hours.every((row) => row.opensAt === "09:00" && row.closesAt === "17:00")).toBe(true);
    expect(second.hours).toHaveLength(7);
    expect(second.hours.every((row) => row.opensAt === "08:00" && row.closesAt === "16:00")).toBe(true);
  });
});
