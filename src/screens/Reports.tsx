import React, { useState, useEffect } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Divider,
  Alert,
  Chip
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import dayjs, { Dayjs } from 'dayjs'

type ReportType = 'customer' | 'sales' | 'expenses'
type PeriodType = 'day' | 'month' | 'all-time' | 'custom-range'

interface ReportConfig {
  type: ReportType
  period: PeriodType
  date?: Dayjs | null
  month?: string
  startDate?: Dayjs | null
  endDate?: Dayjs | null
  customerId?: string
}

const Reports: React.FC = () => {
  const [reportConfig, setReportConfig] = useState<ReportConfig>({
    type: 'summary',
    period: 'monthly'
  })
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    loadCustomers()
  }, [])

  const loadCustomers = async () => {
    try {
      const result = await window.api.listCustomers()
      setCustomers(result)
    } catch (error) {
      console.error('Error loading customers:', error)
    }
  }

  const handleGenerateReport = async () => {
    setLoading(true)
    setMessage(null)

    try {
      let success = false

      switch (reportConfig.type) {
        case 'customer':
          if (reportConfig.customerId) {
            if (reportConfig.period === 'all-time') {
              await window.api.exportCustomerPdf(reportConfig.customerId, { period: 'all-time' })
              success = true
            } else if (reportConfig.period === 'month' && reportConfig.month) {
              await window.api.exportCustomerPdf(reportConfig.customerId, { period: 'monthly', month: reportConfig.month })
              success = true
            } else if (reportConfig.period === 'custom-range' && reportConfig.startDate && reportConfig.endDate) {
              await window.api.exportCustomerPdf(reportConfig.customerId, {
                period: 'date-range',
                startDate: reportConfig.startDate.format('YYYY-MM-DD'),
                endDate: reportConfig.endDate.format('YYYY-MM-DD')
              })
              success = true
            } else if (reportConfig.period === 'day' && reportConfig.date) {
              await window.api.exportCustomerPdf(reportConfig.customerId, {
                period: 'date-range',
                startDate: reportConfig.date.format('YYYY-MM-DD'),
                endDate: reportConfig.date.format('YYYY-MM-DD')
              })
              success = true
            }
          }
          break

        case 'sales':
          if (reportConfig.period === 'all-time') {
            await window.api.exportSalesPdf({ period: 'all-time' })
            success = true
          } else if (reportConfig.period === 'month' && reportConfig.month) {
            await window.api.exportSalesPdf({ period: 'monthly', month: reportConfig.month })
            success = true
          } else if (reportConfig.period === 'custom-range' && reportConfig.startDate && reportConfig.endDate) {
            await window.api.exportSalesPdf({
              period: 'date-range',
              startDate: reportConfig.startDate.format('YYYY-MM-DD'),
              endDate: reportConfig.endDate.format('YYYY-MM-DD')
            })
            success = true
          } else if (reportConfig.period === 'day' && reportConfig.date) {
            await window.api.exportSalesPdf({
              period: 'date-range',
              startDate: reportConfig.date.format('YYYY-MM-DD'),
              endDate: reportConfig.date.format('YYYY-MM-DD')
            })
            success = true
          }
          break

        case 'expenses':
          if (reportConfig.period === 'all-time') {
            await window.api.exportExpensesPdf({ period: 'all-time' })
            success = true
          } else if (reportConfig.period === 'month' && reportConfig.month) {
            await window.api.exportExpensesPdf({ period: 'monthly', month: reportConfig.month })
            success = true
          } else if (reportConfig.period === 'custom-range' && reportConfig.startDate && reportConfig.endDate) {
            await window.api.exportExpensesPdf({
              period: 'date-range',
              startDate: reportConfig.startDate.format('YYYY-MM-DD'),
              endDate: reportConfig.endDate.format('YYYY-MM-DD')
            })
            success = true
          } else if (reportConfig.period === 'day' && reportConfig.date) {
            await window.api.exportExpensesPdf({
              period: 'date-range',
              startDate: reportConfig.date.format('YYYY-MM-DD'),
              endDate: reportConfig.date.format('YYYY-MM-DD')
            })
            success = true
          }
          break
      }

      if (success) {
        setMessage({ type: 'success', text: 'Report generated successfully!' })
      } else {
        setMessage({ type: 'error', text: 'Please fill in all required fields for the selected report type and period.' })
      }
    } catch (error) {
      console.error('Error generating report:', error)
      setMessage({ type: 'error', text: `Error generating report: ${error}` })
    } finally {
      setLoading(false)
    }
  }

  const handleExportCsv = async () => {
    setLoading(true)
    setMessage(null)

    try {
      let success = false

      switch (reportConfig.type) {
        case 'customer':
          if (reportConfig.customerId) {
            if (reportConfig.period === 'all-time') {
              await window.api.exportCustomerCsv(reportConfig.customerId, { period: 'all-time' })
              success = true
            } else if (reportConfig.period === 'month' && reportConfig.month) {
              await window.api.exportCustomerCsv(reportConfig.customerId, { period: 'monthly', month: reportConfig.month })
              success = true
            } else if (reportConfig.period === 'custom-range' && reportConfig.startDate && reportConfig.endDate) {
              await window.api.exportCustomerCsv(reportConfig.customerId, {
                period: 'date-range',
                startDate: reportConfig.startDate.format('YYYY-MM-DD'),
                endDate: reportConfig.endDate.format('YYYY-MM-DD')
              })
              success = true
            } else if (reportConfig.period === 'day' && reportConfig.date) {
              await window.api.exportCustomerCsv(reportConfig.customerId, {
                period: 'date-range',
                startDate: reportConfig.date.format('YYYY-MM-DD'),
                endDate: reportConfig.date.format('YYYY-MM-DD')
              })
              success = true
            }
          }
          break

        case 'sales':
          if (reportConfig.period === 'all-time') {
            await window.api.exportSalesCsv({ period: 'all-time' })
            success = true
          } else if (reportConfig.period === 'month' && reportConfig.month) {
            await window.api.exportSalesCsv({ period: 'monthly', month: reportConfig.month })
            success = true
          } else if (reportConfig.period === 'custom-range' && reportConfig.startDate && reportConfig.endDate) {
            await window.api.exportSalesCsv({
              period: 'date-range',
              startDate: reportConfig.startDate.format('YYYY-MM-DD'),
              endDate: reportConfig.endDate.format('YYYY-MM-DD')
            })
            success = true
          } else if (reportConfig.period === 'day' && reportConfig.date) {
            await window.api.exportSalesCsv({
              period: 'date-range',
              startDate: reportConfig.date.format('YYYY-MM-DD'),
              endDate: reportConfig.date.format('YYYY-MM-DD')
            })
            success = true
          }
          break

        case 'expenses':
          if (reportConfig.period === 'all-time') {
            await window.api.exportExpensesCsv({ period: 'all-time' })
            success = true
          } else if (reportConfig.period === 'month' && reportConfig.month) {
            await window.api.exportExpensesCsv({ period: 'monthly', month: reportConfig.month })
            success = true
          } else if (reportConfig.period === 'custom-range' && reportConfig.startDate && reportConfig.endDate) {
            await window.api.exportExpensesCsv({
              period: 'date-range',
              startDate: reportConfig.startDate.format('YYYY-MM-DD'),
              endDate: reportConfig.endDate.format('YYYY-MM-DD')
            })
            success = true
          } else if (reportConfig.period === 'day' && reportConfig.date) {
            await window.api.exportExpensesCsv({
              period: 'date-range',
              startDate: reportConfig.date.format('YYYY-MM-DD'),
              endDate: reportConfig.date.format('YYYY-MM-DD')
            })
            success = true
          }
          break
      }

      if (success) {
        setMessage({ type: 'success', text: 'CSV report exported successfully!' })
      } else {
        setMessage({ type: 'error', text: 'Please fill in all required fields for the selected report type and period.' })
      }
    } catch (error) {
      console.error('Error exporting CSV:', error)
      setMessage({ type: 'error', text: `Error exporting CSV: ${error}` })
    } finally {
      setLoading(false)
    }
  }

  const isFormValid = () => {
    if (reportConfig.type === 'customer' && !reportConfig.customerId) return false
    
    if (reportConfig.period === 'month' && !reportConfig.month) return false
    if (reportConfig.period === 'custom-range' && (!reportConfig.startDate || !reportConfig.endDate)) return false
    if (reportConfig.period === 'day' && !reportConfig.date) return false
    
    return true
  }

  const getReportDescription = () => {
    const typeNames = {
      customer: 'Customer Credit & Payment',
      sales: 'Sales',
      expenses: 'Expenses'
    }

    const periodNames = {
      'all-time': 'All Time',
      'month': 'Monthly',
      'day': 'Daily',
      'custom-range': 'Custom Date Range'
    }

    return `${typeNames[reportConfig.type]} Report - ${periodNames[reportConfig.period]}`
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Reports Center
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Generate comprehensive reports for customers, sales, expenses, and summaries with flexible time periods.
        </Typography>

        {message && (
          <Alert severity={message.type} sx={{ mb: 3 }}>
            {message.text}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Report Configuration */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Report Configuration
                </Typography>
                
                <Stack spacing={3}>
                  {/* Report Type Selection */}
                  <FormControl fullWidth>
                    <InputLabel>Report Type</InputLabel>
                    <Select
                      value={reportConfig.type}
                      label="Report Type"
                      onChange={(e) => setReportConfig(prev => ({ ...prev, type: e.target.value as ReportType }))}
                    >
                      <MenuItem value="customer">Customer Credit & Payments</MenuItem>
                      <MenuItem value="sales">Sales Report</MenuItem>
                      <MenuItem value="expenses">Expenses Report</MenuItem>
                    </Select>
                  </FormControl>

                  {/* Customer Selection (only for customer reports) */}
                  {reportConfig.type === 'customer' && (
                    <FormControl fullWidth>
                      <InputLabel>Select Customer</InputLabel>
                      <Select
                        value={reportConfig.customerId || ''}
                        label="Select Customer"
                        onChange={(e) => setReportConfig(prev => ({ ...prev, customerId: e.target.value }))}
                      >
                        {customers.map((customer) => (
                          <MenuItem key={customer.id} value={customer.id}>
                            {customer.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}

                  {/* Period Selection */}
                  <FormControl fullWidth>
                    <InputLabel>Time Period</InputLabel>
                    <Select
                      value={reportConfig.period}
                      label="Time Period"
                      onChange={(e) => setReportConfig(prev => ({ ...prev, period: e.target.value as PeriodType }))}
                    >
                      <MenuItem value="day">Day</MenuItem>
                      <MenuItem value="month">Month</MenuItem>
                      <MenuItem value="all-time">All Time</MenuItem>
                      <MenuItem value="custom-range">Custom Date Range</MenuItem>
                    </Select>
                  </FormControl>

                  {/* Day Selection (for daily reports) */}
                  {reportConfig.period === 'day' && (
                    <DatePicker
                      label="Select Date"
                      value={reportConfig.date}
                      onChange={(date) => setReportConfig(prev => ({ ...prev, date: date }))}
                      slotProps={{ textField: { fullWidth: true } }}
                    />
                  )}

                  {/* Month Selection (for monthly reports) */}
                  {reportConfig.period === 'month' && (
                    <TextField
                      fullWidth
                      type="month"
                      label="Select Month"
                      value={reportConfig.month || ''}
                      onChange={(e) => setReportConfig(prev => ({ ...prev, month: e.target.value }))}
                      InputLabelProps={{ shrink: true }}
                    />
                  )}

                  {/* Date Range Selection (for custom date range) */}
                  {reportConfig.period === 'custom-range' && (
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <DatePicker
                          label="Start Date"
                          value={reportConfig.startDate}
                          onChange={(date) => setReportConfig(prev => ({ ...prev, startDate: date }))}
                          slotProps={{ textField: { fullWidth: true } }}
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <DatePicker
                          label="End Date"
                          value={reportConfig.endDate}
                          onChange={(date) => setReportConfig(prev => ({ ...prev, endDate: date }))}
                          slotProps={{ textField: { fullWidth: true } }}
                        />
                      </Grid>
                    </Grid>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Report Preview & Actions */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Report Preview
                </Typography>
                
                <Box sx={{ mb: 3 }}>
                  <Chip 
                    label={getReportDescription()} 
                    color="primary" 
                    variant="outlined"
                    sx={{ mb: 1 }}
                  />
                  
                  <Typography variant="body2" color="text.secondary">
                    {reportConfig.type === 'customer' && reportConfig.customerId && (
                      <>Customer: {customers.find(c => c.id === reportConfig.customerId)?.name}</>
                    )}
                    {reportConfig.period === 'day' && reportConfig.date && (
                      <>Date: {reportConfig.date.format('DD/MM/YYYY')}</>
                    )}
                    {reportConfig.period === 'month' && reportConfig.month && (
                      <>Month: {dayjs(reportConfig.month).format('MMMM YYYY')}</>
                    )}
                    {reportConfig.period === 'custom-range' && reportConfig.startDate && reportConfig.endDate && (
                      <>Range: {reportConfig.startDate.format('DD/MM/YYYY')} - {reportConfig.endDate.format('DD/MM/YYYY')}</>
                    )}
                    {reportConfig.period === 'all-time' && (
                      <>Period: All Available Data</>
                    )}
                  </Typography>
                </Box>

                <Stack spacing={2}>
                  <Button
                    variant="contained"
                    color="primary"
                    fullWidth
                    onClick={handleGenerateReport}
                    disabled={loading || !isFormValid()}
                  >
                    {loading ? 'Generating...' : 'Generate PDF Report'}
                  </Button>
                  
                  <Button
                    variant="outlined"
                    color="secondary"
                    fullWidth
                    onClick={handleExportCsv}
                    disabled={loading || !isFormValid()}
                  >
                    {loading ? 'Exporting...' : 'Export CSV Report'}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Report Types Information */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Report Types & Features
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid item xs={12} md={3}>
                    <Box sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                        Customer Reports
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        • Individual customer credit & payment history<br/>
                        • Opening/closing balance calculations<br/>
                        • Transaction details with dates<br/>
                        • Available in PDF format
                      </Typography>
                    </Box>
                  </Grid>
                  
                  <Grid item xs={12} md={3}>
                    <Box sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                        Sales Reports
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        • Daily sales by nozzle & fuel type<br/>
                        • Opening/closing stock readings<br/>
                        • Sales quantities & values<br/>
                        • Available in PDF & CSV
                      </Typography>
                    </Box>
                  </Grid>
                  
                  <Grid item xs={12} md={3}>
                    <Box sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                        Expense Reports
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        • Daily expense tracking<br/>
                        • Expense descriptions & amounts<br/>
                        • Categorized by date<br/>
                        • Available in PDF & CSV
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </LocalizationProvider>
  )
}

export default Reports 