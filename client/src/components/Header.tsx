import { Bug } from 'lucide-react'

export function Header() {
  return (
    <div className="flex items-center gap-2 px-5 py-2.5 flex-shrink-0 bg-[#0f172a]">
      <div className="w-6 h-6 rounded bg-red-500 flex items-center justify-center">
        <Bug className="h-3.5 w-3.5 text-white" />
      </div>
      <span className="font-black text-white text-sm tracking-wide">RBVM</span>
      <span className="text-white/40 text-xs">Risk-Based Vulnerability Management</span>
    </div>
  )
}