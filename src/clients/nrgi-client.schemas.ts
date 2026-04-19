import z from 'zod'

export const PriceHistoryPrice = z.looseObject({
  localTime: z.iso.datetime({ offset: true }),
  utcTime: z.iso.datetime({ offset: true }),
  isPrediction: z.boolean(),
  kwPrice: z.number(),
  totalGrid: z.number(),
  totalRetail: z.number(),
  totalPriceInclVat: z.number(),
  isHighestPrice: z.boolean(),
  isLowestPrice: z.boolean(),
})

export const PriceHistoryResponse = z.looseObject({
  prices: z.array(PriceHistoryPrice),
})
export interface PriceHistoryResponse extends z.infer<typeof PriceHistoryResponse> {}
