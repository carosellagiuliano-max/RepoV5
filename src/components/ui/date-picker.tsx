/**
 * Simple Date Picker Component
 * Wrapper around HTML5 date input with consistent styling
 */

import { forwardRef } from 'react'
import { Input } from './input'
import { cn } from '@/lib/utils'

export interface DatePickerProps extends React.InputHTMLAttributes<HTMLInputElement> {
  // Add any additional props specific to date picker if needed
}

const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  ({ className, ...props }, ref) => {
    return (
      <Input
        type="date"
        className={cn(className)}
        ref={ref}
        {...props}
      />
    )
  }
)

DatePicker.displayName = 'DatePicker'

export { DatePicker }