import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 shrink-0 [&_svg]:shrink-0 min-h-11 min-w-11',
  {
    variants: {
      variant: {
        default:
          'bg-accent/20 text-text border border-accent/40 hover:bg-accent/30 hover:-translate-y-0.5',
        secondary:
          'bg-surface text-text border border-line hover:bg-surface/80 hover:-translate-y-0.5',
        ghost: 'text-muted hover:text-text hover:bg-surface/70',
      },
      size: {
        default: 'h-11 px-5 py-2',
        sm: 'h-10 rounded-lg gap-1.5 px-3',
        icon: 'h-11 w-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
