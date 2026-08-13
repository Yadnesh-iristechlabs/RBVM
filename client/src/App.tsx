import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Header } from '@/components/Header'
import { AppSidebar } from '@/components/AppSidebar'
import { Dashboard } from '@/pages/Dashboard'
import { Assets } from '@/pages/Assets'
import { Vulnerabilities } from '@/pages/Vulnerabilities'
import { Integrations } from '@/pages/Integrations'
import { Scans } from '@/pages/Scans'
import { AdminMasters } from '@/pages/AdminMasters'


function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors />
      <div className="min-h-screen bg-background flex items-start">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Header />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/assets" element={<Assets />} />
              <Route path="/vulnerabilities" element={<Vulnerabilities />} />
              <Route path="/integrations" element={<Integrations />} />
              <Route path="/scans" element={<Scans />} />
            <Route path="/admin" element={<AdminMasters />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}

export default App