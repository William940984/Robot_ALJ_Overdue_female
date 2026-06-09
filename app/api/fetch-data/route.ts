import { NextRequest, NextResponse } from "next/server"

interface SegmentItem {
  segment_code: string
  message_source: string
  create_time: string
}

interface DetailItem {
  question: string
  answer: string
  create_time: string
  message_source: string
}

export interface DataRow {
  id: string
  createTime: string
  rawData: Record<string, unknown>
  historyDialogue: string
}

// Parse the "question" field (a JSON string) and extract historyDialogue text.
// Falls back to regex extraction when the JSON is truncated/incomplete.
function parseHistoryDialogue(question: string): string {
  if (!question || typeof question !== "string") return ""

  // 1) Try strict JSON parse first (clean, complete payloads)
  try {
    const parsed = JSON.parse(question)
    if (parsed && typeof parsed === "object" && typeof parsed.historyDialogue === "string") {
      return decodeDialogue(parsed.historyDialogue)
    }
  } catch {
    // Ignore and fall through to manual extraction
  }

  // 2) Fallback: manually locate "historyDialogue" and read until the value ends.
  // Handles truncated JSON where the closing quote/brace is missing.
  const keyMatch = question.match(/"historyDialogue"\s*:\s*"/)
  if (keyMatch && keyMatch.index !== undefined) {
    const valueStart = keyMatch.index + keyMatch[0].length
    let end = valueStart
    // Walk forward until we hit an unescaped closing double quote, or the end of string
    while (end < question.length) {
      if (question[end] === '"' && question[end - 1] !== "\\") {
        break
      }
      end++
    }
    const rawValue = question.slice(valueStart, end)
    return decodeDialogue(rawValue)
  }

  return ""
}

// Convert escaped sequences (\n, \r, \t, \", \\) into their real characters
function decodeDialogue(value: string): string {
  return value
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, " ")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
    .trim()
}

// Escape raw control characters (newlines, tabs, etc.) that appear *inside*
// JSON string literals. The Dyna.AI "answer" payload sometimes embeds literal
// line breaks inside values (e.g. a multi-line WillingToPay analysis), which
// makes JSON.parse throw "Invalid control character". We walk the string and
// only escape control chars that occur while we are inside a quoted string,
// leaving structural whitespace between tokens untouched.
function sanitizeJsonControlChars(input: string): string {
  let result = ""
  let inString = false
  let escaped = false

  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    const code = input.charCodeAt(i)

    if (escaped) {
      result += char
      escaped = false
      continue
    }

    if (char === "\\") {
      result += char
      escaped = true
      continue
    }

    if (char === '"') {
      inString = !inString
      result += char
      continue
    }

    // Escape raw control characters only when inside a string literal
    if (inString && code <= 0x1f) {
      if (char === "\n") result += "\\n"
      else if (char === "\r") result += "\\r"
      else if (char === "\t") result += "\\t"
      else result += "\\u" + code.toString(16).padStart(4, "0")
      continue
    }

    result += char
  }

  return result
}

function parseAnswer(answer: string): Record<string, unknown> | null {
  try {
    // First attempt: try parsing the sanitized payload directly
    let parsed = JSON.parse(sanitizeJsonControlChars(answer))

    // If it's an array, get the first element (e.g., ["{ ... }"])
    if (Array.isArray(parsed) && parsed.length > 0) {
      parsed = parsed[0]
    }

    // If the result is still a string, it may be double-encoded JSON
    // e.g., "{\"phoneNumber\":\"123\"}" or with escaped newlines
    if (typeof parsed === "string") {
      parsed = JSON.parse(sanitizeJsonControlChars(parsed))
    }

    // Final check: ensure it's a valid object
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }

    return null
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const { robotKey, robotToken, username, page = 1, pagesize = 100 } = await request.json()

    if (!robotKey || !robotToken) {
      return NextResponse.json(
        { error: "Missing required parameters: robotKey or robotToken" },
        { status: 400 }
      )
    }
    
    const effectiveUsername = username || "william.pang@dyna.ai"

    const headers = {
      "Content-Type": "application/json",
      "cybertron-robot-key": robotKey,
      "cybertron-robot-token": robotToken,
    }

    // API 1: Get segment list
    const segmentListResponse = await fetch(
      "https://agents.dyna.ai/openapi/v1/conversation/segment/get_list/",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          username: effectiveUsername,
          filter_mode: 0,
          filter_user_code: "",
          create_start_time: "",
          create_end_time: "",
          page,
          pagesize,
        }),
      }
    )

    if (!segmentListResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch segment list" },
        { status: segmentListResponse.status }
      )
    }

    const segmentData = await segmentListResponse.json()

    if (segmentData.code !== "000000") {
      return NextResponse.json(
        { error: segmentData.message || "API 1 returned an error" },
        { status: 400 }
      )
    }

    const segments: SegmentItem[] = segmentData.data?.list || []

    // Filter only openapi-ws segments
    const openapiWsSegments = segments.filter(
      (seg) => seg.message_source === "openapi-ws"
    )

    // API 2: Get details for each segment
    const detailPromises = openapiWsSegments.map(async (segment) => {
      const detailResponse = await fetch(
        "https://agents.dyna.ai/openapi/v1/conversation/segment/detail_list/",
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            username: effectiveUsername,
            segment_code: segment.segment_code,
            page: 1,
            pagesize: 100,
          }),
        }
      )

      if (!detailResponse.ok) {
        return []
      }

      const detailData = await detailResponse.json()

      if (detailData.code !== "000000") {
        return []
      }

      const details: DetailItem[] = detailData.data?.list || []

      // Filter only openapi-ws messages with valid JSON answers
      return details
        .filter((detail) => detail.message_source === "openapi-ws")
        .map((detail, index) => {
          const parsed = parseAnswer(detail.answer)
          
          // Skip rows where answer is not valid JSON
          if (!parsed) {
            return null
          }

          // Prefer historyDialogue from the parsed answer; fall back to question.
          // When parsed from JSON, the answer's historyDialogue already contains
          // real newlines, so decodeDialogue just normalizes/trims it.
          const answerDialogue =
            typeof parsed.historyDialogue === "string"
              ? decodeDialogue(parsed.historyDialogue)
              : ""

          const row: DataRow = {
            id: `${segment.segment_code}-${index}`,
            createTime: detail.create_time,
            rawData: parsed,
            historyDialogue: answerDialogue || parseHistoryDialogue(detail.question),
          }

          return row
        })
        .filter((row): row is DataRow => row !== null)
    })

    const allDetails = await Promise.all(detailPromises)
    const flattenedData = allDetails.flat()

    // Sort by create_time descending (newest first)
    flattenedData.sort((a, b) => {
      return new Date(b.createTime).getTime() - new Date(a.createTime).getTime()
    })

    return NextResponse.json({
      success: true,
      data: flattenedData,
      total: flattenedData.length,
    })
  } catch (error) {
    console.error("Error fetching data:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
