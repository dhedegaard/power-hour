import z from 'zod'
import { PriceHistoryResponse } from './nrgi-client.schemas'

export const getPriceHistory = z.function({
  input: [z.object({
    region: z.literal('DK1'),
    from: z.iso.datetime({ offset: true }),
    to: z.iso.datetime({ offset: true }),
    includeGrid: z.literal(false),

  })],
  output: PriceHistoryResponse
})
.implementAsync(async function getPriceHistory({region, from,to,includeGrid}) {
  const response = await fetch(`https://nrgi.dk/api/common/v3/pricehistory?${new URLSearchParams({
    region,from,to,includeGrid
  }).toString()}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch price history: ${response.statusText}`, { cause: response})
  }
  return  await response.json() as PriceHistoryResponse
})