import React from 'react'
import { AppBar, Toolbar, Typography, Box, Container, Button, Stack } from '@mui/material'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function App() {
	const location = useLocation()
	const { logout } = useAuth()

	const handleLogout = () => {
		logout()
	}

	return (
		<Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
			<AppBar position="static" color="primary" enableColorOnDark>
				<Toolbar>
					<Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
						SLNFS CRM
					</Typography>
					<Stack direction="row" gap={1}>
						<Button color="inherit" component={Link} to="/dashboard" variant={location.pathname === '/' || location.pathname.startsWith('/dashboard') ? 'outlined' : 'text'}>Dashboard</Button>
						<Button color="inherit" component={Link} to="/customers" variant={location.pathname.startsWith('/customers') || location.pathname.startsWith('/customer/') ? 'outlined' : 'text'}>Customers</Button>
						<Button color="inherit" component={Link} to="/sales" variant={location.pathname.startsWith('/sales') ? 'outlined' : 'text'}>Sales</Button>
						<Button color="inherit" component={Link} to="/expenses" variant={location.pathname.startsWith('/expenses') ? 'outlined' : 'text'}>Expenses</Button>
						<Button color="inherit" component={Link} to="/reports" variant={location.pathname.startsWith('/reports') ? 'outlined' : 'text'}>Reports</Button>
						<Button color="inherit" component={Link} to="/data-management" variant={location.pathname.startsWith('/data-management') ? 'outlined' : 'text'}>Data Management</Button>
						<Button color="inherit" onClick={handleLogout} variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.3)' }}>Logout</Button>
					</Stack>
				</Toolbar>
			</AppBar>
			<Container sx={{ py: 3, flexGrow: 1 }}>
				<Outlet />
			</Container>
		</Box>
	)
} 