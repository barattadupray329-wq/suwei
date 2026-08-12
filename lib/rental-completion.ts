export function isSettledReturnedRental(input: {
  status: string
  outstandingCents: number
  remainingDevices?: number
}) {
  return (
    input.status === '已退租' &&
    input.outstandingCents === 0 &&
    (input.remainingDevices === undefined || input.remainingDevices === 0)
  )
}
