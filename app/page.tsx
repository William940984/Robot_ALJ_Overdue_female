"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { RefreshCw, Database, Users, CreditCard, CalendarCheck, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { SettingsDialog } from "@/components/settings-dialog"
import { DataCards } from "@/components/data-cards"
import { Empty } from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { DEFAULT_CONFIG, DEFAULT_USERNAME } from "@/lib/types"
import type { ApiConfig, DataRow } from "@/lib/types"

const STORAGE_KEY = "dyna-api-config"
const CONFIG_VERSION_KEY = "dyna-api-config-version"
// Update this version when default config changes to clear old cached values
const CURRENT_CONFIG_VERSION = "2"

export default function DashboardPage() {
  const [config, setConfig] = useState<ApiConfig>(DEFAULT_CONFIG)
  const [data, setData] = useState<DataRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)
  const [hasFetched, setHasFetched] = useState(false)

  // Load config from localStorage on mount, but clear if version changed
  useEffect(() => {
    const storedVersion = localStorage.getItem(CONFIG_VERSION_KEY)
    
    // If version changed, clear old config and use new defaults
    if (storedVersion !== CURRENT_CONFIG_VERSION) {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.setItem(CONFIG_VERSION_KEY, CURRENT_CONFIG_VERSION)
      setConfig(DEFAULT_CONFIG)
      return
    }
    
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setConfig(parsed)
      } catch {
        console.error("Failed to parse stored config")
      }
    }
  }, [])

  // Save config to localStorage
  const handleSaveConfig = (newConfig: ApiConfig) => {
    setConfig(newConfig)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig))
  }

  const fetchData = useCallback(async () => {
    if (!config.robotKey || !config.robotToken) {
      setError(
        "Please configure API credentials first. Click the settings button in the top right corner."
      )
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/fetch-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          robotKey: config.robotKey,
          robotToken: config.robotToken,
          username: DEFAULT_USERNAME,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch data")
      }

      setData(result.data || [])
      setLastFetch(new Date())
      setHasFetched(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }, [config])

  const isConfigured = config.robotKey && config.robotToken

  // Calculate stats based on the new data format
  const stats = useMemo(() => {
    const total = data.length
    let willingToPay = 0
    let notWillingToPay = 0
    let hasPromisedDate = 0

    // Positive responses: English (yes, y) and Arabic (نعم)
    const positiveResponses = ["yes", "y", "نعم"]
    // Negative responses: English (no, n) and Arabic (لا)
    const negativeResponses = ["no", "n", "لا"]

    data.forEach((row) => {
      const raw = row.rawData as Record<string, string | undefined>
      
      // Check WillingToPay - handle both English and Arabic, case-insensitive
      const willingToPayValue = raw.WillingToPay?.trim().toLowerCase()
      if (willingToPayValue && positiveResponses.includes(willingToPayValue)) {
        willingToPay++
      } else if (willingToPayValue && negativeResponses.includes(willingToPayValue)) {
        notWillingToPay++
      }
      
      // Check PromisedDate
      const promisedDate = raw.PromisedDate?.trim()
      if (promisedDate && promisedDate.toLowerCase() !== "null" && promisedDate !== "-" && promisedDate !== "") {
        hasPromisedDate++
      }
    })

    return { totalRecords: total, willingToPay, notWillingToPay, hasPromisedDate }
  }, [data])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Database className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Call Data Analytics</h1>
              <p className="text-xs text-muted-foreground">Customer Payment Intent Tracking Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastFetch && (
              <div className="flex items-center gap-2 rounded-md bg-secondary/50 px-3 py-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {lastFetch.toLocaleTimeString()}
                </span>
              </div>
            )}
            <Button
              onClick={fetchData}
              disabled={loading || !isConfigured}
              className="bg-primary hover:bg-primary/90"
            >
              {loading ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Loading...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Fetch Data
                </>
              )}
            </Button>
            <SettingsDialog config={config} onSave={handleSaveConfig} />
          </div>
        </div>
      </header>

      <main className="p-6">
        {error && (
          <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {!isConfigured ? (
          <Card className="border-border/50 bg-card">
            <CardContent className="py-12">
              <Empty
                icon={Database}
                title="Configuration Required"
                description="Please configure API credentials to start fetching data. Click the settings button in the top right corner."
              />
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border-border/50 bg-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Total Records</p>
                      <p className="mt-1 text-2xl font-bold text-foreground">{stats.totalRecords}</p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/50 bg-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Willing to Pay</p>
                      <p className="mt-1 text-2xl font-bold text-foreground">{stats.willingToPay}</p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[oklch(0.7_0.18_150/0.1)]">
                      <CreditCard className="h-5 w-5 text-[oklch(0.7_0.18_150)]" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/50 bg-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Not Willing to Pay</p>
                      <p className="mt-1 text-2xl font-bold text-foreground">{stats.notWillingToPay}</p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[oklch(0.55_0.22_25/0.1)]">
                      <CreditCard className="h-5 w-5 text-[oklch(0.65_0.22_25)]" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/50 bg-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Has Promised Date</p>
                      <p className="mt-1 text-2xl font-bold text-foreground">{stats.hasPromisedDate}</p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[oklch(0.7_0.15_230/0.1)]">
                      <CalendarCheck className="h-5 w-5 text-[oklch(0.7_0.15_230)]" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Data Cards */}
            {loading ? (
              <Card className="border-border/50 bg-card">
                <CardContent className="flex items-center justify-center py-16">
                  <Spinner className="h-8 w-8 text-primary" />
                  <span className="ml-3 text-sm text-muted-foreground">
                    Fetching data from API...
                  </span>
                </CardContent>
              </Card>
            ) : data.length === 0 ? (
              <Card className="border-border/50 bg-card">
                <CardContent className="py-16">
                  <Empty
                    icon={Database}
                    title={hasFetched ? "No Valid Data Found" : "No Data"}
                    description={hasFetched 
                      ? "No valid records were found from the API. Please check if there are any records matching the filter criteria."
                      : 'Click the "Fetch Data" button to load call data from the API.'
                    }
                  />
                </CardContent>
              </Card>
            ) : (
              <DataCards data={data} />
            )}
          </>
        )}
      </main>
    </div>
  )
}
