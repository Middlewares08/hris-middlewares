import './App.css'
import { Toaster } from 'sonner'
import { Navigate, Route, Routes } from 'react-router-dom'
import Login from './pages/Login'
import ProtectedRoute from './layout/ProtectedRoute'
import Dashboard from './layout/Dashboard'
import DashboardHome from './pages/DashboardHome'
import Employee from './pages/Employee/Employee'
import Landing from './pages/Landing'
import RolesAndPermission from './pages/Maintenance/RolesAndPermission'
import Department from './pages/LookupSetting/Department'
import Position from './pages/LookupSetting/Position'
import StatutoryAndCompliance from './pages/Employee/StatutoryAndCompliance'
import Identification from './pages/Employee/StatutoryAndCompliance/Identification'
import Resume from './pages/Employee/StatutoryAndCompliance/Resume'
import Benifits from './pages/Employee/StatutoryAndCompliance/Benifits'
import { can } from './utils/permissionCheck'
import Index from './pages/Employee/StatutoryAndCompliance/Index'

const ProtectedElement = ({ element, permission }) => {
    return can(permission) ? element : <Navigate to="/dashboard" replace />;
};

function App() {

  return (
    <>
      <Toaster richColors position="top-right" closeButton />
      <Routes>
        <Route path="/auth/login" element={<Login />} />
        <Route path="/"  element={<Landing />} />

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
          <Route path="employee">
            <Route 
              index
               path="lists"
              element={<ProtectedElement element={<Employee />} permission="employee-management:view" />} 
            />
            <Route path="/dashboard/employee/statutory-and-compliance" element={<StatutoryAndCompliance />}>
              <Route index element={<Index />} />
              
              <Route 
                path="identification" 
                element={<ProtectedElement element={<Identification />} permission="identifications:view" />} 
              />
              <Route 
                path="benefits" 
                element={<ProtectedElement element={<Benifits />} permission="benefits:view" />} 
              />
              <Route 
                path="resume" 
                element={<ProtectedElement element={<Resume />} permission="resume:view" />} 
              />
            </Route>
          </Route>
         

          <Route path="maintenance">
            <Route path="roles-and-permission" element={<RolesAndPermission />} />
          </Route>

          <Route path="lookups">
            <Route path="departments" element={<Department />} />
          </Route>
          <Route path="lookups">
            <Route path="positions" element={<Position />} />
          </Route>

        </Route>
      </Routes>
    </>
  )
}

export default App
