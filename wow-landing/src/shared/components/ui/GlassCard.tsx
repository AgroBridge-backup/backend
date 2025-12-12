'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { forwardRef, type ReactNode } from 'react';

/**
 * Premium glass morphism card with animated borders and gradients
 *
 * @example
 * ```tsx
 * <GlassCard variant="elevated" hover="lift">
 *   <h3>Card Title</h3>
 *   <p>Card content goes here</p>
 * </GlassCard>
 * ```
 */

const cardVariants = cva(
  'relative rounded-2xl backdrop-blur-sm border transition-all duration-300',
  {
    variants: {
      variant: {
        default: 'bg-surface-elevated/50 border-surface-border shadow-md',
        elevated:
          'bg-surface-overlay/60 border-primary-500/20 shadow-lg shadow-primary-500/5',
        premium:
          'bg-gradient-to-br from-surface-elevated/70 to-surface-overlay/60 border-primary-500/30 shadow-glow-sm',
        cyber:
          'bg-surface-overlay/50 border-tech-cyan/30 shadow-glow-cyan',
        glass:
          'bg-white/5 backdrop-blur-md border-white/10 shadow-inner-sm',
      },
      hover: {
        none: '',
        lift: 'hover:shadow-xl hover:-translate-y-1',
        glow: 'hover:shadow-glow-md hover:border-primary-500/40',
        scale: 'hover:scale-[1.02]',
      },
      padding: {
        none: 'p-0',
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
        xl: 'p-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      hover: 'lift',
      padding: 'md',
    },
  }
);

interface GlassCardProps
  extends Omit<HTMLMotionProps<'div'>, 'children'>,
    VariantProps<typeof cardVariants> {
  /** Card content */
  children: ReactNode;
  /** Enable animated gradient border */
  gradientBorder?: boolean;
  /** Enable inner glow effect */
  innerGlow?: boolean;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      className,
      variant,
      hover,
      padding,
      gradientBorder = false,
      innerGlow = false,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className={cn(cardVariants({ variant, hover, padding }), className)}
        {...props}
      >
        {/* Animated gradient border overlay */}
        {gradientBorder && (
          <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
            <motion.div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{
                background:
                  'linear-gradient(90deg, transparent, rgba(5, 150, 105, 0.3), transparent)',
              }}
              animate={{
                rotate: [0, 360],
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
          </div>
        )}

        {/* Inner glow effect */}
        {innerGlow && (
          <div className="absolute inset-0 rounded-2xl shadow-inner-md pointer-events-none" />
        )}

        {/* Content */}
        <div className="relative z-10">{children}</div>
      </motion.div>
    );
  }
);

GlassCard.displayName = 'GlassCard';
