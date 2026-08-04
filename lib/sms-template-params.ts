export function normalizeSmsCustomerName(value: string) {
  const withoutNotes = value.split(/[（(【[]/, 1)[0]?.trim() ?? ''
  const normalized = withoutNotes.replace(/[^\p{Script=Han}A-Za-z·]/gu, '').slice(0, 20)
  return normalized || '客户'
}
