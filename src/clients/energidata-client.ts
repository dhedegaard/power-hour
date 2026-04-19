import { cacheLife } from 'next/cache'
import z from 'zod'
import { DayAheadPricesResponse } from './energidata-client.schemas'

const dayKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

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

    const response = await fetch(`https://api.energidataservice.dk/dataset/DayAheadPrices?${params.toString()}`)

    if (!response.ok) {
      throw new Error(`Failed to fetch Energi Data Service prices: ${response.statusText}`, {
        cause: response,
      })
    }

    const parsedResponse = DayAheadPricesResponse.parse(await response.json())
    return parsedResponse.records.length > 0 ? parsedResponse : null
  })
