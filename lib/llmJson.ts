import type Anthropic from '@anthropic-ai/sdk'
import type { MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages'

// Los 8 endpoints de agentes en app/api/agentes/* le piden JSON a Claude y lo extraen con una
// regex + JSON.parse sobre el texto crudo de la respuesta. Si el modelo comete un desliz de
// sintaxis (clave sin comillas, coma sobrante) en una respuesta larga, el endpoint tronaba sin
// más — visto en producción con el Agente de Construcción (respuesta de 91s, JSON.parse falló
// en la línea 72). Este helper reintenta la llamada al LLM UNA vez si el parseo falla antes de
// propagar el error — mismo prompt, nueva generación, no repara el texto malformado a mano.
export async function callClaudeJson<T = any>(
  client: Anthropic,
  params: MessageCreateParamsNonStreaming,
  pattern: RegExp = /\{[\s\S]*\}/,
): Promise<T> {
  let ultimoError: unknown
  for (let intento = 0; intento < 2; intento++) {
    try {
      const message = await client.messages.create(params)
      // Concatena TODOS los bloques de texto, no solo el primero — algunas rutas (terreno)
      // pueden devolver la respuesta partida en varios bloques.
      const text = message.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
      const match = text.match(pattern)
      if (!match) throw new Error('No JSON in response')
      return JSON.parse(match[0]) as T
    } catch (err) {
      ultimoError = err
    }
  }
  throw ultimoError
}
