import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '../../../../lib/supabase'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch { return NextResponse.json({ error: 'Webhook invalide' }, { status: 400 }) }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const userId = session.metadata?.userId
    const credits = parseInt(session.metadata?.credits ?? '0')
    if (userId && credits > 0) {
      const { data: profile } = await supabaseAdmin.from('profiles').select('credits').eq('id', userId).single()
      await Promise.all([
        supabaseAdmin.from('profiles').update({ credits: (profile?.credits ?? 0) + credits }).eq('id', userId),
        supabaseAdmin.from('transactions').insert({
          user_id: userId,
          stripe_payment_id: session.payment_intent as string,
          amount_cents: session.amount_total,
          credits_added: credits
        })
      ])
    }
  }
  return NextResponse.json({ received: true })
}