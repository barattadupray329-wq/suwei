import fs from 'node:fs'

function extractResults(path) {
  const raw = JSON.parse(fs.readFileSync(path, 'utf8'))
  return raw[0]?.results ?? []
}

function addCalendarDays(date, days) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
function addCalendarMonths(date, months) {
  const [y, m, d] = date.split('-').map(Number)
  const total = (y * 12 + (m - 1)) + months
  const ny = Math.floor(total / 12)
  const nm = total % 12
  const daysInMonth = new Date(ny, nm + 1, 0).getDate()
  const nd = Math.min(d, daysInMonth)
  return `${ny}-${String(nm + 1).padStart(2, '0')}-${String(nd).padStart(2, '0')}`
}
function overdueRentPeriods(endDate, today) {
  const periods = []
  let periodStart = addCalendarDays(endDate, 1)
  while (periodStart <= today) {
    const periodEnd = addCalendarMonths(periodStart, 1)
    periods.push({ periodStart, periodEnd })
    periodStart = periodEnd
  }
  return periods
}

const today = '2026-08-25'
const rentals = extractResults('/tmp/all_monthly_rentals.json')
const items = extractResults('/tmp/all_items2.json')
const overdueBills = extractResults('/tmp/all_overdue_bills.json')

const itemsByRental = new Map()
for (const item of items) {
  const arr = itemsByRental.get(item.rentalId) ?? []
  arr.push(item)
  itemsByRental.set(item.rentalId, arr)
}
const overdueByRental = new Map()
for (const bill of overdueBills) {
  const arr = overdueByRental.get(bill.rentalId) ?? []
  arr.push(bill)
  overdueByRental.set(bill.rentalId, arr)
}

const missing = []
for (const rental of rentals) {
  const rentalItems = itemsByRental.get(rental.id) ?? []
  const groups = new Map()
  for (const item of rentalItems) {
    const effectiveEndDate = item.endDate ?? rental.endDate
    groups.set(effectiveEndDate, (groups.get(effectiveEndDate) ?? 0) + 1)
  }
  const effectiveEndDates = groups.size ? [...groups.keys()] : [rental.endDate]
  const existing = overdueByRental.get(rental.id) ?? []
  for (const effectiveEndDate of effectiveEndDates) {
    const expectedPeriods = overdueRentPeriods(effectiveEndDate, today)
    for (const period of expectedPeriods) {
      const overlaps = existing.some((bill) => bill.periodStart < period.periodEnd && bill.periodEnd > period.periodStart)
      if (!overlaps) {
        missing.push({ rentalId: rental.id, userId: rental.userId, contractNo: rental.contractNo, status: rental.status, endDate: rental.endDate, effectiveEndDate, missingPeriodStart: period.periodStart, missingPeriodEnd: period.periodEnd })
      }
    }
  }
}

console.log(`共检查 ${rentals.length} 个应产生逾期租金的合同，发现 ${missing.length} 处缺失的逾期账期：`)
for (const m of missing) console.log(JSON.stringify(m))
