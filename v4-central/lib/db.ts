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

export async function writeJSON(key: string, data: any): Promise<void> {
  // implementar conforme necessidade
}
