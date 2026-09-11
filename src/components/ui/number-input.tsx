import * as React from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface NumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: number | string
  onChange: (value: string) => void
  min?: number
  max?: number
  step?: number | string
  precision?: number
  containerClassName?: string
}

export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  (
    {
      className,
      containerClassName,
      value,
      onChange,
      min,
      max,
      step = 1,
      precision,
      disabled,
      ...props
    },
    ref
  ) => {
    const numStep = typeof step === 'string' ? (step === 'any' ? 1 : parseFloat(step) || 1) : step

    const handleStep = (delta: number) => {
      if (disabled) return
      const current = typeof value === 'number' ? value : parseFloat(value) || 0
      let next = current + delta * numStep

      if (min !== undefined && next < min) next = min
      if (max !== undefined && next > max) next = max

      const p = precision !== undefined ? precision : numStep < 1 ? Math.min(6, (numStep.toString().split('.')[1] || '').length + 1) : 2
      const formatted = parseFloat(next.toFixed(p)).toString()
      onChange(formatted)
    }

    return (
      <div
        className={cn(
          'relative flex items-center h-8 w-full rounded-none border border-input bg-background shadow-sm transition-colors focus-within:ring-1 focus-within:ring-ring overflow-hidden',
          disabled && 'opacity-50 cursor-not-allowed',
          containerClassName
        )}
      >
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          ref={ref}
          className={cn(
            'flex-1 h-full w-full bg-transparent px-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
            className
          )}
          {...props}
        />

        {/* Custom Sleek Stepper Buttons with explicit margin and border divider */}
        <div className="flex flex-col h-full border-l border-input/60 bg-muted/30 shrink-0 w-5">
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled || (max !== undefined && parseFloat(String(value)) >= max)}
            onClick={() => handleStep(1)}
            aria-label="Increase value"
            className="flex-1 flex items-center justify-center hover:bg-muted/80 text-foreground transition-colors cursor-pointer border-b border-input/40 select-none"
          >
            <ChevronUp className="w-2.5 h-2.5 text-white" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled || (min !== undefined && parseFloat(String(value)) <= min)}
            onClick={() => handleStep(-1)}
            aria-label="Decrease value"
            className="flex-1 flex items-center justify-center hover:bg-muted/80 text-foreground transition-colors cursor-pointer select-none"
          >
            <ChevronDown className="w-2.5 h-2.5 text-white" />
          </button>
        </div>
      </div>
    )
  }
)
NumberInput.displayName = 'NumberInput'
