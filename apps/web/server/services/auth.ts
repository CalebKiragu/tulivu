import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { organizationMembers, organizations, users } from "../db/schema.js";

export type OrgRole = "owner" | "admin" | "staff" | "viewer";

export class AuthError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, code = "auth_error", statusCode = 400) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export interface AuthContext {
  userId: string;
  organizationId: string;
  ownerId: string;
  role: OrgRole;
  user: { id: string; email: string; displayName: string };
  organization: { id: string; name: string; slug: string; timezone: string; ownerId: string };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function slugify(value: string): string {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return base || "workspace";
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [scheme, salt, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function uniqueOrgSlug(db: Database, name: string): Promise<string> {
  const base = slugify(name);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const existing = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, candidate))
      .limit(1);
    if (existing.length === 0) return candidate;
  }
  return `${base}-${randomUUID().slice(0, 8)}`;
}

export async function registerAccount(
  db: Database,
  input: { email: string; password: string; displayName: string; organizationName: string; timezone?: string },
): Promise<AuthContext> {
  const email = normalizeEmail(input.email);
  const displayName = input.displayName.trim();
  const organizationName = input.organizationName.trim();
  if (!email || !email.includes("@")) throw new AuthError("Enter a valid email address.", "validation_error", 400);
  if (input.password.length < 10) throw new AuthError("Use at least 10 characters for the password.", "validation_error", 400);
  if (!displayName) throw new AuthError("Enter your name.", "validation_error", 400);
  if (!organizationName) throw new AuthError("Enter an organization name.", "validation_error", 400);

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) throw new AuthError("An account with that email already exists.", "email_taken", 409);

  const userId = randomUUID();
  const organizationId = randomUUID();
  const slug = await uniqueOrgSlug(db, organizationName);

  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      id: userId,
      email,
      displayName,
      passwordHash: hashPassword(input.password),
    });
    await tx.insert(organizations).values({
      id: organizationId,
      ownerId: userId,
      name: organizationName,
      slug,
      timezone: input.timezone?.trim() || "Africa/Nairobi",
      defaultCurrency: "KES",
    });
    await tx.insert(organizationMembers).values({
      id: randomUUID(),
      organizationId,
      userId,
      role: "owner",
    });
  });

  return {
    userId,
    organizationId,
    ownerId: userId,
    role: "owner",
    user: { id: userId, email, displayName },
    organization: {
      id: organizationId,
      name: organizationName,
      slug,
      timezone: input.timezone?.trim() || "Africa/Nairobi",
      ownerId: userId,
    },
  };
}

export async function loginAccount(db: Database, input: { email: string; password: string }): Promise<AuthContext> {
  const email = normalizeEmail(input.email);
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !verifyPassword(input.password, user.passwordHash)) {
    throw new AuthError("The email or password is incorrect.", "invalid_credentials", 401);
  }
  return resolveAuthContext(db, user.id);
}

export async function resolveAuthContext(
  db: Database,
  userId: string,
  organizationId?: string | null,
): Promise<AuthContext> {
  const rows = await db
    .select({
      role: organizationMembers.role,
      organization: organizations,
      user: users,
    })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(and(eq(organizationMembers.userId, userId), eq(users.id, userId)))
    .orderBy(desc(organizationMembers.createdAt));

  if (rows.length === 0) throw new AuthError("This account has no organization.", "no_organization", 403);
  const selected = (organizationId ? rows.find((row) => row.organization.id === organizationId) : undefined) ??
    rows.find((row) => row.role === "owner") ??
    rows[0]!;

  return {
    userId,
    organizationId: selected.organization.id,
    ownerId: selected.organization.ownerId,
    role: selected.role,
    user: {
      id: selected.user.id,
      email: selected.user.email,
      displayName: selected.user.displayName,
    },
    organization: {
      id: selected.organization.id,
      name: selected.organization.name,
      slug: selected.organization.slug,
      timezone: selected.organization.timezone,
      ownerId: selected.organization.ownerId,
    },
  };
}

export async function createStaffAccount(
  db: Database,
  actor: AuthContext,
  input: { email: string; password: string; displayName: string; role?: OrgRole },
): Promise<{ id: string; email: string; displayName: string; role: OrgRole }> {
  if (!["owner", "admin"].includes(actor.role)) {
    throw new AuthError("Only owners and admins can add team members.", "forbidden", 403);
  }
  if (actor.ownerId !== actor.user.id || actor.organization.ownerId !== actor.user.id) {
    // Organization ownership is intentionally tied to the tenant owner user id
    // so existing ownerId-scoped data remains valid after adding organizations.
    throw new AuthError("Only the organization owner can add team members.", "forbidden", 403);
  }

  const email = normalizeEmail(input.email);
  const displayName = input.displayName.trim();
  const role = input.role ?? "staff";
  if (!email.includes("@")) throw new AuthError("Enter a valid email address.", "validation_error", 400);
  if (input.password.length < 10) throw new AuthError("Use at least 10 characters for the password.", "validation_error", 400);
  if (!displayName) throw new AuthError("Enter the team member's name.", "validation_error", 400);
  if (!["admin", "staff", "viewer"].includes(role)) {
    throw new AuthError("That role is not available for team members.", "validation_error", 400);
  }

  const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existingUser) {
    throw new AuthError("That email already belongs to an account.", "email_taken", 409);
  }

  const userId = randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      id: userId,
      email,
      displayName,
      passwordHash: hashPassword(input.password),
    });
    await tx.insert(organizationMembers).values({
      id: randomUUID(),
      organizationId: actor.organizationId,
      userId,
      role,
    });
  });

  return { id: userId, email, displayName, role };
}
