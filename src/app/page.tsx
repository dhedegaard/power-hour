import { getDailyPrices } from '@/clients/energidata-client'
import { cacheLife } from 'next/cache'

type HourlyPriceRow = {
  date: string
  localTime: string
  priceDkkPerKwh: number | null
  source: 'published' | 'estimated' | 'unavailable'
}

type DayPriceCard = {
  date: string
  label: string
  hours: HourlyPriceRow[]
}

type HistoricalDay = {
  date: string
  prices: Awaited<ReturnType<typeof getDailyPrices>>
}

const targetHours = [
  '07:00',
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
] as const

const datePartFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Copenhagen',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const cardLabelFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Copenhagen',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

function formatDateParts(date: Date) {
  const parts = Object.fromEntries(
    datePartFormatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  )

  return {
    dayKey: `${parts.year}-${parts.month}-${parts.day}`,
  }
}

function dayKeyToDate(dayKey: string) {
  const [year, month, day] = dayKey.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function addDays(dayKey: string, daysToAdd: number) {
  const date = dayKeyToDate(dayKey)
  date.setUTCDate(date.getUTCDate() + daysToAdd)

  return formatDateParts(date).dayKey
}

function getPriceColorClass(priceDkkPerKwh: number) {
  if (priceDkkPerKwh <= 0.3) {
    return 'text-emerald-700 font-semibold'
  }

  if (priceDkkPerKwh <= 0.8) {
    return 'text-yellow-600'
  }

  return 'text-red-700'
}

function getDayLabel(dayKey: string, offset: number) {
  if (offset === 0) {
    return 'Today'
  }

  if (offset === 1) {
    return 'Tomorrow'
  }

  return cardLabelFormatter.format(dayKeyToDate(dayKey))
}

function getPublishedHourlyPrice(
  dayKey: string,
  localTime: (typeof targetHours)[number],
  dailyPrices: Awaited<ReturnType<typeof getDailyPrices>>
) {
  const hourStart = `${dayKey}T${localTime}:00`
  const nextHour = `${String(Number.parseInt(localTime.slice(0, 2), 10) + 1).padStart(2, '0')}:00:00`
  const hourPrices =
    dailyPrices?.records.filter((entry) => {
      return entry.TimeDK >= hourStart && entry.TimeDK < `${dayKey}T${nextHour}`
    }) ?? []

  const hasCompleteHour =
    hourPrices.length === 4 &&
    ['00', '15', '30', '45'].every((minutes) =>
      hourPrices.some(
        (entry) => entry.TimeDK === `${dayKey}T${localTime.slice(0, 2)}:${minutes}:00`
      )
    )

  if (!hasCompleteHour) {
    return null
  }

  const averageHourPriceDkk =
    hourPrices.reduce((sum, entry) => sum + entry.DayAheadPriceDKK, 0) / hourPrices.length

  return averageHourPriceDkk / 1000
}

function getWeekdayIndex(dayKey: string) {
  return dayKeyToDate(dayKey).getUTCDay()
}

function getEstimatedHourlyPrice(
  targetDayKey: string,
  localTime: (typeof targetHours)[number],
  historicalDays: HistoricalDay[]
) {
  const targetWeekday = getWeekdayIndex(targetDayKey)
  const samples = historicalDays.flatMap((historicalDay) => {
    const price = getPublishedHourlyPrice(historicalDay.date, localTime, historicalDay.prices)

    if (price === null) {
      return []
    }

    const weight = getWeekdayIndex(historicalDay.date) === targetWeekday ? 2 : 1

    return [{ price, weight }]
  })

  if (samples.length < 3) {
    return null
  }

  const totalWeight = samples.reduce((sum, sample) => sum + sample.weight, 0)
  const weightedSum = samples.reduce((sum, sample) => sum + sample.price * sample.weight, 0)

  return weightedSum / totalWeight
}

function getHourlyRow(
  dayKey: string,
  localTime: (typeof targetHours)[number],
  dailyPrices: Awaited<ReturnType<typeof getDailyPrices>>,
  historicalDays: HistoricalDay[]
): HourlyPriceRow {
  const publishedPrice = getPublishedHourlyPrice(dayKey, localTime, dailyPrices)

  if (publishedPrice !== null) {
    return {
      date: dayKey,
      localTime,
      priceDkkPerKwh: publishedPrice,
      source: 'published',
    }
  }

  const estimatedPrice = getEstimatedHourlyPrice(dayKey, localTime, historicalDays)

  if (estimatedPrice !== null) {
    return {
      date: dayKey,
      localTime,
      priceDkkPerKwh: estimatedPrice,
      source: 'estimated',
    }
  }

  return {
    date: dayKey,
    localTime,
    priceDkkPerKwh: null,
    source: 'unavailable',
  }
}

async function getPricePageData(now: Date) {
  'use cache'
  cacheLife('minutes')

  const todayKey = formatDateParts(now).dayKey
  const historicalDayKeys = Array.from({ length: 7 }, (_, index) => addDays(todayKey, -(7 - index)))
  const visibleDayKeys = Array.from({ length: 7 }, (_, index) => addDays(todayKey, index))

  const historicalPriceResponses = await Promise.all(
    historicalDayKeys.map(async (dayKey) => ({
      date: dayKey,
      prices: await getDailyPrices({ dayKey, priceArea: 'DK1' }),
    }))
  )

  const visiblePriceResponses = await Promise.all(
    visibleDayKeys.map(async (dayKey) => ({
      date: dayKey,
      prices: await getDailyPrices({ dayKey, priceArea: 'DK1' }),
    }))
  )

  return visiblePriceResponses.map((day, index) => ({
    date: day.date,
    label: getDayLabel(day.date, index),
    hours: targetHours.map((hour) =>
      getHourlyRow(day.date, hour, day.prices, historicalPriceResponses)
    ),
  })) satisfies DayPriceCard[]
}

export default async function RootPage() {
  'use cache'
  cacheLife('minutes')

  const dayCards = await getPricePageData(new Date())
  const publishedHours = dayCards
    .flatMap((dayCard) => dayCard.hours)
    .filter((row) => row.source === 'published')
  const estimatedHours = dayCards
    .flatMap((dayCard) => dayCard.hours)
    .filter((row) => row.source === 'estimated')

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-12 sm:px-10">
      <header className="space-y-3">
        <p className="text-sm font-medium tracking-[0.2em] text-slate-500 uppercase">Power Hour</p>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
            Daytime electricity prices
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Danish average prices for 07:00 through 20:00 for the next 7 days, sourced from{' '}
            <a
              className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-4"
              href="https://www.energidataservice.dk/"
            >
              Energi Data Service
            </a>
            . When DayAhead prices are not published yet, the page shows server-side estimates based
            on recent same-hour data.
          </p>
        </div>
      </header>

      <section className="flex flex-col gap-4">
        {dayCards.map((dayCard) => {
          const featuredRow =
            dayCard.hours.find((row) => row.localTime === '12:00') ?? dayCard.hours[0]
          const hasNumericHours = dayCard.hours.some((row) => row.priceDkkPerKwh !== null)
          const featuredPriceClass =
            featuredRow.priceDkkPerKwh !== null
              ? getPriceColorClass(featuredRow.priceDkkPerKwh)
              : 'text-amber-950'

          return (
            <article
              key={dayCard.date}
              className={`rounded-3xl border p-4 shadow-sm sm:p-6 ${
                hasNumericHours ? 'border-slate-200 bg-white' : 'border-amber-200 bg-amber-50'
              }`}
            >
              <p
                className={`text-sm font-medium tracking-[0.2em] uppercase ${
                  hasNumericHours ? 'text-slate-500' : 'text-amber-700'
                }`}
              >
                {dayCard.label}
              </p>
              <div className="mt-4 flex flex-col gap-6 xl:flex-row xl:items-start xl:gap-4">
                <div className="space-y-6 xl:max-w-sm xl:min-w-[20rem]">
                  <div>
                    <div
                      className={`text-5xl font-semibold tracking-tight sm:text-6xl ${featuredPriceClass}`}
                    >
                      {featuredRow.priceDkkPerKwh !== null
                        ? `${featuredRow.priceDkkPerKwh.toFixed(2)} kr/kWh`
                        : 'Unpublished'}
                    </div>
                    <p
                      className={`mt-3 text-sm leading-6 sm:text-base ${
                        featuredRow.source === 'unavailable' ? 'text-amber-900' : 'text-slate-600'
                      }`}
                    >
                      {featuredRow.source === 'published' &&
                        `Published average at ${featuredRow.localTime} on ${featuredRow.date}.`}
                      {featuredRow.source === 'estimated' && (
                        <>
                          Estimated average at {featuredRow.localTime} on {featuredRow.date},<br />
                          based on recent same-hour prices.
                        </>
                      )}
                      {featuredRow.source === 'unavailable' &&
                        `The ${featuredRow.localTime} average for ${featuredRow.date} is not available yet and could not be estimated from recent data.`}
                    </p>
                  </div>
                  <div
                    className={`flex flex-wrap gap-3 text-sm ${
                      featuredRow.source === 'unavailable' ? 'text-amber-900' : 'text-slate-600'
                    }`}
                  >
                    <span
                      className={`inline-flex rounded-full px-3 py-1 font-medium ${
                        featuredRow.source === 'unavailable'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {featuredRow.localTime} DK time
                    </span>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 font-medium ${
                        featuredRow.source === 'published'
                          ? 'bg-emerald-100 text-emerald-800'
                          : featuredRow.source === 'estimated'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {featuredRow.source === 'published'
                        ? 'Published'
                        : featuredRow.source === 'estimated'
                          ? 'Estimated'
                          : 'Unavailable'}
                    </span>
                  </div>
                </div>
                <div className="min-w-0 flex-1 overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="min-w-full border-collapse text-left text-sm">
                    <tbody>
                      <tr className="bg-slate-50 text-slate-600">
                        <th className="px-3 py-2 font-medium">Time</th>
                        {dayCard.hours.map((row) => (
                          <th
                            key={`${dayCard.date}-${row.localTime}-time`}
                            className={`px-2 py-2 text-center font-medium ${
                              row.source === 'unavailable' ? 'text-amber-900' : 'text-slate-700'
                            }`}
                          >
                            {row.localTime}
                          </th>
                        ))}
                      </tr>
                      <tr className="border-t border-slate-200">
                        <th className="px-3 py-2 font-medium text-slate-600">Price kr/kWh</th>
                        {dayCard.hours.map((row) => (
                          <td
                            key={`${dayCard.date}-${row.localTime}-price`}
                            className={`px-2 py-2 text-center ${
                              row.source === 'unavailable'
                                ? 'bg-amber-50 text-amber-950'
                                : row.source === 'estimated'
                                  ? `bg-yellow-50 ${row.priceDkkPerKwh !== null ? getPriceColorClass(row.priceDkkPerKwh) : 'text-yellow-800'}`
                                  : `bg-white ${row.priceDkkPerKwh !== null ? getPriceColorClass(row.priceDkkPerKwh) : 'text-slate-900'}`
                            }`}
                          >
                            {row.source === 'published' && `${row.priceDkkPerKwh?.toFixed(2)}`}
                            {row.source === 'estimated' && `${row.priceDkkPerKwh?.toFixed(2)}*`}
                            {row.source === 'unavailable' && 'Unpublished'}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </article>
          )
        })}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm sm:p-8">
        <p className="text-sm font-medium tracking-[0.2em] text-slate-500 uppercase">Overview</p>
        <div className="mt-4 space-y-3 text-sm text-slate-600 sm:text-base">
          <p>
            {publishedHours.length} published and {estimatedHours.length} estimated hourly prices
            are shown across {dayCards.length} days.
          </p>
          <p>
            The source uses Energinet&apos;s DayAheadPrices dataset for DK1 and averages the four
            15-minute rows for each tracked hour from 07:00 through 20:59.
          </p>
          <p>
            Missing future hours are estimated on the server from recent same-hour prices with extra
            weekday weighting.
          </p>
        </div>
      </section>
    </main>
  )
}
