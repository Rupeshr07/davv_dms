export const buildReferenceNumber = (sequence: number, year = new Date().getFullYear()): string =>
  `DAVV/${year}/${String(sequence).padStart(4, '0')}`
