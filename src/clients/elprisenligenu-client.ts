import { cacheLife } from 'next/cache'
import z from 'zod'
import { DailyPricesResponse } from './elprisenligenu-client.schemas'

const dayKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const getDailyPricesInput = z.object({
  dayKey: dayKeySchema,
  priceArea: z.literal('DK1'),
})

export const getDailyPrices = z
  .function({
    input: [getDailyPricesInput],
    output: z.union([DailyPricesResponse, z.null()]),
  })
  .implementAsync(async function getDailyPrices({ dayKey, priceArea }) {
    'use cache'
    cacheLife('minutes')

    const [year, month, day] = dayKey.split('-')
    const response = await fetch(
      `https://www.elprisenligenu.dk/api/v1/prices/${year}/${month}-${day}_${priceArea}.json`
    )

    if (response.status === 404) {
      return null
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch Elprisen lige nu prices: ${response.statusText}`, {
        cause: response,
      })
    }

    return DailyPricesResponse.parse(await response.json())
  })
