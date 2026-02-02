import React, { useEffect, useState } from 'react'
import { Box, Grid, Card, CardContent, Typography, TextField, Stack, Chip } from '@mui/material'
import dayjs from 'dayjs'
import { BarChart, PieChart } from '@mui/x-charts'

declare global { interface Window { api: any } }

export default function Dashboard() {
	const [month, setMonth] = useState(dayjs().format('YYYY-MM'))
	const [metrics, setMetrics] = useState<any>(null)
	const hasApi = typeof window !== 'undefined' && window.api

	useEffect(() => {
		if (!hasApi) return
		window.api.getDashboardMetrics({ month }).then((m: any) => setMetrics(m)).catch((err: unknown) => console.error('metrics error', err))
	}, [hasApi, month])

	const formatRs = (n: number) => `Rs ${Number(n || 0).toFixed(2)}`

	const salesByFuelData = metrics ? [
		{ id: 0, value: metrics.sales.totalsByFuel.petrol || 0, label: 'Petrol', color: '#2E86AB' },
		{ id: 1, value: metrics.sales.totalsByFuel.diesel || 0, label: 'Diesel', color: '#A23B72' },
		{ id: 2, value: metrics.sales.totalsByFuel.others || 0, label: 'Others', color: '#F18F01' },
	] : []

	// Create full month data (1-31) with zeros for missing days
	const createFullMonthData = () => {
		const daysInMonth = dayjs(month).daysInMonth()
		const fullMonthData = {
			dates: Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString().padStart(2, '0')),
			petrol: Array(daysInMonth).fill(0),
			diesel: Array(daysInMonth).fill(0),
			others: Array(daysInMonth).fill(0),
			expenses: Array(daysInMonth).fill(0)
		}

		// Fill in actual sales data
		if (metrics && metrics.sales.dailySeries) {
			metrics.sales.dailySeries.forEach((dayData: any) => {
				const dayIndex = parseInt(dayData.date.split('-')[2]) - 1
				if (dayIndex >= 0 && dayIndex < daysInMonth) {
					fullMonthData.petrol[dayIndex] = dayData.petrol || 0
					fullMonthData.diesel[dayIndex] = dayData.diesel || 0
					fullMonthData.others[dayIndex] = dayData.others || 0
				}
			})
		}

		// Fill in actual expense data
		if (metrics && metrics.expenses.dailySeries) {
			metrics.expenses.dailySeries.forEach((dayData: any) => {
				const dayIndex = parseInt(dayData.date.split('-')[2]) - 1
				if (dayIndex >= 0 && dayIndex < daysInMonth) {
					fullMonthData.expenses[dayIndex] = dayData.amount || 0
				}
			})
		}

		return fullMonthData
	}

	const fullMonthData = createFullMonthData()

	// Calculate averages
	const averageSalesPerDay = metrics && metrics.sales.dailySeries.length > 0 
		? metrics.sales.totalSales / metrics.sales.dailySeries.length 
		: 0
	const averageExpensesPerDay = metrics && metrics.expenses.dailySeries.length > 0 
		? metrics.expenses.total / metrics.expenses.dailySeries.length 
		: 0

	return (
		<Box>
			<Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" mb={2} gap={2}>
				<Typography variant="h5">SLNSS CRM Dashboard</Typography>
				<TextField type="month" label="Month" InputLabelProps={{ shrink: true }} size="small" value={month} onChange={e => setMonth(e.target.value)} />
			</Stack>

			<Grid container spacing={2}>
				<Grid item xs={12} md={3}>
					<Card>
						<CardContent>
							<Typography color="text.secondary" gutterBottom>Total Sales (Month)</Typography>
							<Typography variant="h4">{metrics ? formatRs(metrics.sales.totalSales) : '—'}</Typography>
							<Typography variant="h6" color="primary" sx={{ mt: 1 }}>Daily Average: {formatRs(averageSalesPerDay)}</Typography>
							<Stack direction="column" gap={1} mt={2}>
								<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
									<Typography variant="body2" sx={{ color: '#2E86AB', fontWeight: 500 }}>Petrol:</Typography>
									<Typography variant="body2" fontWeight="bold">{metrics ? formatRs(metrics.sales.dailyAverageByFuel.petrol) : '—'}</Typography>
								</Box>
								<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
									<Typography variant="body2" sx={{ color: '#A23B72', fontWeight: 500 }}>Diesel:</Typography>
									<Typography variant="body2" fontWeight="bold">{metrics ? formatRs(metrics.sales.dailyAverageByFuel.diesel) : '—'}</Typography>
								</Box>
								<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
									<Typography variant="body2" sx={{ color: '#F18F01', fontWeight: 500 }}>Others:</Typography>
									<Typography variant="body2" fontWeight="bold">{metrics ? formatRs(metrics.sales.dailyAverageByFuel.others) : '—'}</Typography>
								</Box>
							</Stack>
						</CardContent>
					</Card>
				</Grid>
				<Grid item xs={12} md={3}>
					<Card>
						<CardContent>
							<Typography color="text.secondary" gutterBottom>Total Expenses (Month)</Typography>
							<Typography variant="h4">{metrics ? formatRs(metrics.expenses.total) : '—'}</Typography>
							<Typography variant="h6" color="error" sx={{ mt: 1 }}>Daily Average: {formatRs(averageExpensesPerDay)}</Typography>
						</CardContent>
					</Card>
				</Grid>
				<Grid item xs={12} md={3}>
					<Card>
						<CardContent>
							<Typography color="text.secondary" gutterBottom>Credits & Payments (Month)</Typography>
							<Typography variant="h6">Issued: {metrics ? formatRs(metrics.credits.monthCredit) : '—'}</Typography>
							<Typography variant="h6">Payments: {metrics ? formatRs(metrics.credits.monthPayment) : '—'}</Typography>
							<Typography variant="subtitle2" color={metrics && metrics.credits.monthNet >= 0 ? 'error' : 'success.main'}>Net: {metrics ? formatRs(metrics.credits.monthNet) : '—'}</Typography>
						</CardContent>
					</Card>
				</Grid>
				<Grid item xs={12} md={3}>
					<Card>
						<CardContent>
							<Typography color="text.secondary" gutterBottom>Total Outstanding Due</Typography>
							<Typography variant="h4" color="error.main">{metrics ? formatRs(metrics.credits.totalDue) : '—'}</Typography>
						</CardContent>
					</Card>
				</Grid>

				<Grid item xs={12} md={8}>
					<Card>
						<CardContent>
							<Typography gutterBottom>Monthly Sales by Fuel Type - {dayjs(month).format('MMMM YYYY')}</Typography>
							<BarChart
								height={300}
								xAxis={[{ scaleType: 'band', data: fullMonthData.dates }]}
								series={[
									{ data: fullMonthData.petrol, label: 'Petrol', stack: 'total', color: '#2E86AB' },
									{ data: fullMonthData.diesel, label: 'Diesel', stack: 'total', color: '#A23B72' },
									{ data: fullMonthData.others, label: 'Others', stack: 'total', color: '#F18F01' }
								]}
							/>
						</CardContent>
					</Card>
				</Grid>
				<Grid item xs={12} md={4}>
					<Card>
						<CardContent>
							<Typography gutterBottom>Sales Distribution by Fuel Type</Typography>
							<PieChart
								height={300}
								series={[{ data: salesByFuelData, innerRadius: 40 }]}
							/>
						</CardContent>
					</Card>
				</Grid>

				<Grid item xs={12}>
					<Card>
						<CardContent>
							<Typography gutterBottom>Monthly Expenses - {dayjs(month).format('MMMM YYYY')}</Typography>
							<BarChart
								height={300}
								xAxis={[{ scaleType: 'band', data: fullMonthData.dates }]}
								series={[{ data: fullMonthData.expenses, label: 'Expenses', color: '#C73E1D' }]}
							/>
						</CardContent>
					</Card>
				</Grid>
			</Grid>
		</Box>
	)
} 