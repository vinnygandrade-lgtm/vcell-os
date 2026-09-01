import { useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { PhoneFrame } from '@/components/Shell'
import { initCloud } from '@/lib/cloud'
import { CustomerPage } from '@/pages/CustomerPage'
import { CustomersPage } from '@/pages/CustomersPage'
import { HomePage } from '@/pages/HomePage'
import { NewOrderPage } from '@/pages/NewOrderPage'
import { OrderPage } from '@/pages/OrderPage'
import { SettingsPage } from '@/pages/SettingsPage'

export default function App() {
  useEffect(() => {
    initCloud()
  }, [])

  return (
    <HashRouter>
      <PhoneFrame>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/nova" element={<NewOrderPage />} />
          <Route path="/os/:id" element={<OrderPage />} />
          <Route path="/clientes" element={<CustomersPage />} />
          <Route path="/clientes/:id" element={<CustomerPage />} />
          <Route path="/ajustes" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PhoneFrame>
    </HashRouter>
  )
}
