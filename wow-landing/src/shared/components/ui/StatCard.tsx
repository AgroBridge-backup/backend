'use client';

import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { useEffect, type ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * Animated statistics card with counter and trend indicator
 *
 * @example
 * ```tsx
 * <StatCard
 *   label="Total Producers"
 *   value={1500}
 *   prefix=""
 *   suffix="+"
 *   trend="up"
 *   trendValue="+12%"
 * />
 * ```
 */

const statCardVariants = cva(
  'relative overflow-hidden rounded-2xl border backdrop-blur-sm transition-all duration-300',
  {
    variants: {
      variant: {
        default: 'bg-surface-elevated/50 border-surface-border',
        primary: 'bg-primary-600/10 border-primary-500/30 shadow-glow-sm',
        success: 'bg-green-500/10 border-green-500/30',
        warning: 'bg-yellow-500/10 border-yellow-500/30',
        info: 'bg-blue-500/10 border-blue-500/30',
      },
      size: {
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

interface StatCardProps extends VariantProps<typeof statCardVariants> {
  /** Display label for the stat */
  label: string;
  /** Numeric value to animate */
  value: number;
  /** Prefix for the value (e.g., "$") */
  prefix?: string;
  /** Suffix for the value (e.g., "+", "K", "M") */
  suffix?: string;
  /** Trend direction */
  trend?: 'up' | 'down' | 'neutral';
  /** Trend value text */
  trendValue?: string;
  /** Optional icon */
  icon?: ReactNode;
  /** Custom className */
  className?: string;
  /** Animation duration in seconds */
  duration?: number;
}

export function StatCard({
  label,
  value,
  prefix = '',
  suffix = '',
  trend,
  trendValue,
  icon,
  variant,
  size,
  className,
  duration = 2,
}: StatCardProps) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest));

  useEffect(() => {
    const controls = animate(count, value, {
      duration,
      ease: 'easeOut',
    });

    return controls.stop;
  }, [count, value, duration]);

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      case 'neutral':
        return <Minus className="w-4 h-4 text-gray-500" />;
      default:
        return null;
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'text-green-500';
      case 'down':
        return 'text-red-500';
      case 'neutral':
        return 'text-gray-500';
      default:
        return '';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={cn(statCardVariants({ variant, size }), 'group', className)}
    >
      {/* Background gradient animation */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-primary-500/0 via-primary-500/5 to-primary-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        animate={{
          backgroundPosition: ['0% 0%', '100% 100%'],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          repeatType: 'reverse',
        }}
      />

      <div className="relative z-10">
        {/* Header with icon and label */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="p-2 rounded-lg bg-primary-500/10 text-primary-400 group-hover:bg-primary-500/20 transition-colors">
                {icon}
              </div>
            )}
            <p className="text-sm font-medium text-gray-400 uppercase tracking-wider">
              {label}
            </p>
          </div>
          {trend && (
            <div className="flex items-center gap-1">
              {getTrendIcon()}
              {trendValue && (
                <span className={cn('text-sm font-semibold', getTrendColor())}>
                  {trendValue}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Animated value */}
        <div className="flex items-baseline gap-1">
          {prefix && (
            <span className="text-2xl md:text-3xl font-bold text-white/90">
              {prefix}
            </span>
          )}
          <motion.span className="text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-br from-white to-white/70 bg-clip-text text-transparent">
            {rounded}
          </motion.span>
          {suffix && (
            <span className="text-2xl md:text-3xl font-bold text-white/90">
              {suffix}
            </span>
          )}
        </div>
      </div>

      {/* Glow effect on hover */}
      <motion.div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          boxShadow: '0 0 40px rgba(5, 150, 105, 0.2)',
        }}
      />
    </motion.div>
  );
}
