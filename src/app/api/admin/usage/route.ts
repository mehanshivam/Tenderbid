import { getUsageSummary, getRawLogs } from "@/lib/apiTracker";
import { NextRequest } from "next/server";

// Simple admin secret — set ADMIN_SECRET in .env.local
const ADMIN_SECRET = process.env.ADMIN_SECRET || "alpha-admin-2024";

function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  const querySecret = req.nextUrl.searchParams.get("secret");
  return (
    authHeader === `Bearer ${ADMIN_SECRET}` ||
    querySecret === ADMIN_SECRET
  );
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const view = req.nextUrl.searchParams.get("view") || "summary";
  const days = parseInt(req.nextUrl.searchParams.get("days") || "30");
  const endpoint = req.nextUrl.searchParams.get("endpoint") || undefined;
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "100");

  try {
    if (view === "summary") {
      const summary = await getUsageSummary(days);
      return Response.json(summary);
    } else if (view === "logs") {
      const logs = await getRawLogs({ endpoint, days, limit });
      return Response.json({ logs, count: logs.length });
    } else {
      return Response.json({ error: "Invalid view parameter" }, { status: 400 });
    }
  } catch (err) {
    console.error("[Admin Usage] Error:", err);
    return Response.json(
      { error: "Failed to fetch usage data" },
      { status: 500 }
    );
  }
}
