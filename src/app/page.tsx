import { getPriceHistory } from "@/clients/nrgi-client";
import { addDays } from 'date-fns';
import { use } from "react";

export default function Home() {
  const today = new Date()
  today.setHours(0,0,0,0)

  const data = use(getPriceHistory({
    region: 'DK1',
    from: addDays(today, 0).toISOString(),
    to: addDays(today, 7).toISOString(),
    includeGrid: false,
  }))

  return (<>
    <div>TODO:</div>
    <pre>
      {JSON.stringify(data.prices, null, 2)}
    </pre>
</>
 );
}
