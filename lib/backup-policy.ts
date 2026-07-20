export const MAX_CLOUD_SNAPSHOTS = 7
export const SHANGHAI_TIME_ZONE = 'Asia/Shanghai'

export function shanghaiDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SHANGHAI_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}
