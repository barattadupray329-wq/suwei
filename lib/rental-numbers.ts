import type { RentalItemInput } from '@/app/actions/rentals'

type NumberItem = Pick<RentalItemInput, 'deviceType' | 'quantity'>

const prefixByType = {
  台式机: 'PC',
  笔记本: 'NB',
  显示器: 'MON',
  一体机: 'AIO',
  其他: 'DEV',
} as const

export function normalizeRentalDate(value: string, fallback = new Date().toISOString().slice(0, 10)) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback
}

export function buildRentalNumbers(
  startDate: string,
  items: NumberItem[],
  existingContractNumbers: Array<string | null> = [],
  existingDeviceCodes: Array<string | null> = [],
) {
  const stamp = normalizeRentalDate(startDate).replaceAll('-', '')
  const contractPrefix = `HT${stamp}-`
  const contractSequence = Math.max(
    0,
    ...existingContractNumbers.map((number) => {
      if (!number?.startsWith(contractPrefix)) return 0
      const suffix = number.slice(contractPrefix.length)
      return /^\d+$/.test(suffix) ? Number(suffix) : 0
    }),
  ) + 1

  const counters = new Map<string, number>()
  for (const code of existingDeviceCodes) {
    if (!code) continue
    const segments = code.split('～')
    for (const segment of segments) {
      const match = segment.match(/^([A-Z]+)(\d{8})-(\d+)$/)
      if (!match || match[2] !== stamp) continue
      counters.set(match[1], Math.max(counters.get(match[1]) ?? 0, Number(match[3])))
    }
  }

  const deviceCodes = items.map((item) => {
    const prefix = prefixByType[item.deviceType]
    const start = (counters.get(prefix) ?? 0) + 1
    const end = start + Math.max(1, Math.floor(Number(item.quantity) || 1)) - 1
    counters.set(prefix, end)
    const first = `${prefix}${stamp}-${String(start).padStart(3, '0')}`
    return end === start ? first : `${first}～${prefix}${stamp}-${String(end).padStart(3, '0')}`
  })

  return {
    contractNo: `${contractPrefix}${String(contractSequence).padStart(3, '0')}`,
    deviceCodes,
  }
}

export function buildRentalNumberPreview(startDate: string, items: NumberItem[]) {
  return buildRentalNumbers(startDate, items)
}
