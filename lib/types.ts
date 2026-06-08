// Dynamic data row - supports any JSON structure
export interface DataRow {
  id: string
  createTime: string
  rawData: Record<string, unknown>
  historyDialogue: string
}

export interface ApiConfig {
  robotKey: string
  robotToken: string
}

export const DEFAULT_CONFIG: ApiConfig = {
  robotKey: "uz2e7c3iC6h56EciokWMy2x%2Bjmk%3D",
  robotToken: "MTc4MDQ4NTk2MTE0NwptV0hTVGNsTXBIcTRNdmNOMGxlc2s0Uk5jeU09",
}

export const DEFAULT_USERNAME = "william.pang@dyna.ai"
