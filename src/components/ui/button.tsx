import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-[transform,background-color,border-color,color,box-shadow] duration-200 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text/35 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-surface/80 text-text border border-line/55 hover:bg-surface/90 hover:-translate-y-0.5',
        secondary:
          'bg-surface/70 text-text border border-line/45 hover:bg-surface/85 hover:-translate-y-0.5',
        ghost: 'text-muted hover:text-text hover:bg-surface/70',
      },
      size: {
        default: 'h-11 px-5 py-2',
        sm: 'h-11 rounded-lg gap-1.5 px-3',
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
