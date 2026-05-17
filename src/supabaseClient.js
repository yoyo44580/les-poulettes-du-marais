import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://iomagmnnazaidtmivayo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlvbWFnbW5uYXphaWR0bWl2YXlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NjgzNzYsImV4cCI6MjA5NDM0NDM3Nn0.-eM4AfX27MDmBmOS1CDRXj8ws-eMCm03m6kF10cnwKQ'

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
)