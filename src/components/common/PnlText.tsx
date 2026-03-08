interface Props {
  value: number
  suffix?: string
  className?: string
  showSign?: boolean
}

export default function PnlText({ value, suffix = '', className = '', showSign = true }: Props) {
  const isProfit = value > 0
  const isLoss = value < 0
  const color = isProfit ? 'text-profit' : isLoss ? 'text-loss' : 'text-text-secondary'
  const sign = showSign && isProfit ? '+' : ''

  return (
    <span className={`${color} ${className}`}>
      {sign}{value.toFixed(2)}{suffix}
    </span>
  )
}
