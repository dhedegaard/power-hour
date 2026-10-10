import { cacheLife } from 'next/cache'
import { setTimeout as sleep } from 'node:timers/promises'
import z from 'zod'
import { DayAheadPricesResponse } from './energidata-client.schemas'

const dayKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const MAX_ATTEMPTS = 8
const DEFAULT_RETRY_DELAY_SECONDS = 10
const MAX_RETRY_DELAY_SECONDS = 30
// The API allows roughly 3 calls per 10 s window; retry-after can undershoot, so pad it.
const RETRY_PADDING_SECONDS = 1

// A 429 fails builds that prerender many days, so honour retry-after before giving up.
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

const getDailyPricesInput = z.object({
  dayKey: dayKeySchema,
  priceArea: z.literal('DK1'),
})

export const getDailyPrices = z
  .function({
    input: [getDailyPricesInput],
    output: z.union([DayAheadPricesResponse, z.null()]),
  })
  .implementAsync(async function getDailyPrices({ dayKey, priceArea }) {
    'use cache'
    cacheLife('minutes')

    const nextDay = new Date(`${dayKey}T00:00:00Z`)
    nextDay.setUTCDate(nextDay.getUTCDate() + 1)
    const endDayKey = nextDay.toISOString().slice(0, 10)

    const params = new URLSearchParams({
      start: dayKey,
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

    const parsedResponse = DayAheadPricesResponse.parse(await response.json())
    return parsedResponse.records.length > 0 ? parsedResponse : null
  })
