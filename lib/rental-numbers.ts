import type { RentalItemInput } from '@/app/actions/rentals'

type NumberItem = Pick<RentalItemInput, 'deviceType' | 'quantity'>

const prefixByType = {
  台式机: 'PC',
  笔记本: 'NB',
  显示器: 'MON',
  一体机: 'AIO',
  其他: 'DEV',
} as const

export function normalizeRentalDate(
  value: string,
  fallback = new Date().toISOString().slice(0, 10),
) {
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
  const contractSequence =
    Math.max(
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
    for (const segment of code.split('～')) {
      const match = segment.match(/^([A-Z]+)(\d{8})-(\d+)$/)
      if (!match || match[2] !== stamp) continue
      counters.set(
        match[1],
        Math.max(counters.get(match[1]) ?? 0, Number(match[3])),
      )
    }
  }

  const deviceCodes = items.map((item) => {
    const prefix = prefixByType[item.deviceType]
    const start = (counters.get(prefix) ?? 0) + 1
    const end =
      start + Math.max(1, Math.floor(Number(item.quantity) || 1)) - 1
    counters.set(prefix, end)
    const first = `${prefix}${stamp}-${String(start).padStart(3, '0')}`
    return end === start
      ? first
      : `${first}～${prefix}${stamp}-${String(end).padStart(3, '0')}`
  })

  return {
    contractNo: `${contractPrefix}${String(contractSequence).padStart(3, '0')}`,
    deviceCodes,
  }
}

export function buildRentalNumberPreview(
  startDate: string,
  items: NumberItem[],
) {
  return buildRentalNumbers(startDate, items)
}

export function buildNextDeviceCode(
  date: string,
  deviceType: RentalItemInput['deviceType'],
  existingDeviceCodes: Array<string | null> = [],
) {
  return buildRentalNumbers(
    date,
    [{ deviceType, quantity: 1 }],
    [],
    existingDeviceCodes,
  ).deviceCodes[0]
}

export function expandDeviceCodes(value: string | null | undefined, expected?: number) {
  const raw = value?.trim()
  if (!raw) return []
  const parts = raw.split(/\s*[～~]\s*/)
  if (parts.length === 1) return expected && expected > 1 ? [] : [raw]
  if (parts.length !== 2) return []
  const start = parts[0].match(/^(.*?)(\d+)$/)
  const end = parts[1].match(/^(.*?)(\d+)$/)
  if (!start || !end) return []
  const prefix = end[1] || start[1]
  if ((end[1] && end[1] !== start[1]) || !prefix) return []
  const first = Number(start[2])
  const last = Number(end[2])
  if (last < first || last - first > 999) return []
  const width = Math.max(start[2].length, end[2].length)
  const codes = Array.from({ length: last - first + 1 }, (_, index) => `${prefix}${String(first + index).padStart(width, '0')}`)
  return expected && codes.length !== expected ? [] : codes
}

export function compressDeviceCodes(codes: string[]) {
  if (codes.length === 0) return ''
  if (codes.length === 1) return codes[0]
  const parsed = codes.map((code) => code.match(/^(.*?)(\d+)$/))
  if (parsed.some((item) => !item)) return codes.join('、')
  const prefix = parsed[0]![1]
  const numbers = parsed.map((item) => Number(item![2]))
  const consecutive = parsed.every((item) => item![1] === prefix) && numbers.every((number, index) => index === 0 || number === numbers[index - 1] + 1)
  return consecutive ? `${codes[0]}～${codes[codes.length - 1]}` : codes.join('、')
}
