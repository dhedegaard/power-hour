import { getDailyPrices } from '@/clients/energidata-client'
import { cacheLife } from 'next/cache'

type HourlyPriceRow = {
  date: string
  localTime: string
  priceDkkPerKwh: number | null
  status: 'available' | 'unavailable'
}

type DayPriceCard = {
  date: string
  hours: HourlyPriceRow[]
}

const targetHours = [
  '06:00',
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
  '21:00',
  '22:00',
] as const

const datePartFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Copenhagen',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
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

function addDays(dayKey: string, daysToAdd: number) {
  const [year, month, day] = dayKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + daysToAdd)

  return formatDateParts(date).dayKey
}

function getHourlyRow(
  dayKey: string,
  localTime: (typeof targetHours)[number],
  dailyPrices: Awaited<ReturnType<typeof getDailyPrices>>
): HourlyPriceRow {
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
        (entry) =>
          entry.TimeDK === `${dayKey}T${localTime.slice(0, 2)}:${minutes}:00`
      )
    )

  if (!hasCompleteHour) {
    return {
      date: dayKey,
      localTime,
      priceDkkPerKwh: null,
      status: 'unavailable',
    }
  }

  const averageHourPriceDkk =
    hourPrices.reduce((sum, entry) => sum + entry.DayAheadPriceDKK, 0) / hourPrices.length

  return {
    date: dayKey,
    localTime,
    priceDkkPerKwh: averageHourPriceDkk / 1000,
    status: 'available',
  }
}

async function getPricePageData(now: Date) {
  'use cache'
  cacheLife('minutes')

  const todayKey = formatDateParts(now).dayKey
  const tomorrowKey = addDays(todayKey, 1)

  const [todayPrices, tomorrowPrices] = await Promise.all([
    getDailyPrices({ dayKey: todayKey, priceArea: 'DK1' }),
    getDailyPrices({ dayKey: tomorrowKey, priceArea: 'DK1' }),
  ])

  return [
    {
      date: todayKey,
      hours: targetHours.map((hour) => getHourlyRow(todayKey, hour, todayPrices)),
    },
    {
      date: tomorrowKey,
      hours: targetHours.map((hour) => getHourlyRow(tomorrowKey, hour, tomorrowPrices)),
    },
  ] satisfies DayPriceCard[]
}

export default async function RootPage() {
  'use cache'
  cacheLife('minutes')

  const dayCards = await getPricePageData(new Date())
  const availableHours = dayCards.flatMap((dayCard) => dayCard.hours).filter((row) => row.status === 'available')

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-12 sm:px-10">
      <header className="space-y-3">
        <p className="text-sm font-medium tracking-[0.2em] text-slate-500 uppercase">Power Hour</p>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">DK1 daytime electricity prices</h1>
          <p className="max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Danish DK1 average prices for 06:00 through 22:00 today and tomorrow, sourced from{' '}
            <a
              className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-4"
              href="https://www.energidataservice.dk/"
            >
              Energi Data Service
            </a>
            . Tomorrow appears when Energinet has published that day&apos;s DayAheadPrices rows.
          </p>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        {dayCards.map((dayCard, index) => {
          const featuredRow = dayCard.hours.find((row) => row.localTime === '12:00') ?? dayCard.hours[0]
          const secondaryRows = dayCard.hours.filter((row) => row.localTime !== featuredRow.localTime)
          const hasAvailableHours = dayCard.hours.some((row) => row.status === 'available')

          return (
            <article
              key={dayCard.date}
              className={`rounded-3xl border p-6 shadow-sm sm:p-8 ${
                hasAvailableHours ? 'border-slate-200 bg-white' : 'border-amber-200 bg-amber-50'
              }`}
            >
              <p
                className={`text-sm font-medium tracking-[0.2em] uppercase ${
                  hasAvailableHours ? 'text-slate-500' : 'text-amber-700'
                }`}
              >
              {index === 0 ? 'Today' : 'Tomorrow'}
              </p>
              <div className="mt-4 space-y-6">
                <div>
                  <div
                    className={`text-5xl font-semibold tracking-tight sm:text-6xl ${
                      featuredRow.status === 'available' ? 'text-slate-900' : 'text-amber-950'
                    }`}
                  >
                    {featuredRow.status === 'available'
                      ? `${featuredRow.priceDkkPerKwh?.toFixed(2)} kr/kWh`
                      : 'Not published'}
                  </div>
                  <p
                    className={`mt-3 text-sm leading-6 sm:text-base ${
                      featuredRow.status === 'available' ? 'text-slate-600' : 'text-amber-900'
                    }`}
                  >
                    {featuredRow.status === 'available'
                      ? `Average DK1 price at ${featuredRow.localTime} on ${featuredRow.date}.`
                      : `The ${featuredRow.localTime} DK1 average for ${featuredRow.date} is not available from Energi Data Service yet.`}
                  </p>
                </div>
                <div
                  className={`flex flex-wrap gap-3 text-sm ${
                    featuredRow.status === 'available' ? 'text-slate-600' : 'text-amber-900'
                  }`}
                >
                  <span
                    className={`inline-flex rounded-full px-3 py-1 font-medium ${
                      featuredRow.status === 'available'
                        ? 'bg-slate-100 text-slate-700'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {featuredRow.localTime} DK time
                  </span>
                  <span
                    className={`inline-flex rounded-full px-3 py-1 font-medium ${
                      featuredRow.status === 'available'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {featuredRow.status === 'available' ? 'Published' : 'Pending'}
                  </span>
                </div>
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-4 py-3 font-medium">Time</th>
                        <th className="px-4 py-3 font-medium">Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {secondaryRows.map((row) => (
                        <tr
                          key={`${dayCard.date}-${row.localTime}`}
                          className={
                            row.status === 'available'
                              ? 'border-t border-slate-200 bg-white'
                              : 'border-t border-amber-200 bg-amber-50'
                          }
                        >
                          <td
                            className={`px-4 py-3 font-medium ${
                              row.status === 'available' ? 'text-slate-800' : 'text-amber-950'
                            }`}
                          >
                            {row.localTime}
                          </td>
                          <td
                            className={`px-4 py-3 ${
                              row.status === 'available' ? 'text-slate-900' : 'text-amber-950'
                            }`}
                          >
                            {row.status === 'available' ? `${row.priceDkkPerKwh?.toFixed(2)} kr/kWh` : 'Unpublished'}
                          </td>
                        </tr>
                      ))}
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
          <p>{availableHours.length} of {dayCards.length * targetHours.length} tracked hourly prices are currently published.</p>
          <p>The source uses Energinet&apos;s DayAheadPrices dataset for DK1 and averages the four 15-minute rows for each tracked hour from 06:00 through 22:59.</p>
          <p>Prices are shown without adding client-side fetching or changing the route structure.</p>
        </div>
      </section>
    </main>
  )
}
