import { getRentalAssignees } from '@/app/actions/rentals'
import { DraftImport } from '@/components/draft-import'

export const metadata = { title: '批量导入草稿' }

export default async function DraftImportPage() {
  const assignees = await getRentalAssignees()
  return <DraftImport assignees={assignees} />
}
