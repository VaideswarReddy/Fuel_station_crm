import React, { useEffect, useMemo, useState } from 'react'
import { Box, Button, Card, CardContent, Divider, Grid, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography, IconButton, Dialog, DialogActions, DialogContent, DialogTitle, DialogContentText } from '@mui/material'
import dayjs from 'dayjs'
import { useNavigate, useParams } from 'react-router-dom'

type Transaction = {
	id: number
	customer_id: number
	amount: number
	type: 'credit' | 'payment'
	date: string
	note?: string
}

declare global {
	interface Window { api: any }
}

export default function CustomerDetail() {
	const { id } = useParams()
	const customerId = Number(id)
	const [transactions, setTransactions] = useState<Transaction[]>([])
	const [summary, setSummary] = useState({ total_credit: 0, total_payment: 0, total_due: 0 })
	const [amount, setAmount] = useState('')
	const [type, setType] = useState<'credit' | 'payment'>('credit')
	const [note, setNote] = useState('')
	const [reportMode, setReportMode] = useState<'all' | 'month' | 'range'>('all')
	const [month, setMonth] = useState('') // YYYY-MM
	const [startDate, setStartDate] = useState<string>('')
	const [endDate, setEndDate] = useState<string>('')
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
	const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null)
	const navigate = useNavigate()
	const hasApi = typeof window !== 'undefined' && (window as any).api

	const canSave = useMemo(() => Number(amount) > 0 && (type === 'credit' || type === 'payment'), [amount, type])

	const refresh = async () => {
		if (!hasApi) return
		const [txs, sum] = await Promise.all([
			window.api.listTransactionsByCustomer(customerId),
			window.api.getCustomerSummary(customerId)
		])
		setTransactions(txs)
		setSummary(sum)
	}

	useEffect(() => {
		if (!customerId || !hasApi) return
		refresh()
	}, [customerId, hasApi])

	const add = async () => {
		if (!canSave || !hasApi) return
		await window.api.addTransaction({
			customer_id: customerId,
			amount: Number(amount),
			type,
			date: dayjs().format('YYYY-MM-DD'),
			note
		})
		setAmount('')
		setNote('')
		await refresh()
	}

	const handleDeleteClick = (transaction: Transaction) => {
		setTransactionToDelete(transaction)
		setDeleteDialogOpen(true)
	}

	const handleDeleteConfirm = async () => {
		if (!transactionToDelete || !hasApi) return
		
		try {
			// Call the delete transaction API
			await window.api.deleteTransaction(transactionToDelete.id)
			// Refresh the data
			await refresh()
			// Close dialog and reset state
			setDeleteDialogOpen(false)
			setTransactionToDelete(null)
		} catch (error) {
			console.error('Error deleting transaction:', error)
			alert('Failed to delete transaction. Please try again.')
		}
	}

	const handleDeleteCancel = () => {
		setDeleteDialogOpen(false)
		setTransactionToDelete(null)
	}

	const exportCsv = async () => {
		if (!hasApi) return
		await window.api.exportCustomerCsv(customerId)
	}

	const exportPdf = async () => {
		if (!hasApi) return
		const payload: any = { customerId, mode: reportMode }
		if (reportMode === 'month') payload.month = month || dayjs().format('YYYY-MM')
		if (reportMode === 'range') {
			payload.startDate = startDate || null
			payload.endDate = endDate || null
		}
		await window.api.exportCustomerPdf(payload)
	}

	if (!hasApi) {
		return (
			<Box>
				<Button onClick={() => navigate(-1)} sx={{ mb: 2 }}>Back</Button>
				<Typography variant="h5" gutterBottom>Customer #{customerId}</Typography>
				<Typography color="text.secondary">
					This screen is meant to run inside the Electron app. Please start with "npm run dev" and use the Electron window instead of the browser tab.
				</Typography>
			</Box>
		)
	}

	return (
		<Box>
			<Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
				<Button onClick={() => navigate(-1)}>Back</Button>
				<Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
					<TextField select label="Report" value={reportMode} onChange={e => setReportMode(e.target.value as any)} size="small" sx={{ minWidth: 140 }}>
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
					<Button variant="outlined" onClick={exportCsv}>Export CSV</Button>
					<Button variant="outlined" onClick={exportPdf}>Export PDF</Button>
				</Stack>
			</Stack>
			<Typography variant="h5" gutterBottom>Customer #{customerId}</Typography>

			<Card sx={{ mb: 2 }}>
				<CardContent>
					<Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
						<ToggleButtonGroup exclusive value={type} onChange={(_e, v) => v && setType(v)} color={type === 'credit' ? 'primary' : 'secondary'}>
							<ToggleButton value="credit">Credit</ToggleButton>
							<ToggleButton value="payment">Payment</ToggleButton>
						</ToggleButtonGroup>
						<TextField type="number" label="Amount" value={amount} onChange={e => setAmount(e.target.value)} sx={{ maxWidth: 200 }} />
						<TextField label="Note" value={note} onChange={e => setNote(e.target.value)} sx={{ flex: 1 }} />
						<Button variant="contained" onClick={add} disabled={!canSave}>{type === 'credit' ? 'Add Credit' : 'Add Payment'}</Button>
					</Stack>
				</CardContent>
			</Card>

			<Grid container spacing={2}>
				<Grid item xs={12} md={6}>
					<Card>
						<CardContent>
							<Typography variant="h6" gutterBottom>Summary</Typography>
							<Stack direction="row" spacing={3}>
								<Box>
									<Typography color="text.secondary">Total Credit</Typography>
									<Typography variant="h6">₹ {summary.total_credit?.toFixed(2) || '0.00'}</Typography>
								</Box>
								<Box>
									<Typography color="text.secondary">Total Payment</Typography>
									<Typography variant="h6">₹ {summary.total_payment?.toFixed(2) || '0.00'}</Typography>
								</Box>
								<Box>
									<Typography color="text.secondary">Total Due</Typography>
									<Typography variant="h6" color={summary.total_due > 0 ? 'error' : 'success.main'}>₹ {summary.total_due?.toFixed(2) || '0.00'}</Typography>
								</Box>
							</Stack>
						</CardContent>
					</Card>
				</Grid>
				<Grid item xs={12} md={6}>
					<Card>
						<CardContent>
							<Typography variant="h6" gutterBottom>Recent Transactions</Typography>
							{/* Scrollable transaction list container */}
							<Box sx={{ 
								height: '300px', // Fixed height for scrolling
								overflowY: 'auto', // Enable vertical scrolling
								overflowX: 'hidden', // Hide horizontal scrollbar
								pr: 1, // Right padding for scrollbar
								'&::-webkit-scrollbar': {
									width: '6px',
								},
								'&::-webkit-scrollbar-track': {
									background: '#f1f1f1',
									borderRadius: '3px',
								},
								'&::-webkit-scrollbar-thumb': {
									background: '#c1c1c1',
									borderRadius: '3px',
									'&:hover': {
										background: '#a8a8a8',
									},
								},
							}}>
								{transactions.length > 0 ? (
									transactions.map(t => (
										<Box key={t.id} sx={{ py: 1.5 }}>
											<Stack direction="row" justifyContent="space-between" alignItems="center">
												<Box sx={{ flex: 1 }}>
													<Typography>{t.type === 'credit' ? 'Credit' : 'Payment'} — {dayjs(t.date).format('DD MMM YYYY')}</Typography>
													{t.note ? <Typography color="text.secondary">{t.note}</Typography> : null}
												</Box>
												<Stack direction="row" alignItems="center" spacing={1}>
													<Typography color={t.type === 'credit' ? 'text.primary' : 'success.main'} sx={{ minWidth: 'fit-content' }}>
														₹ {t.amount.toFixed(2)}
													</Typography>
													<IconButton
														size="small"
														color="error"
														onClick={() => handleDeleteClick(t)}
														sx={{ 
															'&:hover': { 
																backgroundColor: 'error.light',
																color: 'white'
															}
														}}
													>
														🗑️
													</IconButton>
												</Stack>
											</Stack>
											<Divider sx={{ mt: 1 }} />
										</Box>
									))
								) : (
									<Box sx={{ textAlign: 'center', py: 4 }}>
										<Typography color="text.secondary">
											No transactions yet. Add your first transaction to get started!
										</Typography>
									</Box>
								)}
							</Box>
						</CardContent>
					</Card>
				</Grid>
			</Grid>

			{/* Delete Transaction Confirmation Dialog */}
			<Dialog open={deleteDialogOpen} onClose={handleDeleteCancel}>
				<DialogTitle>Delete Transaction</DialogTitle>
				<DialogContent>
					<DialogContentText>
						Are you sure you want to delete this transaction?
						<br /><br />
						<strong>Type:</strong> {transactionToDelete?.type === 'credit' ? 'Credit' : 'Payment'}
						<br />
						<strong>Amount:</strong> ₹ {transactionToDelete?.amount.toFixed(2)}
						<br />
						<strong>Date:</strong> {transactionToDelete ? dayjs(transactionToDelete.date).format('DD MMM YYYY') : ''}
						{transactionToDelete?.note && (
							<>
								<br />
								<strong>Note:</strong> {transactionToDelete.note}
							</>
						)}
						<br /><br />
						This action cannot be undone and will affect the customer's balance.
					</DialogContentText>
				</DialogContent>
				<DialogActions>
					<Button onClick={handleDeleteCancel}>Cancel</Button>
					<Button onClick={handleDeleteConfirm} color="error" variant="contained">
						Delete Transaction
					</Button>
				</DialogActions>
			</Dialog>
		</Box>
	)
} 