import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://blfuuouexpzcnqpfjhaw.supabase.co'
const supabaseKey = 'sb_publishable_GQmlLQLhrQ5zALvahk5D2g_eaAcDZ0m'

export const supabase = createClient(supabaseUrl, supabaseKey)
