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
import PayComponents from './pages/Payroll/PayComponents'
import EmployeeCompensation from './pages/Payroll/EmployeeCompensation'
import StatutoryTables from './pages/Payroll/StatutoryTables'
import PayPeriods from './pages/Payroll/PayPeriods'
import PayrollRuns from './pages/Payroll/PayrollRuns'
import PayrollRunDetail from './pages/Payroll/PayrollRunDetail'
import PayslipRequests from './pages/Payroll/PayslipRequests'
import Announcements from './pages/Announcement/Announcements'
import OvertimeRequests from './pages/Overtime/OvertimeRequests'
import AttendanceLogs from './pages/Attendance/AttendanceLogs'
import EmployeeDocuments from './pages/Employee/Documents'
import BankDetails from './pages/Employee/BankDetails'
import KioskView from './pages/Kiosk/KioskView'
import KioskAdmin from './pages/Kiosk/KioskAdmin'
import ReportsLayout from './pages/Reports/ReportsLayout'
import HeadcountReport from './pages/Reports/HeadcountReport'
import AttendanceReport from './pages/Reports/AttendanceReport'
import AbsenceReport from './pages/Reports/AbsenceReport'
import LeaveUtilizationReport from './pages/Reports/LeaveUtilizationReport'
import OvertimeReport from './pages/Reports/OvertimeReport'
import PayrollReport from './pages/Reports/PayrollReport'
import TurnoverReport from './pages/Reports/TurnoverReport'
import NewHiresReport from './pages/Reports/NewHiresReport'
import SeparationReport from './pages/Reports/SeparationReport'
import DepartmentStatsReport from './pages/Reports/DepartmentStatsReport'
import { PerformanceReport, TrainingReport } from './pages/Reports/ComingSoonReport'
import NotFound from './components/NotFound'

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

        {/* Unattended attendance kiosk — its own device token, no admin login */}
        <Route path="/kiosk" element={<KioskView />} />

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
            <Route
              path="documents"
              element={<ProtectedElement element={<EmployeeDocuments />} permission="employee-documents:view" />}
            />
            <Route
              path="compensation"
              element={<ProtectedElement element={<EmployeeCompensation />} permission="payroll-and-compensation:view" />}
            />
            <Route
              path="bank-details"
              element={<ProtectedElement element={<BankDetails />} permission="payroll-and-compensation:view" />}
            />
            <Route
              path="departments"
              element={<ProtectedElement element={<Department />} permission="departments:view" />}
            />
            <Route
              path="positions"
              element={<ProtectedElement element={<Position />} permission="positions:view" />}
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
         

          <Route path="attendance-kiosk" element={<ProtectedElement element={<KioskAdmin />} permission="attendance-kiosk:view" />} />

          <Route path="announcements" element={<ProtectedElement element={<Announcements />} permission="announcements:view" />} />

          <Route path="overtime" element={<ProtectedElement element={<OvertimeRequests />} permission="overtime-tracker:view" />} />

          <Route path="attendance-logs" element={<ProtectedElement element={<AttendanceLogs />} permission="attendance-logs:view" />} />

          <Route path="reports" element={<ProtectedElement element={<ReportsLayout />} permission="reports:view" />}>
            <Route index element={<Navigate to="/dashboard/reports/headcount" replace />} />
            <Route path="headcount" element={<HeadcountReport />} />
            <Route path="attendance" element={<AttendanceReport />} />
            <Route path="absence" element={<AbsenceReport />} />
            <Route path="leave" element={<LeaveUtilizationReport />} />
            <Route path="overtime" element={<OvertimeReport />} />
            <Route path="payroll" element={<PayrollReport />} />
            <Route path="turnover" element={<TurnoverReport />} />
            <Route path="new-hires" element={<NewHiresReport />} />
            <Route path="separations" element={<SeparationReport />} />
            <Route path="departments" element={<DepartmentStatsReport />} />
            <Route path="performance" element={<PerformanceReport />} />
            <Route path="training" element={<TrainingReport />} />
          </Route>

          <Route path="maintenance">
            <Route path="roles-and-permission" element={<RolesAndPermission />} />
          </Route>

          <Route path="payroll">
            <Route path="runs" element={<ProtectedElement element={<PayrollRuns />} permission="run-payroll:view" />} />
            <Route path="runs/:uuid" element={<ProtectedElement element={<PayrollRunDetail />} permission="run-payroll:view" />} />
            <Route path="payslip-requests" element={<ProtectedElement element={<PayslipRequests />} permission="run-payroll:view" />} />
            <Route path="periods" element={<ProtectedElement element={<PayPeriods />} permission="run-payroll:view" />} />
            <Route path="components" element={<ProtectedElement element={<PayComponents />} permission="payroll-and-compensation:view" />} />
            <Route path="statutory-tables" element={<ProtectedElement element={<StatutoryTables />} permission="statutory-and-compliance:view" />} />
          </Route>

        </Route>

        {/* Any unmatched path — full-screen 404, outside the dashboard shell */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  )
}

export default App
