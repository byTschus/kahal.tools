import { compare } from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { createSession } from "@/lib/auth";
import { database } from "@/lib/database";

type LocalUserRow = RowDataPacket & {
  id: number;
  password_hash: string;
  status: "pending" | "active" | "rejected";
};

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const organization = String(formData.get("organization") ?? "").trim().toLowerCase();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const [rows] = await database.execute<LocalUserRow[]>(
    `SELECT users.id, users.password_hash, users.status
       FROM users JOIN organizations ON organizations.id = users.organization_id
      WHERE organizations.login_slug = ? AND LOWER(users.email) = ?
        AND users.password_hash IS NOT NULL LIMIT 1`,
    [organization, email],
  );
  const user = rows[0];
  if (!user || !(await compare(password, user.password_hash))) {
    return NextResponse.redirect(new URL("/login?error=invalid-credentials", request.url), 303);
  }
  await createSession(user.id);
  return NextResponse.redirect(new URL(user.status === "active" ? "/" : "/access-status", request.url), 303);
}
