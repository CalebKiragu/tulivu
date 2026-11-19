import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestHarness, SessionClient, bodyOf, type TestHarness } from "./helpers/app.js";

interface AuthPayload {
  auth: {
    userId: string;
    organizationId: string;
    ownerId: string;
    role: string;
    user: { email: string; displayName: string };
    organization: { name: string; slug: string; timezone: string };
  };
}

let harness: TestHarness;
let anonymous: SessionClient;

beforeAll(async () => {
  harness = await createTestHarness({ authMode: "required" });
  anonymous = new SessionClient(harness.app);
});

afterAll(async () => {
  await harness.close();
});

describe("authentication acceptance", () => {
  it("blocks workspace requests when authentication is required", async () => {
    const response = await anonymous.get("/api/overview");
    expect(response.statusCode).toBe(401);
    expect(bodyOf<{ error: { code: string } }>(response).error.code).toBe("unauthorized");
  });

  it("registers an owner, keeps a session and exposes the active organization", async () => {
    const owner = new SessionClient(harness.app);
    const registered = await owner.post("/api/auth/register", {
      email: "owner@example.com",
      password: "correct-horse-battery",
      displayName: "Ada Owner",
      organizationName: "Ada Wellness",
      timezone: "Africa/Nairobi",
    });
    expect(registered.statusCode).toBe(201);
    const registeredBody = bodyOf<AuthPayload>(registered).auth;
    expect(registeredBody.role).toBe("owner");
    expect(registeredBody.ownerId).toBe(registeredBody.userId);

    const me = await owner.get("/api/auth/me");
    expect(me.statusCode).toBe(200);
    expect(bodyOf<AuthPayload>(me).auth.user.email).toBe("owner@example.com");
    expect(bodyOf<AuthPayload>(me).auth.organization.name).toBe("Ada Wellness");
  });

  it("rejects duplicate emails and bad passwords", async () => {
    const duplicate = await anonymous.post("/api/auth/register", {
      email: "owner@example.com",
      password: "another-long-password",
      displayName: "Someone Else",
      organizationName: "Other Workspace",
    });
    expect(duplicate.statusCode).toBe(409);
    const badLogin = await anonymous.post("/api/auth/login", {
      email: "owner@example.com",
      password: "wrong-password",
    });
    expect(badLogin.statusCode).toBe(401);
  });

  it("lets an owner add staff, then enforces role boundaries", async () => {
    const owner = new SessionClient(harness.app);
    await owner.post("/api/auth/login", { email: "owner@example.com", password: "correct-horse-battery" });
    const created = await owner.post("/api/auth/staff", {
      email: "staff@example.com",
      password: "staff-long-password",
      displayName: "Sam Staff",
      role: "staff",
    });
    expect(created.statusCode).toBe(201);

    const staff = new SessionClient(harness.app);
    const login = await staff.post("/api/auth/login", {
      email: "staff@example.com",
      password: "staff-long-password",
    });
    expect(login.statusCode).toBe(200);
    expect(bodyOf<AuthPayload>(login).auth.role).toBe("staff");
    const forbidden = await staff.post("/api/auth/staff", {
      email: "another@example.com",
      password: "another-long-password",
      displayName: "Another",
    });
    expect(forbidden.statusCode).toBe(403);
  });

  it("isolates operation records between registered organizations", async () => {
    const ownerA = new SessionClient(harness.app);
    const ownerB = new SessionClient(harness.app);
    await ownerA.post("/api/auth/register", {
      email: "org-a@example.com",
      password: "org-a-long-password",
      displayName: "Owner A",
      organizationName: "Org A",
    });
    await ownerB.post("/api/auth/register", {
      email: "org-b@example.com",
      password: "org-b-long-password",
      displayName: "Owner B",
      organizationName: "Org B",
    });

    await ownerA.get("/api/overview");
    await ownerB.get("/api/overview");
    const customerA = bodyOf<{ customer: { id: string } }>(
      await ownerA.post("/api/operations/customers", { name: "Ada Customer" }),
    ).customer;
    const listB = bodyOf<{ customers: Array<{ id: string }> }>(await ownerB.get("/api/operations/customers"));
    expect(listB.customers.map((row) => row.id)).not.toContain(customerA.id);
    const crossTenant = await ownerB.post("/api/operations/bookings", {
      customerId: customerA.id,
      staffId: "00000000-0000-4000-8000-000000000000",
      serviceId: "00000000-0000-4000-8000-000000000000",
      startsAt: "2026-11-23T09:00:00+03:00",
    });
    expect(crossTenant.statusCode).toBe(404);
  });
});
