import React, { useEffect, useMemo, useState } from 'react'
import { Box, Button, Card, CardContent, Divider, Grid, MenuItem, Stack, TextField, Typography, Alert, Snackbar } from '@mui/material'
import dayjs from 'dayjs'

type Nozzle = { id: number; label: string; fuel_type: 'petrol'|'diesel'|'others'; price_per_litre: number }

declare global { interface Window { api: any } }

export default function Sales() {
	const [date, setDate] = useState<string>(dayjs().format('YYYY-MM-DD'))
	const [nozzles, setNozzles] = useState<Nozzle[]>([])
	const [rows, setRows] = useState<Record<number, { opening: string; closing: string }>>({})
	const [loading, setLoading] = useState(false)
	const [isHistorical, setIsHistorical] = useState(false)
	const [reportMode, setReportMode] = useState<'all' | 'month' | 'range'>('all')
	const [month, setMonth] = useState('')
	const [startDate, setStartDate] = useState('')
	const [endDate, setEndDate] = useState('')
	const [showSuccess, setShowSuccess] = useState(false)
	const [historicalFuelPrices, setHistoricalFuelPrices] = useState({ petrol: 0, diesel: 0 })
	const [lastReadings, setLastReadings] = useState<Record<number, { closing: number; date: string; source: 'previous_day' | 'last_available' }>>({})
	const [historicalData, setHistoricalData] = useState<Record<number, { 
		opening: number; 
		closing: number; 
		sales_litres: number; 
		sales_value: number;
		petrol_price: number;
		diesel_price: number;
	}>>({})
	const [isEditMode, setIsEditMode] = useState(false)
	const [editWarningShown, setEditWarningShown] = useState(false)

	const hasApi = typeof window !== 'undefined' && (window as any).api

	const toggleEditMode = () => {
		if (!isEditMode) {
			// Show warning when entering edit mode
			const confirmed = window.confirm(
				'WARNING: You are about to edit historical sales data.\n\n' +
				'This will permanently change the data for this date and may affect:\n' +
				'• Sales calculations and reports\n' +
				'• Customer billing if applicable\n' +
				'• Historical accuracy\n\n' +
				'Are you sure you want to proceed?'
			)
			if (confirmed) {
				setIsEditMode(true)
				setEditWarningShown(true)
			}
		} else {
			// Exit edit mode
			setIsEditMode(false)
			setEditWarningShown(false)
		}
	}

	const resetEditMode = () => {
		setIsEditMode(false)
		setEditWarningShown(false)
	}

	useEffect(() => {
		if (!hasApi) return
		window.api.listNozzles().then((list: Nozzle[]) => {
			setNozzles(list)
			const init: Record<number, { opening: string; closing: string }> = {}
			list.forEach(n => init[n.id] = { opening: '', closing: '' })
			setRows(init)
			
			// Reset nozzle prices when date changes - each new date should start with fresh prices
			const resetNozzlePrices = async () => {
				for (const nozzle of list) {
					if (nozzle.price_per_litre !== 0) {
						await window.api.updateNozzle({ ...nozzle, price_per_litre: 0 })
					}
				}
				// Refresh nozzles to get updated data
				const updatedNozzles = await window.api.listNozzles()
				setNozzles(updatedNozzles)
			}
			resetNozzlePrices()
		})
	}, [hasApi, date]) // Added date dependency to reset when date changes

	// Get last readings whenever date changes
	useEffect(() => {
		if (!hasApi || !date) return
		window.api.getLastReadings(date).then(setLastReadings)
	}, [hasApi, date])

	useEffect(() => {
		if (!hasApi || !date) return
		setLoading(true)
		// Reset edit mode when date changes
		setIsEditMode(false)
		setEditWarningShown(false)
		
		window.api.listSalesByDate(date).then((readings: any[]) => {
			const next = { ...rows }
			const historical = { ...historicalData }
			
			if (readings.length > 0) {
				// Historical data exists
				for (const r of readings) {
					next[r.nozzle_id] = { opening: String(r.opening), closing: String(r.closing) }
					// Store all historical data for display
					historical[r.nozzle_id] = {
						opening: r.opening,
						closing: r.closing,
						sales_litres: r.sales_litres,
						sales_value: r.sales_value,
						petrol_price: r.petrol_price,
						diesel_price: r.diesel_price
					}
				}
				setIsHistorical(true)
				setHistoricalData(historical)
				// Store individual nozzle prices from the readings instead of global fuel prices
				const nozzlePrices: Record<number, number> = {}
				for (const reading of readings) {
					// Store the specific price that was used for this nozzle
					const price = reading.fuel_type === 'petrol' ? reading.petrol_price : reading.diesel_price
					nozzlePrices[reading.nozzle_id] = price
				}
				// We don't need historicalFuelPrices anymore since each nozzle has its own price
				setHistoricalFuelPrices({ petrol: 0, diesel: 0 })
			} else {
				// No data for this date, reset to empty and prefill with last readings
				for (const n of nozzles) {
					const lastReading = lastReadings[n.id]
					next[n.id] = { 
						opening: lastReading ? String(lastReading.closing) : '', // Previous day or last available before selected date
						closing: '' 
					}
				}
				setIsHistorical(false)
				setHistoricalData({})
				setHistoricalFuelPrices({ petrol: 0, diesel: 0 })
			}
			setRows(next)
			setLoading(false)
		})
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [date, hasApi, lastReadings])

	const totals = useMemo(() => {
		let litres = 0
		let value = 0
		
		for (const n of nozzles) {
			// For historical data, use stored values; for new data, calculate
			if (isHistorical && historicalData[n.id]) {
				if (isEditMode) {
					// In edit mode, recalculate based on current readings and edited prices
					const r = rows[n.id] || { opening: '', closing: '' }
					const opening = Number(r.opening) || 0
					const closing = Number(r.closing) || 0
					const l = closing - opening
					
					if (isFinite(l) && l > 0) {
						// Get the edited price from historical data
						let price = 0
						if (n.fuel_type === 'petrol' || n.fuel_type === 'others') {
							price = historicalData[n.id]?.petrol_price || 0
						} else if (n.fuel_type === 'diesel') {
							price = historicalData[n.id]?.diesel_price || 0
						}
						
						if (price > 0) {
							litres += l
							// Get the edited price from historical data
							let price = 0
							if (n.fuel_type === 'petrol' || n.fuel_type === 'others') {
								price = historicalData[n.id]?.petrol_price || 0
							} else if (n.fuel_type === 'diesel') {
								price = historicalData[n.id]?.diesel_price || 0
							}
							
							if (price > 0) {
								value += l * price
							}
						}
					}
				} else {
					// Read-only historical mode, use stored values
					litres += historicalData[n.id].sales_litres || 0
					value += historicalData[n.id].sales_value || 0
				}
			} else {
				const r = rows[n.id] || { opening: '', closing: '' }
				const l = Number(r.closing) - Number(r.opening)
				if (!isFinite(l) || l <= 0) {
					continue
				}
				litres += l
				// Use the individual nozzle price for calculations
				const price = n.price_per_litre || 0
				if (price > 0) {
					value += l * price
				}
			}
		}
		return { litres, value }
	}, [rows, nozzles, isHistorical, historicalData, isEditMode])

	const fuelTotals = useMemo(() => {
		const totals: Record<string, { litres: number; value: number }> = { 
			petrol: { litres: 0, value: 0 }, 
			diesel: { litres: 0, value: 0 },
			others: { litres: 0, value: 0 }
		}
		
		for (const n of nozzles) {
			// For historical data, use stored values; for new data, calculate
			if (isHistorical && historicalData[n.id]) {
				if (isEditMode) {
					// In edit mode, recalculate based on current readings and edited prices
					const r = rows[n.id] || { opening: '', closing: '' }
					const opening = Number(r.opening) || 0
					const closing = Number(r.closing) || 0
					const l = closing - opening
					
					if (isFinite(l) && l > 0) {
						// Get the edited price from historical data
						let price = 0
						if (n.fuel_type === 'petrol' || n.fuel_type === 'others') {
							price = historicalData[n.id]?.petrol_price || 0
						} else if (n.fuel_type === 'diesel') {
							price = historicalData[n.id]?.diesel_price || 0
						}
						
						if (price > 0) {
							totals[n.fuel_type].litres += l
							totals[n.fuel_type].value += l * price
						}
					}
				} else {
					// Read-only historical mode, use stored values
					totals[n.fuel_type].litres += historicalData[n.id].sales_litres || 0
					totals[n.fuel_type].value += historicalData[n.id].sales_value || 0
				}
			} else {
				const r = rows[n.id] || { opening: '', closing: '' }
				const l = Number(r.closing) - Number(r.opening)
				if (!isFinite(l) || l <= 0) {
					continue
				}
				
				// Use the individual nozzle price for calculations
				const price = n.price_per_litre || 0
				if (price > 0) {
					totals[n.fuel_type].litres += l
					totals[n.fuel_type].value += l * price
				}
			}
		}
		return totals
	}, [rows, nozzles, isHistorical, historicalData, isEditMode])

	const save = async () => {
		if (!hasApi) return
		
		// Validate that if opening is not empty/zero, closing must also be provided
		const validationErrors: string[] = []
		for (const n of nozzles) {
			const r = rows[n.id] || { opening: '', closing: '' }
			const opening = Number(r.opening) || 0
			const closing = Number(r.closing) || 0
			
			// If opening has a value (not empty and not zero), closing must also have a value
			if (opening > 0 && closing === 0) {
				validationErrors.push(`${n.label}: Closing reading is required when opening reading is ${opening}`)
			}
			
			// If both opening and closing are provided, validate that closing >= opening
			if (opening > 0 && closing > 0 && closing < opening) {
				validationErrors.push(`${n.label}: Closing reading (${closing}) must be equal to or greater than opening reading (${opening})`)
			}
			
			// If there are any readings (opening or closing), unit price must be provided
			let hasValidPrice = false
			if (isHistorical && isEditMode && historicalData[n.id]) {
				// In edit mode, check the historical data prices
				if (n.fuel_type === 'petrol' || n.fuel_type === 'others') {
					hasValidPrice = (historicalData[n.id].petrol_price || 0) > 0
				} else if (n.fuel_type === 'diesel') {
					hasValidPrice = (historicalData[n.id].diesel_price || 0) > 0
				}
			} else {
				// Normal mode, check the nozzle price
				hasValidPrice = (n.price_per_litre || 0) > 0
			}
			
			if ((opening > 0 || closing > 0) && !hasValidPrice) {
				validationErrors.push(`${n.label}: Unit price is required when there are opening or closing readings`)
			}
		}
		
		// If there are validation errors, show them and stop
		if (validationErrors.length > 0) {
			alert('Please fix the following errors:\n\n' + validationErrors.join('\n'))
			return
		}
		
		try {
			setLoading(true)
			
			// Prepare entries with appropriate data based on mode
			let entries
			if (isHistorical && isEditMode) {
				// In edit mode, include the edited prices from historical data
				entries = nozzles.map(n => {
					const r = rows[n.id] || { opening: '', closing: '' }
					const opening = Number(r.opening) || 0
					const closing = Number(r.closing) || 0
					
					// Get the edited prices from historical data
					let petrolPrice = 0
					let dieselPrice = 0
					if (historicalData[n.id]) {
						if (n.fuel_type === 'petrol' || n.fuel_type === 'others') {
							petrolPrice = historicalData[n.id].petrol_price || 0
						} else if (n.fuel_type === 'diesel') {
							dieselPrice = historicalData[n.id].diesel_price || 0
						}
					}
					
					return {
						nozzle_id: n.id,
						opening,
						closing,
						petrol_price: petrolPrice,
						diesel_price: dieselPrice
					}
				})
			} else {
				// Normal mode, just send opening/closing readings
				entries = nozzles.map(n => ({ 
					nozzle_id: n.id, 
					opening: Number(rows[n.id]?.opening || 0), 
					closing: Number(rows[n.id]?.closing || 0) 
				}))
			}
			
			const result = await window.api.saveSalesForDate({ date, entries })
			
			if (result.ok) {
				// Reset all nozzles to empty after save
				const next = { ...rows }
				for (const n of nozzles) {
					next[n.id] = { opening: '', closing: '' }
				}
				setRows(next)
				setIsHistorical(false)
				setIsEditMode(false) // Reset edit mode after saving
				setEditWarningShown(false)
				setShowSuccess(true)
			} else {
				console.error('Save failed:', result)
				alert('Failed to save sales data. Please try again.')
			}
		} catch (error) {
			console.error('Error saving sales data:', error)
			alert('Error saving sales data: ' + error)
		} finally {
			setLoading(false)
		}
	}

	const exportCsv = async () => {
		if (!hasApi) return
		const payload: any = { mode: reportMode }
		if (reportMode === 'month') payload.month = month
		if (reportMode === 'range') {
			payload.startDate = startDate || null
			payload.endDate = endDate || null
		}
		await window.api.exportSalesCsv(payload)
	}

	const exportPdf = async () => {
		if (!hasApi) return
		const payload: any = { mode: reportMode }
		if (reportMode === 'month') payload.month = month
		if (reportMode === 'range') {
			payload.startDate = startDate || null
			payload.endDate = endDate || null
		}
		await window.api.exportSalesPdf(payload)
	}

	return (
		<Box>
			<Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" mb={2} gap={2}>
				<Typography variant="h5">Daily Sales</Typography>
				<Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
					<TextField type="date" label="Date" InputLabelProps={{ shrink: true }} value={date} onChange={e => setDate(e.target.value)} size="small" />
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
					<Button variant="contained" onClick={save} disabled={loading || (isHistorical && !isEditMode)}>Save</Button>
				</Stack>
			</Stack>

			{isHistorical && (
				<Typography color="warning.main" sx={{ mb: 2, fontStyle: 'italic' }}>
					Historical data for {date} - entries are read-only. Change date to enter new data.
				</Typography>
			)}

			{isHistorical && isEditMode && (
				<Card sx={{ mb: 2, bgcolor: 'warning.light', border: '2px solid', borderColor: 'warning.main' }}>
					<CardContent>
						<Typography variant="h6" color="warning.dark" gutterBottom>
							⚠️ EDIT MODE - Historical Data
						</Typography>
						<Typography color="warning.dark">
							You are currently editing historical sales data for {date}. 
							Changes will permanently modify the data and may affect reports and calculations.
						</Typography>
					</CardContent>
				</Card>
			)}

			<Grid container spacing={2}>
				{nozzles.map(n => {
					const r = rows[n.id] || { opening: '', closing: '' }
					// For historical data, use stored values; for new data, calculate
					const isHistoricalNozzle = isHistorical && historicalData[n.id]
					const litres = isHistoricalNozzle 
						? historicalData[n.id].sales_litres 
						: (Number(r.closing) || 0) - (Number(r.opening) || 0)
					
					// Calculate value based on current mode and data
					let value = 0
					if (isHistorical && historicalData[n.id]) {
						if (isEditMode) {
							// In edit mode, recalculate based on current readings and edited prices
							const opening = Number(r.opening) || 0
							const closing = Number(r.closing) || 0
							const l = closing - opening
							if (isFinite(l) && l > 0) {
								// Get the edited price from historical data
								let currentPrice = 0
								if (n.fuel_type === 'petrol' || n.fuel_type === 'others') {
									currentPrice = historicalData[n.id]?.petrol_price || 0
								} else if (n.fuel_type === 'diesel') {
									currentPrice = historicalData[n.id]?.diesel_price || 0
								}
								value = l * currentPrice
							}
						} else {
							// Read-only historical mode, use stored value
							value = historicalData[n.id].sales_value
						}
					} else {
						// Normal mode, calculate from current readings and nozzle price
						value = litres * (n.price_per_litre || 0)
					}
					
					// For historical data, get the specific price used for this nozzle
					// For new data, use the current nozzle price
					let price = 0
					if (isHistorical && historicalData[n.id]) {
						// Get the specific price that was used for this nozzle when data was saved
						if (n.fuel_type === 'petrol' || n.fuel_type === 'others') {
							price = historicalData[n.id].petrol_price
						} else if (n.fuel_type === 'diesel') {
							price = historicalData[n.id].diesel_price
						}
					} else {
						// Use current nozzle price for new data
						price = n.price_per_litre || 0
					}
					
					return (
						<Grid item xs={12} md={6} lg={4} key={n.id}>
							<Card>
								<CardContent>
									<Stack spacing={1}>
										<Typography variant="subtitle1">{n.label} — {n.fuel_type.toUpperCase()}</Typography>
										<Stack direction="row" gap={1}>
											<TextField 
												type="number" 
												label="Opening" 
												value={r.opening} 
												onChange={e => setRows(prev => ({ ...prev, [n.id]: { ...prev[n.id], opening: e.target.value } }))} 
												size="small"
												disabled={isHistorical && !isEditMode}
												error={(!isHistorical || isEditMode) && Number(r.opening) > 0 && Number(r.closing) > 0 && Number(r.closing) < Number(r.opening)}
												helperText={(!isHistorical || isEditMode) && lastReadings[n.id] ? 
													lastReadings[n.id].source === 'previous_day' 
														? `Prefilled from previous day (${lastReadings[n.id].date})`
														: `Prefilled from last available (${lastReadings[n.id].date})`
													: ''
												}
											/>
											<TextField 
												type="number" 
												label="Closing" 
												value={r.closing} 
												onChange={e => setRows(prev => ({ ...prev, [n.id]: { ...prev[n.id], closing: e.target.value } }))} 
												size="small"
												disabled={isHistorical && !isEditMode}
												error={(!isHistorical || isEditMode) && Number(r.opening) > 0 && Number(r.closing) === 0}
												helperText={(!isHistorical || isEditMode) && Number(r.opening) > 0 && Number(r.closing) === 0 ? 
													'Closing reading required when opening is not zero' : ''
												}
											/>
										</Stack>
										<Divider />
										<Stack direction="row" justifyContent="space-between">
											<Typography color="text.secondary">Sales (L)</Typography>
											<Typography>{Number.isFinite(litres) ? litres.toFixed(2) : '0.00'}</Typography>
										</Stack>
										<Stack direction="row" justifyContent="space-between">
											<Typography color="text.secondary">Price/Litre</Typography>
											{isHistorical && !isEditMode ? (
												<Typography>Rs {price.toFixed(2)}</Typography>
											) : (
												<TextField 
													type="number" 
													size="small" 
													value={
														isHistorical && isEditMode 
															? (() => {
																if (n.fuel_type === 'petrol' || n.fuel_type === 'others') {
																	return historicalData[n.id]?.petrol_price || ''
																} else if (n.fuel_type === 'diesel') {
																	return historicalData[n.id]?.diesel_price || ''
																}
																return ''
															})()
															: (n.price_per_litre || '')
													}
													onChange={async (e) => {
														const newPrice = Number(e.target.value)
														if (isHistorical && isEditMode) {
															// In edit mode, update the historical data directly
															setHistoricalData(prev => ({
																...prev,
																[n.id]: {
																	...prev[n.id],
																	petrol_price: (n.fuel_type === 'petrol' || n.fuel_type === 'others') ? newPrice : 0,
																	diesel_price: n.fuel_type === 'diesel' ? newPrice : 0
																}
															}))
														} else {
															// Normal mode, update the nozzle
															await window.api.updateNozzle({ ...n, price_per_litre: newPrice })
															// Refresh nozzles to get updated data
															const updatedNozzles = await window.api.listNozzles()
															setNozzles(updatedNozzles)
														}
													}}
													sx={{ width: 120 }}
													placeholder="0.00"
													error={(() => {
														if (!isHistorical || isEditMode) {
															const opening = Number(r.opening) || 0
															const closing = Number(r.closing) || 0
															if (opening > 0 || closing > 0) {
																// Check if price is missing
																if (isHistorical && isEditMode && historicalData[n.id]) {
																	// In edit mode, check historical data prices
																	if (n.fuel_type === 'petrol' || n.fuel_type === 'others') {
																		return (historicalData[n.id].petrol_price || 0) === 0
																	} else if (n.fuel_type === 'diesel') {
																		return (historicalData[n.id].diesel_price || 0) === 0
																	}
																} else {
																	// Normal mode, check nozzle price
																	return (n.price_per_litre || 0) === 0
																}
															}
														}
														return false
													})()}
													helperText={(() => {
														if (!isHistorical || isEditMode) {
															const opening = Number(r.opening) || 0
															const closing = Number(r.closing) || 0
															if (opening > 0 || closing > 0) {
																// Check if price is missing
																if (isHistorical && isEditMode && historicalData[n.id]) {
																	// In edit mode, check historical data prices
																	if (n.fuel_type === 'petrol' || n.fuel_type === 'others') {
																		return (historicalData[n.id].petrol_price || 0) === 0 ? 'Unit price required when readings are provided' : ''
																	} else if (n.fuel_type === 'diesel') {
																		return (historicalData[n.id].diesel_price || 0) === 0 ? 'Unit price required when readings are provided' : ''
																	}
																} else {
																	// Normal mode, check nozzle price
																	return (n.price_per_litre || 0) === 0 ? 'Unit price required when readings are provided' : ''
																}
															}
														}
														return ''
													})()}
												/>
											)}
										</Stack>
										<Stack direction="row" justifyContent="space-between">
											<Typography color="text.secondary">Value</Typography>
											<Typography>Rs {Number.isFinite(value) ? value.toFixed(2) : '0.00'}</Typography>
										</Stack>
									</Stack>
								</CardContent>
							</Card>
						</Grid>
					)
				})}
			</Grid>

			{/* Fuel Type Totals */}
			<Card sx={{ mt: 3 }}>
				<CardContent>
					<Typography variant="h6" gutterBottom>Fuel Type Totals</Typography>
					<Grid container spacing={3}>
						<Grid item xs={12} md={4}>
							<Typography variant="subtitle1" color="primary">Petrol</Typography>
							<Typography variant="h6">{fuelTotals.petrol.litres.toFixed(2)} L</Typography>
							<Typography variant="h6">Rs {fuelTotals.petrol.value.toFixed(2)}</Typography>
						</Grid>
						<Grid item xs={12} md={4}>
							<Typography variant="subtitle1" color="secondary">Diesel</Typography>
							<Typography variant="h6">{fuelTotals.diesel.litres.toFixed(2)} L</Typography>
							<Typography variant="h6">Rs {fuelTotals.diesel.value.toFixed(2)}</Typography>
						</Grid>
						<Grid item xs={12} md={4}>
							<Typography variant="subtitle1" color="warning.main">Others</Typography>
							<Typography variant="h6">{fuelTotals.others.litres.toFixed(2)} L</Typography>
							<Typography variant="h6">Rs {fuelTotals.others.value.toFixed(2)}</Typography>
						</Grid>
					</Grid>
					<Divider sx={{ my: 2 }} />
					<Stack direction="row" justifyContent="space-between" alignItems="center">
						<Typography variant="h6">Total Sales</Typography>
						<Typography variant="h5">Rs {totals.value.toFixed(2)}</Typography>
					</Stack>
				</CardContent>
			</Card>

			{/* Reports Section */}
			<Card sx={{ mt: 3 }}>
				<CardContent>
					<Typography variant="h6" gutterBottom>Generate Reports</Typography>
					<Stack direction={{ xs: 'column', sm: 'row' }} gap={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
						<TextField select label="Report Period" value={reportMode} onChange={e => setReportMode(e.target.value as any)} size="small" sx={{ minWidth: 140 }}>
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
				</CardContent>
			</Card>

			{/* Success Message */}
			<Snackbar open={showSuccess} autoHideDuration={3000} onClose={() => setShowSuccess(false)}>
				<Alert onClose={() => setShowSuccess(false)} severity="success" sx={{ width: '100%' }}>
					Sales data for {date} saved successfully!
				</Alert>
			</Snackbar>
		</Box>
	)
} 