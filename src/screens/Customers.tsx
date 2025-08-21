import React, { useEffect, useMemo, useState } from 'react'
import { Box, Button, Card, CardContent, Dialog, DialogActions, DialogContent, DialogTitle, Grid, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'

type Customer = {
	id: number
	name: string
	phone?: string
	email?: string
	notes?: string
}

declare global {
	interface Window {
		api: any
	}
}

export default function Customers() {
	const [customers, setCustomers] = useState<Customer[]>([])
	const [open, setOpen] = useState(false)
	const [form, setForm] = useState<Partial<Customer>>({ name: '' })
	const [query, setQuery] = useState('')
	const [searching, setSearching] = useState(false)
	const [reportMode, setReportMode] = useState<'all' | 'month' | 'range'>('all')
	const [month, setMonth] = useState('')
	const [startDate, setStartDate] = useState('')
	const [endDate, setEndDate] = useState('')
	const navigate = useNavigate()
	const hasApi = typeof window !== 'undefined' && (window as any).api

	const canSave = useMemo(() => (form.name || '').trim().length > 0, [form])

	useEffect(() => {
		if (!hasApi) return
		window.api.listCustomers().then(setCustomers)
	}, [hasApi])

	useEffect(() => {
		if (!hasApi) return
		const t = setTimeout(async () => {
			setSearching(true)
			const list = (query.trim().length > 0)
				? await window.api.searchCustomers(query)
				: await window.api.listCustomers()
			setCustomers(list)
			setSearching(false)
		}, 300)
		return () => clearTimeout(t)
	}, [query, hasApi])

	const handleCreate = async () => {
		if (!canSave || !hasApi) return
		const { id } = await window.api.createCustomer(form)
		setOpen(false)
		setForm({ name: '' })
		const refreshed = await window.api.listCustomers()
		setCustomers(refreshed)
		navigate(`/customer/${id}`)
	}

	const exportAll = async () => {
		if (!hasApi) return
		const payload: any = { mode: reportMode }
		if (reportMode === 'month') payload.month = month
		if (reportMode === 'range') {
			payload.startDate = startDate || null
			payload.endDate = endDate || null
		}
		await window.api.exportAllSummaryCsv(payload)
	}

	if (!hasApi) {
		return (
			<Box>
				<Typography variant="h5" gutterBottom>Customers</Typography>
				<Typography color="text.secondary">
					This screen is meant to run inside the Electron app. Please start with "npm run dev" and use the Electron window instead of the browser tab.
				</Typography>
			</Box>
		)
	}

	return (
		<Box>
			<Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} gap={2} mb={2}>
				<Typography variant="h5">Customers</Typography>
				<Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
					<TextField placeholder="Search by name, phone, or email" value={query} onChange={e => setQuery(e.target.value)} size="small" sx={{ minWidth: 260 }} />
					<TextField select label="Summary" value={reportMode} onChange={e => setReportMode(e.target.value as any)} size="small" sx={{ minWidth: 140 }}>
						<MenuItem value="all">All time</MenuItem>
						<MenuItem value="month">Monthly</MenuItem>
						<MenuItem value="range">Date range</MenuItem>
					</TextField>
					{reportMode === 'month' && (
						<TextField type="month" label="Month" InputLabelProps={{ shrink: true }} value={month} onChange={e => setMonth(e.target.value)} size="small" />
					)}
					{reportMode === 'range' && (
						<>
							<TextField type="date" label="Start Date" InputLabelProps={{ shrink: true }} value={startDate} onChange={e => setStartDate(e.target.value)} size="small" />
							<TextField type="date" label="End Date" InputLabelProps={{ shrink: true }} value={endDate} onChange={e => setEndDate(e.target.value)} size="small" />
						</>
					)}
					<Button variant="outlined" onClick={exportAll}>Export Summary CSV</Button>
					<Button variant="contained" onClick={() => setOpen(true)}>Add Customer</Button>
				</Stack>
			</Stack>

			{searching ? <Typography color="text.secondary" sx={{ mb: 1 }}>Searching…</Typography> : null}

			{/* Scrollable customer list container */}
			<Box sx={{ 
				height: 'calc(100vh - 200px)', // Fixed height for scrolling
				overflowY: 'auto', // Enable vertical scrolling
				overflowX: 'hidden', // Hide horizontal scrollbar
				pr: 1, // Right padding for scrollbar
				'&::-webkit-scrollbar': {
					width: '8px',
				},
				'&::-webkit-scrollbar-track': {
					background: '#f1f1f1',
					borderRadius: '4px',
				},
				'&::-webkit-scrollbar-thumb': {
					background: '#c1c1c1',
					borderRadius: '4px',
					'&:hover': {
						background: '#a8a8a8',
					},
				},
			}}>
				<Grid container spacing={2}>
					{customers.map(c => (
						<Grid item xs={12} sm={6} md={4} lg={3} key={c.id}>
							<Card onClick={() => navigate(`/customer/${c.id}`)} sx={{ cursor: 'pointer', transition: 'all .2s', '&:hover': { boxShadow: 6 } }}>
								<CardContent>
									<Typography variant="h6">{c.name}</Typography>
									<Typography color="text.secondary">{c.phone || '—'}</Typography>
									<Typography color="text.secondary">{c.email || '—'}</Typography>
								</CardContent>
							</Card>
						</Grid>
					))}
				</Grid>
				
				{/* Show message when no customers found */}
				{customers.length === 0 && !searching && (
					<Box sx={{ textAlign: 'center', py: 4 }}>
						<Typography color="text.secondary" variant="h6">
							{query ? 'No customers found matching your search.' : 'No customers yet. Add your first customer to get started!'}
						</Typography>
					</Box>
				)}
			</Box>

			<Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
				<DialogTitle>New Customer</DialogTitle>
				<DialogContent>
					<Stack spacing={2} mt={1}>
						<TextField autoFocus label="Name" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} required />
						<TextField label="Phone" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} />
						<TextField label="Email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} />
						<TextField label="Notes" value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} multiline rows={3} />
					</Stack>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setOpen(false)}>Cancel</Button>
					<Button variant="contained" onClick={handleCreate} disabled={!canSave}>Create</Button>
				</DialogActions>
			</Dialog>
		</Box>
	)
} 