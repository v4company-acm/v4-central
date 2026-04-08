import fs from 'fs'
import path from 'path'

const dataDir = path.join(process.cwd(), 'data')

export function readJSON(filename: string) {
  const file = path.join(dataDir, filename)
  if (!fs.existsSync(file)) return []
  return JSON.parse(fs.readFileSync(file, 'utf-8'))
}

export function writeJSON(filename: string, data: any) {
  const file = path.join(dataDir, filename)
  fs.writeFileSync(file, JSON.stringify(data, null, 2))
}
