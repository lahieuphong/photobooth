/** Two-digit number for step and shot labels, dates and file names: 3 → "03". */
export const pad = (value: number) => String(value).padStart(2, '0')
