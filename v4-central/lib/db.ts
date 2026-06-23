import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function readJSON(key: string): Promise<any[]> {
  if (key === 'users') {
    const { data } = await supabase.from('users').select('*')
    return data || []
  }
  if (key === 'clients') {
    const { data } = await supabase.from('clients').select('*')
    return data || []
  }
  return []
}

export async function writeJSON(key: string, data: any[]): Promise<void> {
  if (key === 'clients') {
    // Busca IDs existentes no banco
    const { data: existing } = await supabase.from('clients').select('id')
    const existingIds = new Set((existing || []).map((r: any) => r.id))
    const incomingIds = new Set(data.map((r: any) => r.id))

    // DELETE — removidos do array
    const toDelete = [...existingIds].filter(id => !incomingIds.has(id))
    if (toDelete.length > 0) {
      await supabase.from('clients').delete().in('id', toDelete)
    }

    // UPSERT — insere ou atualiza
    if (data.length > 0) {
      await supabase.from('clients').upsert(data, { onConflict: 'id' })
    }
  }
}
