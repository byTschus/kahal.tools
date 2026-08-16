import { NextResponse } from "next/server";
import { database } from "@/lib/database";

export async function GET() {
  try {
    await database.query("SELECT 1");
    return NextResponse.json({ status: "ok", database: "connected" });
  } catch (error) {
    console.error("Database health check failed", error);
    return NextResponse.json(
      { status: "error", database: "unavailable" },
      { status: 503 },
    );
  }
}
