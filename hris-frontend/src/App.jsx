import './App.css'
import { Toaster } from 'sonner'
import { Route, Routes } from 'react-router-dom'
import Login from './pages/Login'
import ProtectedRoute from './layout/ProtectedRoute'
import Dashboard from './layout/Dashboard'
import DashboardHome from './pages/DashboardHome'
import Employee from './pages/Employee'

function App() {

  return (
    <>
      <Toaster richColors position="top-right" closeButton />
      <Routes>
        <Route path="/auth/login" element={<Login />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        >
          {/* This is the default page at "/" */}
          {/* <Route index element={<div>Welcome to the Stats Dashboard</div>} /> */}
          {/* Matches "/home" exactly */}
          <Route index  element={<DashboardHome />} />

          {/* Matches "/dashboard/employee" */}
          <Route path="/dashboard/employees" element={<Employee />}></Route>

          {/* <Route path="payment-success" element={<PaymentSuccess />} />
          <Route path="maintenance">
            <Route path="roles-and-permission" element={<RolesPage />} />
          </Route> */}
        </Route>
      </Routes>
    </>
  )
}

export default App
