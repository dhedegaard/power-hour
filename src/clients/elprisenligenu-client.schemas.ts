import z from 'zod'

const isoOffsetDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/

export const DailyPriceRecord = z.object({
  DKK_per_kWh: z.number(),
  EUR_per_kWh: z.number(),
  EXR: z.number(),
  time_start: z.string().regex(isoOffsetDateTimePattern),
  time_end: z.string().regex(isoOffsetDateTimePattern),
})

export const DailyPricesResponse = z.array(DailyPriceRecord)

export interface DailyPriceRecord extends z.infer<typeof DailyPriceRecord> {}
export interface DailyPricesResponse extends z.infer<typeof DailyPricesResponse> {}
