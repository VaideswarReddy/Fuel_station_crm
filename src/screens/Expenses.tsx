import React, { useState, useEffect, useMemo } from 'react'
import {
	Box,
	Typography,
	Card,
	CardContent,
	TextField,
	Button,
	Grid,
	Stack,
	Divider,
	Snackbar,
	Alert,
	IconButton,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	DialogContentText
} from '@mui/material'
import dayjs from 'dayjs'

declare global { interface Window { api: any } }

type Expense = {
	id: number
	date: string
	description: string
	amount: number
	created_at: string
}

export default function Expenses() {
	const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'))
	const [description, setDescription] = useState('')
	const [amount, setAmount] = useState('')
	const [expenses, setExpenses] = useState<Expense[]>([])
	const [loading, setLoading] = useState(false)
	const [showSuccess, setShowSuccess] = useState(false)
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
	const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null)
	const [reportMode, setReportMode] = useState<'all' | 'month' | 'range'>('all')
	const [month, setMonth] = useState(dayjs().format('YYYY-MM'))
	const [startDate, setStartDate] = useState(dayjs().startOf('month').format('YYYY-MM-DD'))
	const [endDate, setEndDate] = useState(dayjs().endOf('month').format('YYYY-MM-DD'))
	
	// Historical data management
	const [isHistorical, setIsHistorical] = useState(false)
	const [isEditMode, setIsEditMode] = useState(false)
	const [editWarningShown, setEditWarningShown] = useState(false)
	const [editedExpenses, setEditedExpenses] = useState<Record<number, Partial<Expense>>>({})

	const hasApi = typeof window !== 'undefined' && window.api

	// Load expenses for the selected date
	useEffect(() => {
		if (!hasApi) return
		loadExpenses()
	}, [hasApi, date])

	// Reset edit mode when date changes
	useEffect(() => {
		setIsEditMode(false)
		setEditWarningShown(false)
		setEditedExpenses({})
	}, [date])

	const loadExpenses = async () => {
		try {
			setLoading(true)
			const result = await window.api.listExpensesByDate(date)
			setExpenses(result || [])
			
			// Check if this is historical data (not today)
			const isPastDate = dayjs(date).isBefore(dayjs(), 'day')
			setIsHistorical(isPastDate)
			
			// Initialize edited expenses for historical data
			if (isPastDate && result && result.length > 0) {
				const edited: Record<number, Partial<Expense>> = {}
				result.forEach((expense: Expense) => {
					edited[expense.id] = { ...expense }
				})
				setEditedExpenses(edited)
			}
		} catch (error) {
			console.error('Error loading expenses:', error)
		} finally {
			setLoading(false)
		}
	}

	const addExpense = async () => {
		if (!hasApi) return
		
		if (!description || !amount) {
			alert('Please fill in all fields')
			return
		}

		const amountValue = Number(amount)
		if (isNaN(amountValue) || amountValue <= 0) {
			alert('Please enter a valid amount')
			return
		}

		try {
			setLoading(true)
			const result = await window.api.addExpense({
				date,
				description,
				amount: amountValue
			})

			if (result.ok) {
				// Reset form
				setDescription('')
				setAmount('')
				setShowSuccess(true)
				
				// Reload expenses
				await loadExpenses()
			} else {
				alert('Failed to add expense. Please try again.')
			}
		} catch (error) {
			console.error('Error adding expense:', error)
			alert('Error adding expense: ' + error)
		} finally {
			setLoading(false)
		}
	}

	const saveEditedExpenses = async () => {
		if (!hasApi || !isHistorical || !isEditMode) return
		
		try {
			setLoading(true)
			
			// Save each edited expense
			for (const [expenseId, editedExpense] of Object.entries(editedExpenses)) {
				if (editedExpense.description && editedExpense.amount) {
					await window.api.updateExpense({
						id: parseInt(expenseId),
						date: editedExpense.date!,
						description: editedExpense.description,
						amount: editedExpense.amount
					})
				}
			}
			
			// Exit edit mode and reload data
			setIsEditMode(false)
			setEditWarningShown(false)
			setEditedExpenses({})
			await loadExpenses()
			setShowSuccess(true)
			
		} catch (error) {
			console.error('Error saving edited expenses:', error)
			alert('Error saving edited expenses: ' + error)
		} finally {
			setLoading(false)
		}
	}

	const toggleEditMode = () => {
		if (!isHistorical) return
		
		if (!isEditMode && !editWarningShown) {
			const confirmed = window.confirm(
				'WARNING: You are about to edit historical expense data.\n\n' +
				'This will permanently modify the data and may affect reports and calculations.\n\n' +
				'Are you sure you want to proceed?'
			)
			if (confirmed) {
				setIsEditMode(true)
				setEditWarningShown(true)
			}
		} else {
			setIsEditMode(false)
			setEditWarningShown(false)
			setEditedExpenses({})
		}
	}

	const updateEditedExpense = (expenseId: number, field: keyof Expense, value: string | number) => {
		setEditedExpenses(prev => ({
			...prev,
			[expenseId]: {
				...prev[expenseId],
				[field]: value
			}
		}))
	}

	const deleteExpense = async (expense: Expense) => {
		setExpenseToDelete(expense)
		setDeleteDialogOpen(true)
	}

	const handleDeleteConfirm = async () => {
		if (!expenseToDelete || !hasApi) return
		
		try {
			setLoading(true)
			const result = await window.api.deleteExpense(expenseToDelete.id)
			
			if (result.ok) {
				await loadExpenses()
				setDeleteDialogOpen(false)
				setExpenseToDelete(null)
			} else {
				alert('Failed to delete expense. Please try again.')
			}
		} catch (error) {
			console.error('Error deleting expense:', error)
			alert('Error deleting expense: ' + error)
		} finally {
			setLoading(false)
		}
	}

	const handleDeleteCancel = () => {
		setDeleteDialogOpen(false)
		setExpenseToDelete(null)
	}

	const exportCsv = async () => {
		if (!hasApi) return
		const payload: any = { mode: reportMode }
		if (reportMode === 'month') payload.month = month
		if (reportMode === 'range') {
			payload.startDate = startDate || null
			payload.endDate = endDate || null
		}
		await window.api.exportExpensesCsv(payload)
	}

	const exportPdf = async () => {
		if (!hasApi) return
		const payload: any = { mode: reportMode }
		if (reportMode === 'month') payload.month = month
		if (reportMode === 'range') {
			payload.startDate = startDate || null
			payload.endDate = endDate || null
		}
		await window.api.exportExpensesPdf(payload)
	}

	// Calculate totals for the selected date
	const dailyTotal = useMemo(() => {
		return expenses.reduce((sum, expense) => sum + expense.amount, 0)
	}, [expenses])

	return (
		<Box>
			<Typography variant="h5" gutterBottom>Daily Expenses</Typography>
			
			{/* Historical Data Warning Banner */}
			{isHistorical && isEditMode && (
				<Card sx={{ mb: 3, bgcolor: 'warning.light' }}>
					<CardContent>
						<Typography variant="h6" color="warning.dark" gutterBottom>
							⚠️ EDIT MODE - Historical Data
						</Typography>
						<Typography color="warning.dark">
							You are currently editing historical expense data for {date}. 
							Changes will permanently modify the data and may affect reports and calculations.
						</Typography>
					</CardContent>
				</Card>
			)}
			
			{/* Add Expense Form */}
			<Card sx={{ mb: 3 }}>
				<CardContent>
					<Typography variant="h6" gutterBottom>Add New Expense</Typography>
					<Grid container spacing={2} alignItems="flex-end">
						<Grid item xs={12} sm={4}>
							<TextField
								type="date"
								label="Date"
								value={date}
								onChange={e => setDate(e.target.value)}
								InputLabelProps={{ shrink: true }}
								fullWidth
								size="small"
							/>
						</Grid>
						<Grid item xs={12} sm={5}>
							<TextField
								label="Description"
								value={description}
								onChange={e => setDescription(e.target.value)}
								fullWidth
								size="small"
								placeholder="Brief description of the expense"
							/>
						</Grid>
						<Grid item xs={12} sm={2}>
							<TextField
								type="number"
								label="Amount (Rs)"
								value={amount}
								onChange={e => setAmount(e.target.value)}
								fullWidth
								size="small"
								placeholder="0.00"
								inputProps={{ min: 0, step: 0.01 }}
							/>
						</Grid>
						<Grid item xs={12} sm={1}>
							<Button
								variant="contained"
								onClick={addExpense}
								disabled={loading || !description || !amount || (isHistorical && !isEditMode)}
								fullWidth
							>
								Add
							</Button>
						</Grid>
					</Grid>
				</CardContent>
			</Card>

			{/* Daily Summary */}
			<Card sx={{ mb: 3 }}>
				<CardContent>
					<Typography variant="h6" gutterBottom>Daily Summary - {dayjs(date).format('DD MMM YYYY')}</Typography>
					<Grid container spacing={3}>
						<Grid item xs={12} md={6}>
							<Typography variant="subtitle1" color="primary">Total Expenses</Typography>
							<Typography variant="h4">Rs {dailyTotal.toFixed(2)}</Typography>
						</Grid>
						<Grid item xs={12} md={6}>
							<Typography variant="subtitle1" color="secondary">Number of Expenses</Typography>
							<Typography variant="h4">{expenses.length}</Typography>
						</Grid>
					</Grid>
				</CardContent>
			</Card>

			{/* Expenses List */}
			<Card sx={{ mb: 3 }}>
				<CardContent>
					<Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
						<Typography variant="h6">Expenses for {dayjs(date).format('DD MMM YYYY')}</Typography>
						{isHistorical && (
							<Button
								variant={isEditMode ? "contained" : "outlined"}
								color={isEditMode ? "warning" : "primary"}
								onClick={toggleEditMode}
								size="small"
							>
								{isEditMode ? "Exit Edit Mode" : "Edit Historical Data"}
							</Button>
						)}
					</Stack>
					
					{expenses.length === 0 ? (
						<Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
							No expenses recorded for this date.
						</Typography>
					) : (
						<Stack spacing={2}>
							{expenses.map(expense => (
								<Box key={expense.id} sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
									<Stack direction="row" justifyContent="space-between" alignItems="center">
										<Box sx={{ flex: 1 }}>
											{isHistorical && isEditMode ? (
												<Stack spacing={1}>
													<TextField
														label="Description"
														value={editedExpenses[expense.id]?.description || expense.description}
														onChange={e => updateEditedExpense(expense.id, 'description', e.target.value)}
														size="small"
														fullWidth
													/>
													<TextField
														type="number"
														label="Amount (Rs)"
														value={editedExpenses[expense.id]?.amount || expense.amount}
														onChange={e => updateEditedExpense(expense.id, 'amount', Number(e.target.value))}
														size="small"
														fullWidth
														inputProps={{ min: 0, step: 0.01 }}
													/>
												</Stack>
											) : (
												<>
													<Typography variant="subtitle1">{expense.description}</Typography>
												</>
											)}
										</Box>
										<Stack direction="row" alignItems="center" spacing={2}>
											{!isHistorical || !isEditMode ? (
												<Typography variant="h6" color="error.main">
													Rs {expense.amount.toFixed(2)}
												</Typography>
											) : null}
											<IconButton
												size="small"
												color="error"
												onClick={() => deleteExpense(expense)}
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
								</Box>
							))}
						</Stack>
					)}
					
					{isHistorical && isEditMode && expenses.length > 0 && (
						<Box sx={{ mt: 2, textAlign: 'center' }}>
							<Button
								variant="contained"
								color="primary"
								onClick={saveEditedExpenses}
								disabled={loading}
								size="large"
							>
								Save Changes
							</Button>
						</Box>
					)}
				</CardContent>
			</Card>

			{/* Reports Section */}
			<Card sx={{ mb: 3 }}>
				<CardContent>
					<Typography variant="h6" gutterBottom>Generate Reports</Typography>
					<Stack direction={{ xs: 'column', sm: 'row' }} gap={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
						<TextField 
							select 
							label="Report Period" 
							value={reportMode} 
							onChange={e => setReportMode(e.target.value as any)} 
							size="small" 
							sx={{ minWidth: 140 }}
						>
							<option value="all">All time</option>
							<option value="month">Monthly</option>
							<option value="range">Date range</option>
						</TextField>
						{reportMode === 'month' && (
							<TextField 
								type="month" 
								label="Month" 
								InputLabelProps={{ shrink: true }} 
								value={month} 
								onChange={e => setMonth(e.target.value)} 
								size="small" 
							/>
						)}
						{reportMode === 'range' && (
							<>
								<TextField 
									type="date" 
									label="Start Date" 
									InputLabelProps={{ shrink: true }} 
									value={startDate} 
									onChange={e => setStartDate(e.target.value)} 
									size="small" 
								/>
								<TextField 
									type="date" 
									label="End Date" 
									InputLabelProps={{ shrink: true }} 
									value={endDate} 
									onChange={e => setEndDate(e.target.value)} 
									size="small" 
								/>
							</>
						)}
						<Button variant="outlined" onClick={exportCsv}>Export CSV</Button>
						<Button variant="outlined" onClick={exportPdf}>Export PDF</Button>
					</Stack>
				</CardContent>
			</Card>

			{/* Success Message */}
			<Snackbar open={showSuccess} autoHideDuration={3000} onClose={() => setShowSuccess(false)}>
				<Alert onClose={() => setShowSuccess(false)} severity="success" sx={{ width: '100%' }}>
					{isHistorical && isEditMode ? 'Historical expenses updated successfully!' : 'Expense added successfully!'}
				</Alert>
			</Snackbar>

			{/* Delete Confirmation Dialog */}
			<Dialog open={deleteDialogOpen} onClose={handleDeleteCancel}>
				<DialogTitle>Delete Expense</DialogTitle>
				<DialogContent>
					<DialogContentText>
						Are you sure you want to delete this expense?
						<br /><br />
						<strong>Description:</strong> {expenseToDelete?.description}
						<br />
						<strong>Amount:</strong> Rs {expenseToDelete?.amount.toFixed(2)}
						<br />
						<strong>Date:</strong> {expenseToDelete ? dayjs(expenseToDelete.date).format('DD MMM YYYY') : ''}
						<br /><br />
						This action cannot be undone.
					</DialogContentText>
				</DialogContent>
				<DialogActions>
					<Button onClick={handleDeleteCancel}>Cancel</Button>
					<Button onClick={handleDeleteConfirm} color="error" variant="contained">
						Delete Expense
					</Button>
				</DialogActions>
			</Dialog>
		</Box>
	)
} 