import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility to merge Tailwind CSS classes with conflict resolution
 * Uses clsx for conditional classes and tailwind-merge to dedupe
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
