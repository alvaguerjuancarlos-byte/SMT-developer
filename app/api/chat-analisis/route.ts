import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { analisis, messages, pregunta } = await req.json()

  // Strip fuentes from context — not needed for Q&A and saves tokens
  const { fuentes: _f, proyecto: _p, ...analisisCore } = analisis

  const systemPrompt = `Eres el Agente Mastermind de SMT Developer, especialista en análisis de inversión inmobiliaria en México. El usuario tiene preguntas sobre el análisis de inversión que generaste para el proyecto "${analisis.proyecto || 'este terreno'}".

ANÁLISIS GENERADO:
${JSON.stringify(analisisCore, null, 2)}

INSTRUCCIONES:
- Responde de forma concisa y profesional (máx. 3-4 oraciones)
- Cuando pregunten sobre metodología o de dónde vienen los números, explica los criterios y supuestos utilizados
- Si el valor proviene de benchmarks de mercado, normativa municipal o índices de costo de construcción, menciónalo
- Responde siempre en español
- No inventes datos que no estén en el análisis — si no tienes info suficiente, indícalo claramente`

  // Keep last 8 messages max to prevent context bloat across long conversations
  const trimmedMessages = (messages as { role: 'user' | 'assistant'; content: string }[]).slice(-8)

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system: systemPrompt,
      messages: [
        ...trimmedMessages,
        { role: 'user', content: pregunta },
      ],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    if (!text) throw new Error('Respuesta vacía del modelo')
    return NextResponse.json({ respuesta: text })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido'
    console.error('Error in /api/chat-analisis:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
