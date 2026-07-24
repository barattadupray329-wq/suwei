import { getRentalTrash } from '@/app/actions/rentals'
import { RentalTrash } from '@/components/rental-trash'

export default async function RentalTrashPage() {
  const rows = await getRentalTrash()
  return <RentalTrash rows={rows} />
}
