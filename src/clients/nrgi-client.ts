import { addDays } from 'date-fns'
import { cacheLife } from 'next/cache'
import z from 'zod'
import { PriceHistoryResponse } from './nrgi-client.schemas'

export const getPriceHistory = z
  .function({
    input: [
      z.object({
        region: z.literal('DK1'),
        date: z.date(),
      }),
    ],
    output: PriceHistoryResponse,
  })
  .implementAsync(async function getPriceHistory({ region, date }) {
    'use cache'
    cacheLife('minutes')

    const from = new Date(date)
    from.setHours(0, 0, 0, 0)
    const to = addDays(from, 1)

    const response = await fetch(
      `https://nrgi.dk/api/common/v3/pricehistory?${new URLSearchParams({
        region,
        from: from.toISOString(),
        to: to.toISOString(),
        includeGrid: 'false',
      }).toString()}`
    )
    if (!response.ok) {
      throw new Error(`Failed to fetch price history: ${response.statusText}`, { cause: response })
    }
    return (await response.json()) as PriceHistoryResponse
  })
