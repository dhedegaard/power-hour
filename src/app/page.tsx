import { getPriceHistory } from '@/clients/nrgi-client'
import { addDays, format, isWeekend } from 'date-fns'
import { cacheLife } from 'next/cache'

type NoonPriceRow =
  | {
      status: 'available'
      date: string
      localTime: string
      kwPrice: number
      totalPriceInclVat: number
      isPrediction: boolean
    }
  | {
      status: 'unavailable'
      date: string
      localTime: null
      kwPrice: null
      totalPriceInclVat: null
      isPrediction: false
    }

async function getNoonPriceRows(startDate: Date): Promise<NoonPriceRow[]> {
  'use cache'
  cacheLife('minutes')

  const dates = Array.from({ length: 8 }, (_, index) => {
    const date = addDays(startDate, index)
    date.setHours(0, 0, 0, 0)
    return date
  })

  const priceHistory = await Promise.all(
    dates.map((date) =>
      getPriceHistory({
        region: 'DK1',
        date,
      })
    )
  )

  return dates.map((date, index) => {
    const noonPrice = priceHistory[index].prices.find(
      (price) => price.localTime.slice(11, 16) === '12:00'
    )

    if (!noonPrice) {
      return {
        status: 'unavailable',
        date: format(date, 'yyyy-MM-dd'),
        localTime: null,
        kwPrice: null,
        totalPriceInclVat: null,
        isPrediction: false,
      }
    }

    return {
      status: 'available',
      date: format(date, 'yyyy-MM-dd'),
      localTime: noonPrice.localTime,
      kwPrice: noonPrice.kwPrice,
      totalPriceInclVat: noonPrice.totalPriceInclVat,
      isPrediction: noonPrice.isPrediction,
    }
  })
}

export default async function RootPage() {
  'use cache'
  cacheLife('minutes')

  const startDate = new Date()
  startDate.setHours(0, 0, 0, 0)

  const rows = await getNoonPriceRows(startDate)
  const endDate = addDays(startDate, 7)

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-12 sm:px-10">
      <header className="space-y-3">
        <p className="text-sm font-medium tracking-[0.2em] text-slate-500 uppercase">Power Hour</p>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
            DK1 noon electricity prices
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Local noon snapshots for {format(startDate, 'MMMM d, yyyy')} through{' '}
            {format(endDate, 'MMMM d, yyyy')}. Future dates may be marked as predictions when the
            source is serving estimated prices.
          </p>
        </div>
      </header>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full border-collapse text-left">
          <thead className="bg-slate-50">
            <tr className="text-sm text-slate-600">
              <th className="px-4 py-3 font-medium sm:px-6">Date</th>
              <th className="px-4 py-3 font-medium sm:px-6">Local time</th>
              <th className="px-4 py-3 font-medium sm:px-6">kWh price</th>
              <th className="px-4 py-3 font-medium sm:px-6">Type</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const rowDate = new Date(`${row.date}T00:00:00`)
              const weekend = isWeekend(rowDate)

              return (
                <tr
                  key={row.date}
                  className={`border-t text-sm ${
                    weekend
                      ? 'border-slate-100 bg-slate-50/70 text-slate-400'
                      : 'border-slate-200 text-slate-700'
                  }`}
                >
                  <td className="px-4 py-4 sm:px-6">
                    <div className={weekend ? 'font-medium text-slate-500' : 'font-medium text-slate-900'}>
                      {format(rowDate, 'EEEE')}
                    </div>
                    <div className={weekend ? 'text-slate-400' : 'text-slate-500'}>{row.date}</div>
                  </td>
                  <td className="px-4 py-4 sm:px-6">
                    {row.status === 'available' ? row.localTime.slice(11, 16) : 'Unavailable'}
                  </td>
                  <td className="px-4 py-4 sm:px-6">
                    {row.status === 'available'
                      ? `${(row.kwPrice / 100).toFixed(2)} kr/kWh`
                      : 'Unavailable'}
                  </td>
                  <td className="px-4 py-4 sm:px-6">
                    {row.status === 'available' ? (
                      <span
                        className={
                          row.isPrediction
                            ? 'inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800'
                            : 'inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800'
                        }
                      >
                        {row.isPrediction ? 'Prediction' : 'Actual'}
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        Unavailable
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </main>
  )
}
