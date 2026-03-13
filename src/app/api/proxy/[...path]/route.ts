import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://156.67.104.82";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const backendPath = path.join("/");
  const searchParams = request.nextUrl.searchParams.toString();
  const url = `${BACKEND_URL}/api/${backendPath}${searchParams ? `?${searchParams}` : ""}`;

  try {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
    });

    const contentType = res.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const data = await res.json();
      return NextResponse.json(data, { status: res.status });
    }

    // For file downloads, stream the response
    const blob = await res.blob();
    return new NextResponse(blob, {
      status: res.status,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": res.headers.get("content-disposition") || "",
      },
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return NextResponse.json({ error: "Backend unavailable" }, { status: 502 });
  }
}
