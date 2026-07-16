import { getContract } from '@/app/actions/business'
import { ContractDocument } from '@/components/contract-document'
export default async function Page({params}:{params:Promise<{id:string}>}){const{id}=await params;return <ContractDocument data={await getContract(Number(id))}/>}
