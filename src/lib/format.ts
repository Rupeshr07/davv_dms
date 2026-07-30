import dayjs from 'dayjs'

export const formatDate = (value: string): string => dayjs(value).format('DD MMM YYYY')

export const formatDateTime = (value: string): string => dayjs(value).format('DD MMM YYYY, hh:mm A')

export const formatBytes = (value: number): string => {
  if (value === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  const size = value / 1024 ** exponent
  return `${size.toFixed(size >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`
}
