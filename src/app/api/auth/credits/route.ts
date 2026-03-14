import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase'

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ credits: 0 })
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('credits, email')
    .eq('id', userId)
    .single()
  return NextResponse.json({ credits: data?.credits ?? 0, email: data?.email })
}