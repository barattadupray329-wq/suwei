import { getFinanceData } from '@/app/actions/business'
import { FinanceLedger } from '@/components/finance-ledger'
import { getAccessContext } from '@/lib/access'

export default async function Page() {
  await getAccessContext('资金查看')
  return <FinanceLedger data={await getFinanceData()} />
}
