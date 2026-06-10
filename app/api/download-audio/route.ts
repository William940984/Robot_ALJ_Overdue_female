import { NextRequest, NextResponse } from "next/server"

// Proxy the recording so the browser downloads it as a file attachment.
// The source URL is cross-origin and served with `content-disposition: inline`,
// which would otherwise stream/open in the browser instead of saving.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get("url")
  const fileName = searchParams.get("fileName") || "recording.mp3"

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 })
  }

  // Only allow proxying recordings from the Dyna.AI host
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return NextResponse.json({ error: "Invalid url parameter" }, { status: 400 })
  }
  if (parsed.hostname !== "agents.dyna.ai") {
    return NextResponse.json({ error: "URL host not allowed" }, { status: 403 })
  }

  try {
    const upstream = await fetch(url)
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: `Failed to fetch audio (status ${upstream.status})` },
        { status: 502 }
      )
    }

    const contentType = upstream.headers.get("content-type") || "audio/mpeg"
    // Sanitize the filename for the Content-Disposition header
    const safeName = fileName.replace(/[^\w.\-]/g, "_")

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("Error proxying audio download:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
