/// <reference types="vite/client" />

declare global {
	interface Window {
		api: {
			// Customer APIs
			listCustomers: () => Promise<Customer[]>
			createCustomer: (customer: Customer) => Promise<{ id: number }>
			updateCustomer: (customer: Customer) => Promise<void>
			searchCustomers: (query: string) => Promise<Customer[]>
			
			// Transaction APIs
			addTransaction: (transaction: Transaction) => Promise<{ id: number }>
			listTransactionsByCustomer: (customerId: number) => Promise<Transaction[]>
			deleteTransaction: (transactionId: number) => Promise<{ ok: boolean }>
			
			// Reports
			getCustomerSummary: (customerId: number) => Promise<{ total_credit: number; total_payment: number; total_due: number }>
			exportCustomerCsv: (customerId: number) => Promise<{ cancelled: boolean; filePath?: string }>
			exportAllSummaryCsv: (payload: { customerId: number; mode?: 'all'|'month'|'range'; month?: string; startDate?: string | null; endDate?: string | null } | number) => Promise<{ cancelled: boolean; filePath?: string }>
			exportCustomerPdf: (payload: { customerId: number; mode?: 'all'|'month'|'range'; month?: string; startDate?: string | null; endDate?: string | null } | number) => Promise<{ cancelled: boolean; filePath?: string }>
			
			// Sales
			listNozzles: () => Promise<Nozzle[]>
			updateNozzle: (nozzle: Nozzle) => Promise<void>
			listSalesByDate: (date: string) => Promise<any[]>
			saveSalesForDate: (payload: { date: string; entries: any[] }) => Promise<{ ok: boolean }>
			exportSalesCsv: (payload?: { mode?: 'all'|'month'|'range'; month?: string; startDate?: string | null; endDate?: string | null }) => Promise<{ cancelled: boolean; filePath?: string }>
			exportSalesPdf: (payload?: { mode?: 'all'|'month'|'range'; month?: string; startDate?: string | null; endDate?: string | null }) => Promise<{ cancelled: boolean; filePath?: string }>
			getLastReadings: (date: string) => Promise<Record<number, { closing: number; date: string; source: 'previous_day' | 'last_available' }>>
			
			// Expenses
			addExpense: (expense: { date: string; description: string; amount: number }) => Promise<{ ok: boolean; id: number }>
			listExpensesByDate: (date: string) => Promise<Expense[]>
			updateExpense: (expense: { id: number; date: string; description: string; amount: number }) => Promise<{ ok: boolean }>
			deleteExpense: (expenseId: number) => Promise<{ ok: boolean }>
			exportExpensesCsv: (payload?: { mode?: 'all'|'month'|'range'; month?: string; startDate?: string | null; endDate?: string | null }) => Promise<{ cancelled: boolean; filePath?: string }>
			exportExpensesPdf: (payload?: { mode?: 'all'|'month'|'range'; month?: string; startDate?: string | null; endDate?: string | null }) => Promise<{ cancelled: boolean; filePath?: string }>
			
			// Dashboard
			getDashboardMetrics: (payload?: { month?: string }) => Promise<DashboardMetrics>

			// Data Management
			dataManagementBackup: () => Promise<{
				success: boolean
				backupInfo?: {
					timestamp: string
					tables: string[]
					recordCounts: Record<string, number>
					totalSize: string
					filePath: string
				}
				filePath?: string
				error?: string
			}>
		}
	}
}

type Nozzle = { id: number; label: string; fuel_type: 'petrol'|'diesel'|'others'; price_per_litre: number }

type Customer = { id: number; name: string; phone: string; email: string; notes: string; created_at: string }

type Transaction = { id: number; customer_id: number; amount: number; type: 'credit' | 'payment'; date: string; note: string; created_at: string }

type Expense = { id: number; date: string; description: string; amount: number; created_at: string }

type DashboardMetrics = {
	month: string
	sales: {
		totalSales: number
		totalsByFuel: { petrol: number; diesel: number; others: number }
		dailySeries: Array<{ date: string; petrol: number; diesel: number; others: number; total: number }>
		dailyAverageByFuel: { petrol: number; diesel: number; others: number }
	}
	expenses: {
		total: number
		dailySeries: Array<{ date: string; amount: number }>
	}
	credits: {
		monthCredit: number
		monthPayment: number
		monthNet: number
		totalDue: number
	}
}

export {} 