import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const PACKS: Record<string, { credits: number; price_cents: number; label: string }> = {
  single: { credits: 1,  price_cents: 500,  label: '1 analyse' },
  pack5:  { credits: 5,  price_cents: 2000, label: '5 analyses' },
  pack10: { credits: 10, price_cents: 3500, label: '10 analyses' }
}

export async function POST(req: NextRequest) {
  const { packId, userId, userEmail } = await req.json()
  const pack = PACKS[packId]
  if (!pack) return NextResponse.json({ error: 'Pack invalide' }, { status: 400 })

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: userEmail,
    line_items: [{
      price_data: {
        currency: 'eur',
        unit_amount: pack.price_cents,
        product_data: {
          name: `Pool Water AI — ${pack.label}`,
          description: `${pack.credits} analyse${pack.credits > 1 ? 's' : ''} de votre eau de piscine par IA`
        }
      },
      quantity: 1
    }],
    metadata: { userId, credits: pack.credits.toString() },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/`
  })

  return NextResponse.json({ url: session.url })
}