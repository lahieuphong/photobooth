type SpinnerProps = {
  label?: string
  tone?: 'light' | 'dark'
  className?: string
}

export default function Spinner({ label, tone = 'dark', className = '' }: SpinnerProps) {
  const ring = tone === 'dark' ? 'border-ink/15 border-t-ink' : 'border-white/25 border-t-white'
  const text = tone === 'dark' ? 'text-ink-soft' : 'text-white/85'

  return (
    <div role="status" className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <span aria-hidden="true" className={`h-8 w-8 animate-spin rounded-full border-[3px] ${ring}`} />
      {label ? <span className={`text-[13px] font-medium ${text}`}>{label}</span> : <span className="sr-only">Đang tải</span>}
    </div>
  )
}
