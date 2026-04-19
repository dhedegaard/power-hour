import { getDailyPrices } from '@/clients/elprisenligenu-client'
import { cacheLife } from 'next/cache'

type NoonPriceRow = {
  date: string
  localTime: string
  priceDkkPerKwh: number | null
  status: 'available' | 'unavailable'
}

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

function getNoonRow(dayKey: string, dailyPrices: Awaited<ReturnType<typeof getDailyPrices>>): NoonPriceRow {
  const noonPrice = dailyPrices?.find((entry) => {
    return entry.time_start.slice(0, 10) === dayKey && entry.time_start.slice(11, 16) === '12:00'
  })

  if (!noonPrice) {
    return {
      date: dayKey,
      localTime: '12:00',
      priceDkkPerKwh: null,
      status: 'unavailable',
    }
  }

  return {
    date: dayKey,
    localTime: '12:00',
    priceDkkPerKwh: noonPrice.DKK_per_kWh,
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

  return [getNoonRow(todayKey, todayPrices), getNoonRow(tomorrowKey, tomorrowPrices)]
}

export default async function RootPage() {
  'use cache'
  cacheLife('minutes')

  const rows = await getPricePageData(new Date())
  const availableRows = rows.filter((row) => row.status === 'available')

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-12 sm:px-10">
      <header className="space-y-3">
        <p className="text-sm font-medium tracking-[0.2em] text-slate-500 uppercase">Power Hour</p>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">DK1 noon electricity prices</h1>
          <p className="max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Danish noon snapshots for today and tomorrow in DK1, sourced from{' '}
            <a
              className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-4"
              href="https://www.elprisenligenu.dk/elpris-api"
            >
              Elprisen lige nu
            </a>
            . Tomorrow appears when that day&apos;s file has been published.
          </p>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        {rows.map((row, index) => (
          <article
            key={row.date}
            className={`rounded-3xl border p-6 shadow-sm sm:p-8 ${
              row.status === 'available'
                ? 'border-slate-200 bg-white'
                : 'border-amber-200 bg-amber-50'
            }`}
          >
            <p
              className={`text-sm font-medium tracking-[0.2em] uppercase ${
                row.status === 'available' ? 'text-slate-500' : 'text-amber-700'
              }`}
            >
              {index === 0 ? 'Today' : 'Tomorrow'}
            </p>
            <div className="mt-4 space-y-4">
              <div>
                <div
                  className={`text-5xl font-semibold tracking-tight sm:text-6xl ${
                    row.status === 'available' ? 'text-slate-900' : 'text-amber-950'
                  }`}
                >
                  {row.status === 'available' ? `${row.priceDkkPerKwh?.toFixed(2)} kr/kWh` : 'Not published'}
                </div>
                <p
                  className={`mt-3 text-sm leading-6 sm:text-base ${
                    row.status === 'available' ? 'text-slate-600' : 'text-amber-900'
                  }`}
                >
                  {row.status === 'available'
                    ? `DK1 price at ${row.localTime} on ${row.date}.`
                    : `The ${row.localTime} DK1 price for ${row.date} is not available from Elprisen lige nu yet.`}
                </p>
              </div>
              <div
                className={`flex flex-wrap gap-3 text-sm ${
                  row.status === 'available' ? 'text-slate-600' : 'text-amber-900'
                }`}
              >
                <span
                  className={`inline-flex rounded-full px-3 py-1 font-medium ${
                    row.status === 'available'
                      ? 'bg-slate-100 text-slate-700'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {row.localTime} DK time
                </span>
                <span
                  className={`inline-flex rounded-full px-3 py-1 font-medium ${
                    row.status === 'available'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {row.status === 'available' ? 'Published' : 'Pending'}
                </span>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm sm:p-8">
        <p className="text-sm font-medium tracking-[0.2em] text-slate-500 uppercase">Overview</p>
        <div className="mt-4 space-y-3 text-sm text-slate-600 sm:text-base">
          <p>{availableRows.length} of 2 noon prices are currently published.</p>
          <p>The source provides day-based JSON files for DK1 and typically exposes today plus tomorrow.</p>
          <p>Prices are shown without adding client-side fetching or changing the route structure.</p>
        </div>
      </section>
    </main>
  )
}
