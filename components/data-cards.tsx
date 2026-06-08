"use client"

import { useState, useMemo, useCallback } from "react"
import { Search, Calendar, X, Download, Phone, FileText, CreditCard, CalendarClock, MessageSquare, ChevronDown } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import * as XLSX from "xlsx"
import type { DataRow } from "@/lib/types"
import { DialogueView } from "@/components/dialogue-view"

interface DataCardsProps {
  data: DataRow[]
}

// The 4 fields we display
interface AnswerData {
  phoneNumber: string
  DelayReason: string
  WillingToPay: string
  PromisedDate: string
}

// Field labels in English
const FIELD_LABELS: Record<keyof AnswerData, string> = {
  phoneNumber: "Phone Number",
  DelayReason: "Delay Reason",
  WillingToPay: "Willing to Pay",
  PromisedDate: "Promised Date",
}

// Extract AnswerData from rawData
function extractAnswerData(rawData: Record<string, unknown>): AnswerData {
  return {
    phoneNumber: String(rawData.phoneNumber || "-"),
    DelayReason: String(rawData.DelayReason || "-"),
    WillingToPay: String(rawData.WillingToPay || "-"),
    PromisedDate: String(rawData.PromisedDate || "null") === "null" ? "-" : String(rawData.PromisedDate),
  }
}

// Download single card as Excel
function downloadSingleCard(row: DataRow) {
  const answerData = extractAnswerData(row.rawData)
  const headers = ["Created Time", ...Object.values(FIELD_LABELS)]
  const values = [row.createTime, answerData.phoneNumber, answerData.DelayReason, answerData.WillingToPay, answerData.PromisedDate]
  
  const sheetData = [headers, values]
  
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(sheetData)
  XLSX.utils.book_append_sheet(wb, ws, "Record")
  
  const filename = answerData.phoneNumber !== "-" ? `record_${answerData.phoneNumber}.xlsx` : `record_${row.id}.xlsx`
  XLSX.writeFile(wb, filename)
}

// Download all cards as Excel
function downloadAllCards(data: DataRow[]) {
  if (data.length === 0) return
  
  const headers = ["Created Time", ...Object.values(FIELD_LABELS)]
  const sheetData = [headers]
  
  for (const row of data) {
    const answerData = extractAnswerData(row.rawData)
    sheetData.push([
      row.createTime,
      answerData.phoneNumber,
      answerData.DelayReason,
      answerData.WillingToPay,
      answerData.PromisedDate,
    ])
  }
  
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(sheetData)
  XLSX.utils.book_append_sheet(wb, ws, "All Records")
  
  const now = new Date()
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`
  XLSX.writeFile(wb, `all_records_${dateStr}.xlsx`)
}

// Get badge style for WillingToPay field
function getWillingToPayStyle(value: string) {
  const lowerVal = value.toLowerCase()
  if (lowerVal === "是" || lowerVal === "yes" || lowerVal === "y" || lowerVal === "نعم") {
    return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
  }
  if (lowerVal === "否" || lowerVal === "no" || lowerVal === "n" || lowerVal === "لا") {
    return "bg-rose-500/10 text-rose-400 border-rose-500/30"
  }
  return "bg-amber-500/10 text-amber-400 border-amber-500/30"
}

export function DataCards({ data }: DataCardsProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({})

  const toggleExpanded = useCallback((id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data
    const query = searchQuery.toLowerCase()
    return data.filter((row) => {
      const answerData = extractAnswerData(row.rawData)
      return answerData.phoneNumber.toLowerCase().includes(query)
    })
  }, [data, searchQuery])

  const handleDownloadAll = useCallback(() => {
    downloadAllCards(filteredData)
  }, [filteredData])

  return (
    <div className="flex flex-col gap-4">
      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by phone number..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 pr-10"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 hover:bg-secondary"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Results count with download button */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing <span className="font-medium text-foreground">{filteredData.length}</span> / {" "}
          <span className="font-medium text-foreground">{data.length}</span> records
        </div>
        {filteredData.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadAll}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Download All
          </Button>
        )}
      </div>

      {/* Cards Grid */}
      {filteredData.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          No matching records found
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredData.map((row) => {
            const answerData = extractAnswerData(row.rawData)
            const isExpanded = !!expandedCards[row.id]

            return (
              <Card key={row.id} className="relative border-border/50 bg-card transition-shadow hover:shadow-md">
                <CardContent className="p-4">
                  {/* Header - Time with Download Button */}
                  <div className="mb-3 flex items-center justify-between border-b border-border/50 pb-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{row.createTime}</span>
                    </div>
                    <button
                      onClick={() => downloadSingleCard(row)}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      title="Download this record"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Conversation History - collapsible, collapsed by default */}
                  <div className="mb-3 rounded-lg border border-border/50">
                    <button
                      onClick={() => toggleExpanded(row.id)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-secondary/50"
                      aria-expanded={isExpanded}
                    >
                      <span className="flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium text-foreground">Conversation History</span>
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {isExpanded && (
                      <div className="max-h-80 overflow-y-auto border-t border-border/50 px-3 py-3">
                        <DialogueView dialogue={row.historyDialogue} />
                      </div>
                    )}
                  </div>

                  {/* 4 Fields */}
                  <div className="grid gap-3">
                    {/* Phone Number */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {FIELD_LABELS.phoneNumber}
                        </span>
                      </div>
                      <span className="font-mono text-sm text-foreground">{answerData.phoneNumber}</span>
                    </div>

                    {/* Delay Reason */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {FIELD_LABELS.DelayReason}
                        </span>
                      </div>
                      <p className="text-sm text-foreground leading-relaxed break-words" dir="auto">
                        {answerData.DelayReason}
                      </p>
                    </div>

                    {/* Willing To Pay */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {FIELD_LABELS.WillingToPay}
                        </span>
                      </div>
                      <Badge variant="outline" className={`w-fit ${getWillingToPayStyle(answerData.WillingToPay)}`}>
                        {answerData.WillingToPay}
                      </Badge>
                    </div>

                    {/* Promised Date */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {FIELD_LABELS.PromisedDate}
                        </span>
                      </div>
                      <span className="text-sm text-foreground">
                        {answerData.PromisedDate === "-" ? (
                          <span className="text-muted-foreground/50">-</span>
                        ) : (
                          answerData.PromisedDate
                        )}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
