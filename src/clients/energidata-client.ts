import { cacheLife } from 'next/cache'
import { setTimeout as sleep } from 'node:timers/promises'
import z from 'zod'
import { DayAheadPricesResponse } from './energidata-client.schemas'

const dayKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const MAX_ATTEMPTS = 4
const DEFAULT_RETRY_DELAY_SECONDS = 10
const MAX_RETRY_DELAY_SECONDS = 30
// The API allows roughly 3 calls per 10 s window; retry-after can undershoot, so pad it.
const RETRY_PADDING_SECONDS = 1

// Honour retry-after on 429; Next gives up on a prerender cache fill after ~50 s, so keep attempts few.
async function fetchWithRetry(url: string): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url)
    if (response.status !== 429 || attempt >= MAX_ATTEMPTS) {
      return response
    }
    const retryAfter = Number(response.headers.get('retry-after'))
    const delaySeconds =
      Math.min(retryAfter > 0 ? retryAfter : DEFAULT_RETRY_DELAY_SECONDS, MAX_RETRY_DELAY_SECONDS) +
      RETRY_PADDING_SECONDS
    // Free the socket before sleeping so the retry can reuse the connection.
    await response.body?.cancel()
    await sleep(delaySeconds * 1000)
  }
}

const getPricesInput = z.object({
  startDayKey: dayKeySchema,
  // Exclusive, like the API's own `end` parameter.
  endDayKey: dayKeySchema,
  priceArea: z.literal('DK1'),
})

// One ranged request: the API only allows ~3 calls per 10 s, so a call per day can't finish a build.
export const getPrices = z
  .function({
    input: [getPricesInput],
    output: DayAheadPricesResponse,
  })
  .implementAsync(async function getPrices({ startDayKey, endDayKey, priceArea }) {
    'use cache'
    cacheLife('minutes')

    const params = new URLSearchParams({
      start: startDayKey,
      end: endDayKey,
      sort: 'TimeDK',
      filter: JSON.stringify({ PriceArea: [priceArea] }),
    })

    const response = await fetchWithRetry(
      `https://api.energidataservice.dk/dataset/DayAheadPrices?${params.toString()}`
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch Energi Data Service prices: ${response.statusText}`, {
        cause: response,
      })
    }

    return DayAheadPricesResponse.parse(await response.json())
  })
