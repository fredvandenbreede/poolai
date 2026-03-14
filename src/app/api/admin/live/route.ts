import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase'

export async function POST(req: NextRequest) {
  const { password, live } = await req.json()
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 401 })
  }

  await supabaseAdmin
    .from('settings')
    .update({ value: live ? 'true' : 'false' })
    .eq('key', 'is_live')

  return NextResponse.json({ success: true, isLive: live })
}