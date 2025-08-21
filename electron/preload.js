import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
	listCustomers: () => ipcRenderer.invoke('customers:list'),
	createCustomer: (customer) => ipcRenderer.invoke('customers:create', customer),
	updateCustomer: (customer) => ipcRenderer.invoke('customers:update', customer),
	addTransaction: (tx) => ipcRenderer.invoke('transactions:add', tx),
	listTransactionsByCustomer: (customerId) => ipcRenderer.invoke('transactions:listByCustomer', customerId),
	getCustomerSummary: (customerId) => ipcRenderer.invoke('reports:summaryByCustomer', customerId)
}) 