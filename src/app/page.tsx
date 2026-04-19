import { getPriceHistory } from '@/clients/nrgi-client'
import { cacheLife } from 'next/cache'

export default async function RootPage() {
  'use cache'
  cacheLife('minutes')

  const data = await getPriceHistory({
    region: 'DK1',
    date: new Date(),
  })

  return (
    <>
      <div>TODO:</div>
      <pre>{JSON.stringify(data.prices, null, 2)}</pre>
    </>
  )
}
