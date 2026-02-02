import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import App from './screens/App'
import Customers from './screens/Customers'
import CustomerDetail from './screens/CustomerDetail'
import Sales from './screens/Sales'
import Expenses from './screens/Expenses'
import Dashboard from './screens/Dashboard'
import Reports from './screens/Reports'
import DataManagement from './screens/DataManagement'
import Auth from './screens/Auth'
import { AuthProvider, useAuth } from './contexts/AuthContext'

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
})

const AppWrapper: React.FC = () => {
  const { isAuthenticated, login } = useAuth()

  if (!isAuthenticated) {
    return <Auth onLogin={login} />
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<Dashboard />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customer/:id" element={<CustomerDetail />} />
          <Route path="sales" element={<Sales />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="reports" element={<Reports />} />
          <Route path="data-management" element={<DataManagement />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <AppWrapper />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
) 