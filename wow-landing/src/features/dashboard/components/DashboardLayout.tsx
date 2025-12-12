import { useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Package,
  Users,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: ReactNode;
}

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard', active: true },
  { icon: Package, label: 'Lotes', href: '/lotes', active: false },
  { icon: Users, label: 'Productores', href: '/productores', active: false },
  { icon: FileText, label: 'Reportes', href: '/reportes', active: false },
  { icon: Settings, label: 'Configuración', href: '/configuracion', active: false },
];

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface-base">
      {/* Mobile menu button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-surface-elevated border border-surface-border text-white hover:bg-surface-overlay transition-colors"
      >
        {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Overlay for mobile */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-screen w-72 bg-surface-elevated border-r border-surface-border z-40 transition-transform duration-300',
          'lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-surface-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-600 to-primary-700 flex items-center justify-center shadow-glow-sm">
              <span className="text-white font-bold text-lg">AB</span>
            </div>
            <div>
              <h1 className="text-white font-bold text-lg">AgroBridge</h1>
              <p className="text-gray-400 text-xs">Trazabilidad v2.0</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-2">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              onClick={(e) => e.preventDefault()}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group',
                item.active
                  ? 'bg-primary-600/10 text-primary-400 border border-primary-500/30 shadow-glow-sm'
                  : 'text-gray-400 hover:bg-surface-overlay hover:text-white'
              )}
            >
              <item.icon className={cn('w-5 h-5', item.active && 'text-primary-400')} />
              <span className="flex-1 font-medium">{item.label}</span>
              {item.active && <ChevronRight className="w-4 h-4 text-primary-400" />}
            </a>
          ))}
        </nav>

        {/* User section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-surface-border">
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-surface-overlay">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-600 to-primary-700 flex items-center justify-center">
              <span className="text-white font-semibold text-sm">JP</span>
            </div>
            <div className="flex-1">
              <p className="text-white text-sm font-medium">Juan Pérez</p>
              <p className="text-gray-400 text-xs">Administrador</p>
            </div>
            <button className="text-gray-400 hover:text-white transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:ml-72 min-h-screen">
        {/* Header */}
        <header className="h-16 bg-surface-elevated border-b border-surface-border flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <div className="lg:hidden w-12" /> {/* Spacer for mobile menu button */}
            <div>
              <h2 className="text-white text-xl font-bold">Dashboard</h2>
              <p className="text-gray-400 text-sm">Resumen general de la plataforma</p>
            </div>
          </div>

          {/* Header actions */}
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 rounded-lg bg-surface-overlay border border-surface-border text-gray-300 hover:text-white hover:border-primary-500/30 transition-all text-sm font-medium">
              Exportar
            </button>
            <button className="px-4 py-2 rounded-lg bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:shadow-glow-md transition-all text-sm font-semibold">
              + Nuevo Lote
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
