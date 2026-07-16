import { getFinanceData } from '@/app/actions/business'
import { FinancePage } from '@/components/business-pages'
export default async function Page(){return <FinancePage data={await getFinanceData()}/>}
