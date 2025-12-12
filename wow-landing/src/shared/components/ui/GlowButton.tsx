'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { forwardRef, type ReactNode } from 'react';

/**
 * Premium button component with glow effects and shimmer animations
 *
 * @example
 * ```tsx
 * <GlowButton variant="primary" size="lg" icon={<ArrowRight />}>
 *   Get Started
 * </GlowButton>
 * ```
 */

const buttonVariants = cva(
  'relative overflow-hidden rounded-xl font-semibold transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base disabled:opacity-50 disabled:cursor-not-allowed group',
  {
    variants: {
      variant: {
        primary:
          'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-glow-md hover:shadow-glow-lg hover:from-primary-500 hover:to-primary-600',
        secondary:
          'bg-surface-elevated border border-primary-500/30 text-primary-400 hover:border-primary-500/60 hover:shadow-glow-sm hover:bg-surface-overlay',
        ghost: 'text-primary-400 hover:bg-primary-500/10 hover:text-primary-300',
        cyber:
          'bg-surface-overlay border border-tech-cyan/40 text-tech-cyan shadow-glow-cyan hover:border-tech-cyan/70 hover:shadow-[0_0_40px_rgba(0,188,212,0.4)]',
        gold: 'bg-gradient-to-r from-tech-gold to-tech-amber text-surface-base shadow-glow-gold hover:shadow-[0_0_40px_rgba(255,179,0,0.5)]',
        outline:
          'border-2 border-primary-600 text-primary-600 hover:bg-primary-600 hover:text-white',
      },
      size: {
        sm: 'px-4 py-2 text-sm gap-1.5',
        md: 'px-6 py-3 text-base gap-2',
        lg: 'px-8 py-4 text-lg gap-2.5',
        xl: 'px-10 py-5 text-xl gap-3',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

interface GlowButtonProps
  extends Omit<HTMLMotionProps<'button'>, 'children'>,
    VariantProps<typeof buttonVariants> {
  /** Button content */
  children: ReactNode;
  /** Enable shimmer animation effect */
  shimmer?: boolean;
  /** Icon element to display */
  icon?: ReactNode;
  /** Position of the icon */
  iconPosition?: 'left' | 'right';
  /** Loading state */
  loading?: boolean;
}

export const GlowButton = forwardRef<HTMLButtonElement, GlowButtonProps>(
  (
    {
      className,
      variant,
      size,
      shimmer = true,
      icon,
      iconPosition = 'right',
      loading = false,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <motion.button
        ref={ref}
        whileHover={!isDisabled ? { scale: 1.03, y: -2 } : {}}
        whileTap={!isDisabled ? { scale: 0.97 } : {}}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className={cn(buttonVariants({ variant, size }), 'inline-flex items-center justify-center', className)}
        disabled={isDisabled}
        {...props}
      >
        {/* Shimmer effect overlay */}
        {shimmer && !isDisabled && (
          <motion.span
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full"
            animate={{ x: ['-100%', '200%'] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatDelay: 3,
              ease: 'linear',
            }}
          />
        )}

        {/* Loading spinner */}
        {loading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-current relative z-10"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        )}

        {/* Left icon */}
        {icon && iconPosition === 'left' && !loading && (
          <span className="relative z-10 transition-transform group-hover:-translate-x-0.5">
            {icon}
          </span>
        )}

        {/* Content */}
        <span className="relative z-10">{children}</span>

        {/* Right icon */}
        {icon && iconPosition === 'right' && !loading && (
          <span className="relative z-10 transition-transform group-hover:translate-x-0.5">
            {icon}
          </span>
        )}
      </motion.button>
    );
  }
);

GlowButton.displayName = 'GlowButton';
