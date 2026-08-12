export type RentalCompletionKind = 'buyout' | 'returned' | 'mixed' | 'closed'

export type RentalCompletion = {
  kind: RentalCompletionKind
  label: string
  detail: string
}

export function getRentalCompletion(input: {
  outstandingCents: number
  totalDevices: number
  remainingDevices: number
  returnedDevices: number
  boughtOutDevices: number
  lostDevices?: number
}): RentalCompletion | null {
  if (
    input.outstandingCents !== 0 ||
    input.totalDevices <= 0 ||
    input.remainingDevices !== 0
  ) return null

  if (input.boughtOutDevices === input.totalDevices) {
    return { kind: 'buyout', label: '买断完成', detail: '全部设备已买断' }
  }
  if (input.returnedDevices === input.totalDevices) {
    return { kind: 'returned', label: '退回完成', detail: '全部设备已退回' }
  }
  if (input.returnedDevices > 0 || input.boughtOutDevices > 0) {
    const actions = [
      input.boughtOutDevices > 0 ? '买断' : '',
      input.returnedDevices > 0 ? '退回' : '',
      (input.lostDevices ?? 0) > 0 ? '丢失结案' : '',
    ].filter(Boolean)
    return { kind: 'mixed', label: '订单完成', detail: actions.join(' + ') }
  }
  return { kind: 'closed', label: '结案完成', detail: '设备已全部处置' }
}

export function isSettledReturnedRental(input: {
  status: string
  outstandingCents: number
  remainingDevices?: number
}) {
  return (
    ['已退租', '已结束', '已关闭', '已完成'].includes(input.status) &&
    input.outstandingCents === 0 &&
    (input.remainingDevices === undefined || input.remainingDevices === 0)
  )
}
