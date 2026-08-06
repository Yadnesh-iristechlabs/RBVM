import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Bug, LayoutDashboard, Server, Plug, Search as ScanIcon, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Settings2, ClipboardCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

const RBVM_SUBITEMS = [
  { to: '/scans', label: 'Scans', icon: ScanIcon, end: false },
]

const ADMIN_ITEMS = [
  { to: '/admin', label: 'CTEM Admin', icon: Settings2, end: false },
]

export function AppSidebar() {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [rbvmOpen, setRbvmOpen] = useState(true)
  const [assetsOpen, setAssetsOpen] = useState(true)

  const assetsActive = location.pathname === '/assets' || location.pathname.startsWith('/integrations')
  const anyChildActive = RBVM_SUBITEMS.some((i) => (i.end ? location.pathname === i.to : location.pathname.startsWith(i.to))) || assetsActive

  return (
    <aside
      className={cn('flex flex-col flex-shrink-0 sticky top-0 h-screen self-start transition-all duration-200 border-r border-white/10', collapsed ? 'w-14' : 'w-[210px]')}
      style={{ backgroundColor: '#0f172a' }}
    >
      <div className={cn('flex items-center flex-shrink-0 h-14 border-b border-white/10', collapsed ? 'justify-center px-2' : 'gap-2 px-4')}>
        {!collapsed && (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-6 h-6 rounded-md bg-blue-400 flex items-center justify-center flex-shrink-0">
              <Bug className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-black text-sm text-white tracking-wide truncate">RBVM</span>
          </div>
        )}
        {collapsed && (
          <div className="w-6 h-6 rounded-md bg-blue-400 flex items-center justify-center">
            <Bug className="h-3.5 w-3.5 text-white" />
          </div>
        )}
        <button onClick={() => setCollapsed(!collapsed)} className="flex-shrink-0 p-1 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors ml-auto">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 space-y-0.5">
        {collapsed ? (
          <button
            onClick={() => setCollapsed(false)}
            className={cn('flex items-center justify-center w-full p-2.5 mx-0.5 rounded-lg transition-all', anyChildActive ? 'bg-white/18 text-white' : 'text-white/50 hover:bg-white/08 hover:text-white/80')}
          >
            <Bug className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={() => setRbvmOpen((o) => !o)}
            className={cn('flex items-center w-full gap-2 px-3 py-1.5 rounded-lg transition-all', anyChildActive ? 'text-white' : 'text-white/60 hover:text-white/85 hover:bg-white/05')}
          >
            <Bug className="h-4 w-4 flex-shrink-0" />
            <span className="text-xs font-semibold flex-1 text-left">RBVM</span>
            {rbvmOpen ? <ChevronUp className="h-3 w-3 opacity-50" /> : <ChevronDown className="h-3 w-3 opacity-50" />}
          </button>
        )}

        {rbvmOpen && !collapsed && (
          <div className="space-y-0.5 ml-2 border-l border-white/10 pl-1">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                cn(
                  'flex items-center w-full rounded-lg transition-all duration-150 gap-2 px-2 py-1.5 pl-7',
                  isActive ? 'bg-white/18 text-white font-semibold' : 'text-white/55 hover:bg-white/08 hover:text-white/90'
                )
              }
            >
              <LayoutDashboard className="flex-shrink-0 h-3.5 w-3.5" />
              <span className="truncate flex-1 text-left text-[11px]">Dashboard</span>
            </NavLink>

            <button
              onClick={() => setAssetsOpen((o) => !o)}
              className={cn(
                'flex items-center w-full rounded-lg transition-all duration-150 gap-2 px-2 py-1.5 pl-7',
                assetsActive ? 'text-white font-semibold' : 'text-white/55 hover:bg-white/08 hover:text-white/90'
              )}
            >
              <Server className="flex-shrink-0 h-3.5 w-3.5" />
              <span className="truncate flex-1 text-left text-[11px]">Assets</span>
              {assetsOpen ? <ChevronUp className="h-3 w-3 opacity-50" /> : <ChevronDown className="h-3 w-3 opacity-50" />}
            </button>

            {assetsOpen && (
              <div className="ml-4 border-l border-white/10 pl-1 space-y-0.5">
                <NavLink
                  to="/assets"
                  end
                  className={({ isActive }) =>
                    cn(
                      'flex items-center w-full rounded-lg transition-all duration-150 gap-2 px-2 py-1.5 pl-3',
                      isActive ? 'bg-white/18 text-white font-semibold' : 'text-white/55 hover:bg-white/08 hover:text-white/90'
                    )
                  }
                >
                  <Server className="flex-shrink-0 h-3 w-3" />
                  <span className="truncate flex-1 text-left text-[11px]">Assets</span>
                </NavLink>
                <NavLink
                  to="/integrations"
                  className={({ isActive }) =>
                    cn(
                      'flex items-center w-full rounded-lg transition-all duration-150 gap-2 px-2 py-1.5 pl-3',
                      isActive ? 'bg-white/18 text-white font-semibold' : 'text-white/55 hover:bg-white/08 hover:text-white/90'
                    )
                  }
                >
                  <Plug className="flex-shrink-0 h-3 w-3" />
                  <span className="truncate flex-1 text-left text-[11px]">Integrations</span>
                </NavLink>
              </div>
            )}

            {RBVM_SUBITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center w-full rounded-lg transition-all duration-150 gap-2 px-2 py-1.5 pl-7',
                    isActive ? 'bg-white/18 text-white font-semibold' : 'text-white/55 hover:bg-white/08 hover:text-white/90'
                  )
                }
              >
                <item.icon className="flex-shrink-0 h-3.5 w-3.5" />
                <span className="truncate flex-1 text-left text-[11px]">{item.label}</span>
              </NavLink>
            ))}
          </div>
        )}

        {!collapsed && (
          <div className="mt-3 pt-3 border-t border-white/10">
            <div className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">Admin</div>
            {ADMIN_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center w-full rounded-lg transition-all duration-150 gap-2 px-3 py-1.5',
                    isActive ? 'bg-white/18 text-white font-semibold' : 'text-white/55 hover:bg-white/08 hover:text-white/90'
                  )
                }
              >
                <item.icon className="flex-shrink-0 h-3.5 w-3.5" />
                <span className="truncate flex-1 text-left text-[11px]">{item.label}</span>
              </NavLink>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}