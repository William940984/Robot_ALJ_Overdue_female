// Dynamic data row - supports any JSON structure
export interface DataRow {
  id: string
  createTime: string
  rawData: Record<string, unknown>
  historyDialogue: string
  // Recording download info parsed from the answer's "audio" field (optional)
  audioUrl?: string
  audioFileName?: string
}

export interface ApiConfig {
  robotKey: string
  robotToken: string
}

export const DEFAULT_CONFIG: ApiConfig = {
  robotKey: "0t0Ghhpnf37TvG6X6P4krQQlP24%3D",
  robotToken: "MTc4MDg4NDMzMjI0NApBSUhSa3NER0NEekFhVkd2dmNiaGQrRmYveHc9",
}

export const DEFAULT_USERNAME = "william.pang@dyna.ai"
