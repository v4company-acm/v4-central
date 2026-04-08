import { kv } from '@vercel/kv'

export async function readJSON(key: string): Promise<any[]> {
  try {
    const data = await kv.get<any[]>(key)
    return data || []
  } catch {
    return []
  }
}

export async function writeJSON(key: string, data: any): Promise<void> {
  await kv.set(key, data)
}
