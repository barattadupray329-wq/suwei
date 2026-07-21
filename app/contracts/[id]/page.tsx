import { getContract } from '@/app/actions/business'
import { ContractDocument } from '@/components/contract-document'
import { getAccessContext } from '@/lib/access'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await getAccessContext('合同管理')
  const { id } = await params
  return <ContractDocument data={await getContract(Number(id))} />
}
