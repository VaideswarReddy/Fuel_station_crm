const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
	listCustomers: () => ipcRenderer.invoke('customers:list'),
	createCustomer: (customer) => ipcRenderer.invoke('customers:create', customer),
	updateCustomer: (customer) => ipcRenderer.invoke('customers:update', customer),
	addTransaction: (transaction) => ipcRenderer.invoke('transactions:add', transaction),
	deleteTransaction: (transactionId) => ipcRenderer.invoke('transactions:delete', transactionId),
	listTransactionsByCustomer: (customerId) => ipcRenderer.invoke('transactions:listByCustomer', customerId),
	getCustomerSummary: (customerId) => ipcRenderer.invoke('reports:summaryByCustomer', customerId),
	searchCustomers: (q) => ipcRenderer.invoke('customers:search', q),
	exportCustomerCsv: (id) => ipcRenderer.invoke('reports:exportCustomerCsv', id),
	exportAllSummaryCsv: (payload) => ipcRenderer.invoke('reports:exportAllSummaryCsv', payload),
	// payload: { customerId, mode?: 'all'|'month'|'range', month?: 'YYYY-MM', startDate?: 'YYYY-MM-DD', endDate?: 'YYYY-MM-DD' } | number
	exportCustomerPdf: (payload) => ipcRenderer.invoke('reports:exportCustomerPdf', payload),
	
	// Sales
	listNozzles: () => ipcRenderer.invoke('nozzles:list'),
	updateNozzle: (nozzle) => ipcRenderer.invoke('nozzles:update', nozzle),
	listSalesByDate: (date) => ipcRenderer.invoke('sales:listByDate', date),
	saveSalesForDate: (payload) => ipcRenderer.invoke('sales:saveForDate', payload),
	exportSalesCsv: (payload) => ipcRenderer.invoke('reports:exportSalesCsv', payload),
	exportSalesPdf: (payload) => ipcRenderer.invoke('reports:exportSalesPdf', payload),
	getLastReadings: (date) => ipcRenderer.invoke('sales:getLastReadings', date),
	
	// Expenses
	addExpense: (expense) => ipcRenderer.invoke('expenses:add', expense),
	listExpensesByDate: (date) => ipcRenderer.invoke('expenses:listByDate', date),
	updateExpense: (expense) => ipcRenderer.invoke('expenses:update', expense),
	deleteExpense: (expenseId) => ipcRenderer.invoke('expenses:delete', expenseId),
	exportExpensesCsv: (payload) => ipcRenderer.invoke('reports:exportExpensesCsv', payload),
	exportExpensesPdf: (payload) => ipcRenderer.invoke('reports:exportExpensesPdf', payload),

	// Dashboard
	getDashboardMetrics: (payload) => ipcRenderer.invoke('dashboard:getMetrics', payload),

	// Data Management
	dataManagementBackup: () => ipcRenderer.invoke('dataManagementBackup'),
}) 