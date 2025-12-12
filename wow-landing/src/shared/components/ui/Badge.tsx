'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { type ReactNode } from 'react';

/**
 * Premium badge component with various styles and animations
 *
 * @example
 * ```tsx
 * <Badge variant="premium" pulse>
 *   New Feature
 * </Badge>
 * ```
 */

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full font-medium transition-all duration-300',
  {
    variants: {
      variant: {
        default: 'bg-surface-muted text-gray-300 border border-surface-border',
        primary: 'bg-primary-500/10 text-primary-400 border border-primary-500/30',
        premium:
          'bg-gradient-to-r from-tech-gold/20 to-tech-amber/20 text-tech-gold border border-tech-gold/40 shadow-glow-gold',
        verified:
          'bg-primary-500/10 text-primary-400 border border-primary-500/40 shadow-glow-sm',
        blockchain:
          'bg-tech-cyan/10 text-tech-cyan border border-tech-cyan/40 shadow-glow-cyan',
        success: 'bg-green-500/10 text-green-400 border border-green-500/30',
        warning: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30',
        error: 'bg-red-500/10 text-red-400 border border-red-500/30',
        info: 'bg-blue-500/10 text-blue-400 border border-blue-500/30',
      },
      size: {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-3 py-1 text-sm',
        lg: 'px-4 py-1.5 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

interface BadgeProps
  extends Omit<HTMLMotionProps<'span'>, 'children'>,
    VariantProps<typeof badgeVariants> {
  /** Badge content */
  children: ReactNode;
  /** Enable pulse animation */
  pulse?: boolean;
  /** Optional icon before text */
  icon?: ReactNode;
  /** Optional dot indicator */
  dot?: boolean;
  /** Dot color (uses variant color if not specified) */
  dotColor?: string;
}

export function Badge({
  className,
  variant,
  size,
  pulse = false,
  icon,
  dot = false,
  dotColor,
  children,
  ...props
}: BadgeProps) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn(badgeVariants({ variant, size }), pulse && 'animate-pulse', className)}
      {...props}
    >
      {/* Dot indicator */}
      {dot && (
        <span className="relative flex h-2 w-2">
          <span
            className={cn(
              'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
              dotColor || 'bg-current'
            )}
          />
          <span
            className={cn(
              'relative inline-flex rounded-full h-2 w-2',
              dotColor || 'bg-current'
            )}
          />
        </span>
      )}

      {/* Icon */}
      {icon && <span className="inline-flex items-center">{icon}</span>}

      {/* Content */}
      <span>{children}</span>
    </motion.span>
  );
}
