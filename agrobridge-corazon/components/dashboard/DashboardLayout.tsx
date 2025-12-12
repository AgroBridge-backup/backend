'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  LayoutDashboard, 
  Package, 
  FileText, 
  Bot, 
  Settings, 
  Menu, 
  X, 
  LogOut,
  User
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'

const MENU_ITEMS = [
  { icon: LayoutDashboard, label: 'Resumen', href: '/dashboard' },
  { icon: Package, label: 'Mis Lotes', href: '/dashboard/lotes' },
  { icon: FileText, label: 'Certificados', href: '/dashboard/certificados' },
  { icon: Bot, label: 'AgroGPT', href: '/dashboard/ai' },
  { icon: Settings, label: 'Configuración', href: '/dashboard/settings' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-gray-50 relative overflow-hidden font-sans text-gray-900">
       {/* Aurora Boreal Background (Heredado para consistencia) */}
       <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[80vw] h-[80vh] bg-green-200/20 rounded-full blur-[120px] opacity-50 mix-blend-multiply"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[80vw] h-[80vh] bg-teal-200/20 rounded-full blur-[120px] opacity-50 mix-blend-multiply"></div>
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        className={clsx(
          "fixed top-0 left-0 h-full w-64 bg-white/70 backdrop-blur-xl border-r border-white/50 shadow-2xl z-50 transition-all duration-300",
          !isSidebarOpen && "-translate-x-full lg:translate-x-0 lg:w-20" 
        )}
      >
        <div className="h-full flex flex-col">
            {/* Logo Area */}
            <div className="h-20 flex items-center justify-center border-b border-gray-100/50">
                <span className={clsx("text-2xl font-bold text-green-800 transition-opacity duration-300", !isSidebarOpen && "lg:opacity-0 hidden")}>AgroBridge</span>
                {!isSidebarOpen && <span className="text-2xl font-bold text-green-800 lg:block hidden">AB</span>}
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                {MENU_ITEMS.map((item) => {
                    const isActive = pathname === item.href
                    return (
                        <Link 
                            key={item.href} 
                            href={item.href}
                            className={clsx(
                                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden",
                                isActive 
                                    ? "bg-green-100 text-green-800 font-semibold" 
                                    : "text-gray-600 hover:bg-white/50 hover:text-green-700"
                            )}
                        >
                             {isActive && (
                                <motion.div
                                    layoutId="active-pill"
                                    className="absolute inset-0 bg-green-100 z-[-1]"
                                    transition={{ type: "spring", duration: 0.6 }}
                                />
                            )}
                            <item.icon className={clsx("w-5 h-5 flex-shrink-0", isActive ? "text-green-700" : "text-gray-500 group-hover:text-green-600")} />
                            <span className={clsx("whitespace-nowrap transition-opacity duration-300", !isSidebarOpen && "lg:opacity-0 lg:hidden")}>
                                {item.label}
                            </span>
                        </Link>
                    )
                })}
            </nav>

            {/* User Profile Footer */}
            <div className="p-4 border-t border-gray-100/50">
                 <button className="flex items-center gap-3 w-full p-2 rounded-xl hover:bg-red-50 text-gray-600 hover:text-red-600 transition-colors">
                    <LogOut className="w-5 h-5 flex-shrink-0" />
                    <span className={clsx("whitespace-nowrap font-medium", !isSidebarOpen && "lg:hidden")}>Cerrar Sesión</span>
                 </button>
            </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className={clsx("transition-all duration-300 min-h-screen flex flex-col", isSidebarOpen ? "lg:ml-64" : "lg:ml-20")}>
         {/* Header Flotante */}
         <header className="h-20 px-8 flex items-center justify-between sticky top-0 z-30 bg-white/60 backdrop-blur-md border-b border-white/40">
            <div className="flex items-center gap-4">
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 focus:outline-none">
                    <Menu className="w-6 h-6" />
                </button>
                <h1 className="text-xl font-semibold text-gray-800 hidden sm:block">
                    Panel de Control
                </h1>
            </div>

            <div className="flex items-center gap-4">
                <div className="hidden md:flex flex-col items-end">
                    <span className="text-sm font-bold text-gray-800">Productor Demo</span>
                    <span className="text-xs text-green-600 font-medium">Plan Cosecha</span>
                </div>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center text-white font-bold shadow-lg">
                    P
                </div>
            </div>
         </header>

         {/* Page Content */}
         <main className="flex-1 p-6 lg:p-8 overflow-x-hidden">
            {children}
         </main>
      </div>
    </div>
  )
}