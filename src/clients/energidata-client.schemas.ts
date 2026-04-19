import z from 'zod'

const isoLocalDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/

export const DayAheadPriceRecord = z.object({
  TimeUTC: z.string().regex(isoLocalDateTimePattern),
  TimeDK: z.string().regex(isoLocalDateTimePattern),
  PriceArea: z.literal('DK1'),
  DayAheadPriceDKK: z.number(),
  DayAheadPriceEUR: z.number(),
})

export const DayAheadPricesResponse = z.object({
  dataset: z.literal('DayAheadPrices'),
  records: z.array(DayAheadPriceRecord),
})

export interface DayAheadPriceRecord extends z.infer<typeof DayAheadPriceRecord> {}
export interface DayAheadPricesResponse extends z.infer<typeof DayAheadPricesResponse> {}
