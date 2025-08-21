import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import Database from 'better-sqlite3'
import { createWriteStream } from 'fs'
import { promises as fs } from 'fs'
import PDFDocument from 'pdfkit'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow = null

// App DB path within userData for persistence
const userDataPath = app.getPath('userData')
const dbPath = path.join(userDataPath, 'slnfs_crm.db')
const db = new Database(dbPath)

function migrate() {
	// customers
	db.prepare(`CREATE TABLE IF NOT EXISTS customers (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		phone TEXT,
		email TEXT,
		notes TEXT,
		created_at TEXT DEFAULT (datetime('now'))
	)` ).run()

	// transactions: type 'credit' or 'payment'
	db.prepare(`CREATE TABLE IF NOT EXISTS transactions (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		customer_id INTEGER NOT NULL,
		amount REAL NOT NULL,
		type TEXT CHECK(type IN ('credit','payment')) NOT NULL,
		date TEXT NOT NULL,
		note TEXT,
		created_at TEXT DEFAULT (datetime('now')),
		FOREIGN KEY(customer_id) REFERENCES customers(id)
	)` ).run()

	// simple index
	db.prepare(`CREATE INDEX IF NOT EXISTS idx_transactions_customer_date
	ON transactions(customer_id, date)` ).run()

	// Sales: nozzle configuration
	db.prepare(`CREATE TABLE IF NOT EXISTS nozzles (
		id INTEGER PRIMARY KEY,
		label TEXT NOT NULL,
		fuel_type TEXT CHECK(fuel_type IN ('petrol','diesel','others')) NOT NULL,
		price_per_litre REAL NOT NULL DEFAULT 0
	)` ).run()

	// Sales: daily readings per nozzle
	db.prepare(`CREATE TABLE IF NOT EXISTS sales_readings (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		date TEXT NOT NULL,
		nozzle_id INTEGER NOT NULL,
		opening REAL NOT NULL,
		closing REAL NOT NULL,
		sales_litres REAL NOT NULL,
		sales_value REAL NOT NULL,
		petrol_price REAL NOT NULL DEFAULT 0,
		diesel_price REAL NOT NULL DEFAULT 0,
		created_at TEXT DEFAULT (datetime('now')),
		UNIQUE(date, nozzle_id)
	)` ).run()

	// Expenses: daily expense tracking
	db.prepare(`CREATE TABLE IF NOT EXISTS expenses (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		date TEXT NOT NULL,
		description TEXT NOT NULL,
		amount REAL NOT NULL,
		created_at TEXT DEFAULT (datetime('now'))
	)` ).run()

	// Create index for expenses
	db.prepare(`CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date)` ).run()

	// Migrate expenses table if it has the old category column
	try {
		const oldSchema = db.prepare("PRAGMA table_info(expenses)").all()
		const hasCategory = oldSchema.some(col => col.name === 'category')
		
		if (hasCategory) {
			// Create new table with correct schema
			db.prepare(`CREATE TABLE expenses_new (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				date TEXT NOT NULL,
				description TEXT NOT NULL,
				amount REAL NOT NULL,
				created_at TEXT DEFAULT (datetime('now'))
			)` ).run()
			
			// Copy data (excluding category)
			db.prepare(`INSERT INTO expenses_new (id, date, description, amount, created_at) 
				SELECT id, date, description, amount, created_at FROM expenses` ).run()
			
			// Drop old table and rename new one
			db.prepare(`DROP TABLE expenses` ).run()
			db.prepare(`ALTER TABLE expenses_new RENAME TO expenses` ).run()
			
			// Recreate index
			db.prepare(`CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date)` ).run()
		}
	} catch (error) {
		// Table may not exist yet, which is fine
	}

	// Ensure petrol_price and diesel_price columns exist (for existing databases)
	try {
		db.prepare('ALTER TABLE sales_readings ADD COLUMN petrol_price REAL NOT NULL DEFAULT 0').run()
	} catch (e) {
		// Column already exists, ignore error
	}
	
	try {
		db.prepare('ALTER TABLE sales_readings ADD COLUMN diesel_price REAL NOT NULL DEFAULT 0').run()
	} catch (e) {
		// Column already exists, ignore error
	}

	// More robust migration: check if columns exist and recreate table if needed
	try {
		const schema = db.prepare("PRAGMA table_info(sales_readings)").all()
		const hasPetrolPrice = schema.some(col => col.name === 'petrol_price')
		const hasDieselPrice = schema.some(col => col.name === 'diesel_price')
		
		if (!hasPetrolPrice || !hasDieselPrice) {
			// Backup existing data if any
			const existingData = db.prepare('SELECT * FROM sales_readings').all()
			
			// Drop and recreate table
			db.prepare('DROP TABLE IF EXISTS sales_readings').run()
			db.prepare(`CREATE TABLE sales_readings (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				date TEXT NOT NULL,
				nozzle_id INTEGER NOT NULL,
				opening REAL NOT NULL,
				closing REAL NOT NULL,
				sales_litres REAL NOT NULL,
				sales_value REAL NOT NULL,
				petrol_price REAL NOT NULL DEFAULT 0,
				diesel_price REAL NOT NULL DEFAULT 0,
				created_at TEXT DEFAULT (datetime('now')),
				UNIQUE(date, nozzle_id)
			)`).run()
			
			// Recreate index
			db.prepare(`CREATE INDEX idx_sales_readings_date ON sales_readings(date)`).run()
		}
		
		// Test the table structure with a test insert/delete
		try {
			const testData = {
				date: '2000-01-01',
				nozzle_id: 1,
				opening: 0,
				closing: 0,
				sales_litres: 0,
				sales_value: 0,
				petrol_price: 0,
				diesel_price: 0
			}
			
			const testInsert = db.prepare(`INSERT INTO sales_readings (date, nozzle_id, opening, closing, sales_litres, sales_value, petrol_price, diesel_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
			testInsert.run(testData.date, testData.nozzle_id, testData.opening, testData.closing, testData.sales_litres, testData.sales_value, testData.petrol_price, testData.diesel_price)
			
			// Clean up test data
			db.prepare('DELETE FROM sales_readings WHERE date = ?').run(testData.date)
		} catch (e) {
			console.error('Table structure test failed:', e)
			throw new Error(`Database table structure is invalid: ${e.message}`)
		}
	} catch (e) {
		// Handle migration errors
	}



	// Index for sales
	db.prepare(`CREATE INDEX IF NOT EXISTS idx_sales_readings_date ON sales_readings(date)` ).run()
	
	// Migrate nozzles table if it has the old fuel_type constraint
	try {
		const nozzleSchema = db.prepare("PRAGMA table_info(nozzles)").all()
		const hasNozzlesTable = nozzleSchema.length > 0
		
		if (hasNozzlesTable) {
			// Check if we need to migrate the fuel_type constraint
			try {
				const existingNozzles = db.prepare('SELECT * FROM nozzles').all()
				const hasOthersNozzle = existingNozzles.some(n => n.fuel_type === 'others')
				
				if (!hasOthersNozzle) {
					// Create new table with updated constraint
					db.prepare(`CREATE TABLE nozzles_new (
						id INTEGER PRIMARY KEY,
						label TEXT NOT NULL,
						fuel_type TEXT CHECK(fuel_type IN ('petrol','diesel','others')) NOT NULL,
						price_per_litre REAL NOT NULL DEFAULT 0
					)` ).run()
					
					// Copy existing data
					db.prepare(`INSERT INTO nozzles_new (id, label, fuel_type, price_per_litre) 
						SELECT id, label, fuel_type, price_per_litre FROM nozzles` ).run()
					
					// Drop old table and rename new one
					db.prepare(`DROP TABLE nozzles` ).run()
					db.prepare(`ALTER TABLE nozzles_new RENAME TO nozzles` ).run()
				}
			} catch (migrationError) {
				// Backup existing data
				const existingNozzles = db.prepare('SELECT * FROM nozzles').all()
				
				// Drop and recreate table
				db.prepare('DROP TABLE IF EXISTS nozzles').run()
				db.prepare(`CREATE TABLE nozzles (
					id INTEGER PRIMARY KEY,
					label TEXT NOT NULL,
					fuel_type TEXT CHECK(fuel_type IN ('petrol','diesel','others')) NOT NULL,
					price_per_litre REAL NOT NULL DEFAULT 0
				)` ).run()
				
				// Restore data (excluding any invalid fuel types)
				const insert = db.prepare('INSERT INTO nozzles (id, label, fuel_type, price_per_litre) VALUES (@id, @label, @fuel_type, @price_per_litre)')
				existingNozzles.forEach(n => {
					if (n.fuel_type === 'petrol' || n.fuel_type === 'diesel') {
						insert.run(n)
					}
				})
			}
		}
	} catch (error) {
		// Table may not exist yet, which is fine
	}
	
	// Seed default nozzles if empty
	const nozzleCount = db.prepare('SELECT COUNT(1) AS c FROM nozzles').get().c
	if (nozzleCount === 0) {
		const insert = db.prepare('INSERT INTO nozzles (id, label, fuel_type, price_per_litre) VALUES (@id, @label, @fuel_type, @price_per_litre)')
		const defaults = [
			{ id: 1, label: 'Nozzle 1', fuel_type: 'petrol', price_per_litre: 0 },
			{ id: 2, label: 'Nozzle 2', fuel_type: 'petrol', price_per_litre: 0 },
			{ id: 3, label: 'Nozzle 3', fuel_type: 'petrol', price_per_litre: 0 },
			{ id: 4, label: 'Nozzle 4', fuel_type: 'diesel', price_per_litre: 0 },
			{ id: 5, label: 'Nozzle 5', fuel_type: 'diesel', price_per_litre: 0 },
			{ id: 6, label: 'Nozzle 6', fuel_type: 'diesel', price_per_litre: 0 },
			{ id: 7, label: 'Nozzle 7', fuel_type: 'diesel', price_per_litre: 0 },
			{ id: 8, label: 'Others', fuel_type: 'others', price_per_litre: 0 }
		]
		const tx = db.transaction((rows) => rows.forEach(r => insert.run(r)))
		tx(defaults)
	}

	// Create tables if they don't exist
	db.prepare(`CREATE TABLE IF NOT EXISTS expenses (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		date TEXT NOT NULL,
		description TEXT NOT NULL,
		amount REAL NOT NULL,
		created_at TEXT DEFAULT (datetime('now'))
	)`).run()
}

function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1200,
		height: 800,
		title: 'SLNFS CRM',
		webPreferences: {
			contextIsolation: true,
			nodeIntegration: false,
			preload: path.join(__dirname, 'preload.cjs')
		}
	})

	if (process.env.NODE_ENV === 'development') {
		mainWindow.loadURL('http://localhost:5173')
		// Developer tools can be opened manually with Cmd+Option+I (Mac) or Ctrl+Shift+I (Windows/Linux)
	} else {
		mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
	}
}

app.whenReady().then(() => {
	migrate()
	createWindow()

	app.on('activate', function () {
		if (BrowserWindow.getAllWindows().length === 0) createWindow()
	})
})

app.on('window-all-closed', function () {
	if (process.platform !== 'darwin') app.quit()
})

// IPC Handlers

ipcMain.handle('customers:list', () => {
	return db.prepare('SELECT * FROM customers ORDER BY name').all()
})

ipcMain.handle('customers:create', (_e, customer) => {
	// Ensure all required fields are present with defaults for optional fields
	const customerData = {
		name: customer.name || '',
		phone: customer.phone || '',
		email: customer.email || '',
		notes: customer.notes || ''
	}
	
	const stmt = db.prepare(`INSERT INTO customers (name, phone, email, notes) VALUES (@name, @phone, @email, @notes)`) 
	const result = stmt.run(customerData)
	return { id: result.lastInsertRowid }
})

ipcMain.handle('customers:update', (_e, customer) => {
	// Ensure all required fields are present with defaults for optional fields
	const customerData = {
		id: customer.id,
		name: customer.name || '',
		phone: customer.phone || '',
		email: customer.email || '',
		notes: customer.notes || ''
	}
	
	const stmt = db.prepare(`UPDATE customers SET name=@name, phone=@phone, email=@email, notes=@notes WHERE id=@id`)
	stmt.run(customerData)
	return { ok: true }
})

ipcMain.handle('customers:search', (_e, q) => {
	const query = (q || '').trim()
	if (!query) {
		return db.prepare('SELECT * FROM customers ORDER BY name').all()
	}
	const like = `%${query}%`
	return db.prepare(`
		SELECT * FROM customers
		WHERE name LIKE ? OR phone LIKE ? OR email LIKE ?
		ORDER BY name
	`).all(like, like, like)
})

ipcMain.handle('transactions:add', (_e, t) => {
	const stmt = db.prepare(`INSERT INTO transactions (customer_id, amount, type, date, note) VALUES (@customer_id, @amount, @type, @date, @note)`) 
	const result = stmt.run(t)
	return { id: result.lastInsertRowid }
})

ipcMain.handle('transactions:delete', (_e, transactionId) => {
	// Delete the transaction
	db.prepare('DELETE FROM transactions WHERE id = ?').run(transactionId)
	return { ok: true }
})

ipcMain.handle('transactions:listByCustomer', (_e, customerId) => {
	return db.prepare('SELECT * FROM transactions WHERE customer_id = ? ORDER BY date DESC, id DESC').all(customerId)
})

ipcMain.handle('reports:summaryByCustomer', (_e, customerId) => {
	const row = db.prepare(`
		SELECT 
			SUM(CASE WHEN type='credit' THEN amount ELSE 0 END) as total_credit,
			SUM(CASE WHEN type='payment' THEN amount ELSE 0 END) as total_payment,
			SUM(CASE WHEN type='credit' THEN amount ELSE -amount END) as total_due
		FROM transactions
		WHERE customer_id = ?
	`).get(customerId)
	return row || { total_credit: 0, total_payment: 0, total_due: 0 }
})

ipcMain.handle('reports:exportCustomerCsv', async (_e, customerId) => {
	const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId)
	if (!customer) return { cancelled: true }
	const txs = db.prepare('SELECT * FROM transactions WHERE customer_id = ? ORDER BY date ASC, id ASC').all(customerId)
	const sum = db.prepare(`
		SELECT 
			SUM(CASE WHEN type='credit' THEN amount ELSE 0 END) as total_credit,
			SUM(CASE WHEN type='payment' THEN amount ELSE 0 END) as total_payment,
			SUM(CASE WHEN type='credit' THEN amount ELSE -amount END) as total_due
		FROM transactions WHERE customer_id = ?
	`).get(customerId) || { total_credit: 0, total_payment: 0, total_due: 0 }

	const safeName = String(customer.name || '').replace(/\W+/g, '_') || `customer_${customerId}`
	const { filePath, canceled } = await dialog.showSaveDialog({
		title: 'Save Customer Report',
		defaultPath: `Customer_${safeName}_report.csv`,
		filters: [{ name: 'CSV', extensions: ['csv'] }]
	})
	if (canceled || !filePath) return { cancelled: true }

	const esc = (v) => (`"${String(v ?? '').replace(/"/g, '""')}"`)
	const lines = []
	// Heading and subtitle
	lines.push('Sri Lakshmi Narayana Filling station')
	lines.push('Customer Credit Report')
	lines.push(`Generated: ${new Date().toLocaleString()}`)
	lines.push('')
	lines.push('Customer Name,Phone,Email,Notes')
	lines.push([esc(customer.name), esc(customer.phone), esc(customer.email), esc(customer.notes)].join(','))
	lines.push('')
	lines.push('Type,Date,Amount,Note')
	for (const t of txs) {
		lines.push([t.type, t.date, t.amount, esc(t.note)].join(','))
	}
	lines.push('')
	lines.push('Total Credit,Total Payment,Total Due')
	lines.push([sum.total_credit || 0, sum.total_payment || 0, sum.total_due || 0].join(','))

	await fs.writeFile(filePath, lines.join('\n'), 'utf8')
	return { cancelled: false, filePath }
})

ipcMain.handle('reports:exportAllSummaryCsv', async (_e, payload) => {
	let mode = 'all'
	let startDate = null
	let endDate = null
	let month = null
	if (typeof payload === 'object' && payload !== null) {
		mode = payload.mode || 'all'
		month = payload.month || null
		startDate = payload.startDate || null
		endDate = payload.endDate || null
	}
	if (mode === 'month' && month) {
		const [y, m] = String(month).split('-').map(Number)
		if (y && m) {
			const mm = String(m).padStart(2, '0')
			startDate = `${y}-${mm}-01`
			const nextMonth = m === 12 ? 1 : m + 1
			const nextMonthYear = m === 12 ? y + 1 : y
			const nm = String(nextMonth).padStart(2, '0')
			const nextMonthStart = `${nextMonthYear}-${nm}-01`
			const endRow = db.prepare("SELECT date(?, '-1 day') as end").get(nextMonthStart)
			endDate = endRow.end
		}
	}

	const periodLabel = (mode === 'month' && month)
		? `Period: ${month}`
		: (startDate || endDate)
			? `Period: ${startDate || '—'} to ${endDate || '—'}`
			: 'Period: All Time'

	// Aggregate per customer with opening balance and period totals
	const rows = db.prepare(`
		SELECT 
			c.id, c.name, c.phone, c.email,
			CASE WHEN ? IS NULL THEN 0 ELSE (
				SELECT COALESCE(SUM(CASE WHEN t2.type='credit' THEN t2.amount ELSE -t2.amount END),0)
				FROM transactions t2 WHERE t2.customer_id = c.id AND t2.date < ?
			) END AS opening_balance,
			COALESCE(SUM(CASE WHEN t.type='credit' AND (? IS NULL OR t.date >= ?) AND (? IS NULL OR t.date <= ?) THEN t.amount END), 0) AS total_credit,
			COALESCE(SUM(CASE WHEN t.type='payment' AND (? IS NULL OR t.date >= ?) AND (? IS NULL OR t.date <= ?) THEN t.amount END), 0) AS total_payment
		FROM customers c
		LEFT JOIN transactions t ON t.customer_id = c.id
		GROUP BY c.id
		ORDER BY c.name
	`).all(
		startDate, startDate,
		startDate, startDate, endDate, endDate,
		startDate, startDate, endDate, endDate
	)

	const { filePath, canceled } = await dialog.showSaveDialog({
		title: 'Save Customers Summary',
		defaultPath: 'Customers_Summary.csv',
		filters: [{ name: 'CSV', extensions: ['csv'] }]
	})
	if (canceled || !filePath) return { cancelled: true }

	const esc = (v) => (`"${String(v ?? '').replace(/"/g, '""')}"`)
	const lines = []
	// Heading and subtitle
	lines.push('Sri Lakshmi Narayana Filling station')
	lines.push('Customers Summary Report')
	lines.push(periodLabel)
	lines.push(`Generated: ${new Date().toLocaleString()}`)
	lines.push('')
	lines.push('Customer ID,Name,Phone,Email,Opening,Billing Period Credit,Billing Period Payment,Closing')
	for (const r of rows) {
		const closing = (r.opening_balance || 0) + ((r.total_credit || 0) - (r.total_payment || 0))
		lines.push([
			r.id,
			esc(r.name), esc(r.phone), esc(r.email),
			(r.opening_balance || 0), (r.total_credit || 0), (r.total_payment || 0), closing
		].join(','))
	}
	await fs.writeFile(filePath, lines.join('\n'), 'utf8')
	return { cancelled: false, filePath }
})

ipcMain.handle('reports:exportCustomerPdf', async (_e, payload) => {
	// Payload can be: number | { customerId, mode?: 'all'|'month'|'range', month?: string, startDate?: string|null, endDate?: string|null }
	let customerId
	let mode = 'all'
	let startDate = null
	let endDate = null
	let month = null
	if (typeof payload === 'object' && payload !== null) {
		customerId = Number(payload.customerId)
		mode = payload.mode || 'all'
		month = payload.month || null
		startDate = payload.startDate || null
		endDate = payload.endDate || null
	} else {
		customerId = Number(payload)
	}

	const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId)
	if (!customer) return { cancelled: true }

	// Derive dates by mode
	if (mode === 'month' && month) {
		// month format expected: YYYY-MM
		const [y, m] = String(month).split('-').map(Number)
		if (y && m) {
			const mm = String(m).padStart(2, '0')
			startDate = `${y}-${mm}-01`
			// compute end of month: next month minus one day
			const nextMonth = m === 12 ? 1 : m + 1
			const nextMonthYear = m === 12 ? y + 1 : y
			const nm = String(nextMonth).padStart(2, '0')
			const nextMonthStart = `${nextMonthYear}-${nm}-01`
			// SQLite date arithmetic: date(nextMonthStart, '-1 day')
			const endRow = db.prepare("SELECT date(?, '-1 day') as end").get(nextMonthStart)
			endDate = endRow.end
		}
	}
	// If mode is all, keep dates null

	// Build date range clause for period
	const whereParts = ['customer_id = ?']
	const params = [customerId]
	if (startDate) { whereParts.push('date >= ?'); params.push(startDate) }
	if (endDate) { whereParts.push('date <= ?'); params.push(endDate) }
	const whereClause = whereParts.join(' AND ')

	const txs = db.prepare(`SELECT * FROM transactions WHERE ${whereClause} ORDER BY date ASC, id ASC`).all(...params)
	const periodTotals = db.prepare(`
		SELECT 
			SUM(CASE WHEN type='credit' THEN amount ELSE 0 END) as total_credit,
			SUM(CASE WHEN type='payment' THEN amount ELSE 0 END) as total_payment
		FROM transactions WHERE ${whereClause}
	`).get(...params) || { total_credit: 0, total_payment: 0 }

	// Opening balance: sum(credits - payments) strictly before startDate
	let openingBalance = 0
	if (startDate) {
		const openRow = db.prepare(`
			SELECT COALESCE(SUM(CASE WHEN type='credit' THEN amount ELSE -amount END), 0) AS opening
			FROM transactions WHERE customer_id = ? AND date < ?
		`).get(customerId, startDate)
		openingBalance = openRow?.opening || 0
	}
	// Closing balance = opening + (credits in period - payments in period)
	const netInPeriod = (periodTotals.total_credit || 0) - (periodTotals.total_payment || 0)
	const closingBalance = openingBalance + netInPeriod

	const periodLabel = (mode === 'month' && month)
		? `Period: ${month}`
		: (startDate || endDate)
			? `Period: ${startDate || '—'} to ${endDate || '—'}`
			: 'Period: All Time'

	const safeName = String(customer.name || '').replace(/\W+/g, '_') || `customer_${customerId}`
	const { filePath, canceled } = await dialog.showSaveDialog({
		title: 'Save Customer PDF Report',
		defaultPath: `Customer_${safeName}_report.pdf`,
		filters: [{ name: 'PDF', extensions: ['pdf'] }]
	})
	if (canceled || !filePath) return { cancelled: true }

	const doc = new PDFDocument({ margin: 30 }) // Reduced from 50 to 30
	const stream = createWriteStream(filePath)
	doc.pipe(stream)

	function currency(v) { return `Rs ${Number(v || 0).toFixed(2)}` }

	function drawPageHeader() {
		doc.fontSize(18).fillColor('#111').font('Helvetica-Bold').text('Sri Lakshmi Narayana Filling station', { align: 'center' }) // Reduced from 20 to 18
		doc.moveDown(0.15) // Reduced from 0.2 to 0.15
		doc.fontSize(14).font('Helvetica').text('Customer Credit Report', { align: 'center' }) // Reduced from 16 to 14
		doc.moveDown(0.2) // Reduced from 0.25 to 0.2
		doc.fontSize(9).fillColor('#666').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' }) // Reduced from 10 to 9
		doc.text(periodLabel, { align: 'center' })
		doc.moveDown(0.6) // Reduced from 0.8 to 0.6
		doc.fillColor('#000')
		const lineY = doc.y
		doc.moveTo(doc.page.margins.left, lineY).lineTo(doc.page.width - doc.page.margins.right, lineY).strokeColor('#ddd').stroke()
		doc.moveDown(0.4) // Reduced from 0.6 to 0.4
	}

	doc.on('pageAdded', () => {
		drawPageHeader()
	})

	drawPageHeader()

	// Customer details
	doc.fontSize(10) // Reduced from 12 to 10
	doc.text(`Name: ${customer.name}`)
	if (customer.phone) doc.text(`Phone: ${customer.phone}`)
	if (customer.email) doc.text(`Email: ${customer.email}`)
	if (customer.notes) doc.text(`Notes: ${customer.notes}`)
	doc.moveDown(0.6) // Reduced from 1 to 0.6

	// Summary with opening and closing
	doc.fontSize(10).text(`Opening Balance: ${currency(openingBalance)}`) // Reduced from 12 to 10
	doc.text(`Credits in Period: ${currency(periodTotals.total_credit)}`)
	doc.text(`Payments in Period: ${currency(periodTotals.total_payment)}`)
	doc.text(`Closing Balance: ${currency(closingBalance)}`)
	doc.moveDown(0.6) // Reduced from 1 to 0.6

	// Transactions table
	doc.fontSize(12).text('Transactions', { underline: true }) // Reduced from 14 to 12
	doc.moveDown(0.3) // Reduced from 0.5 to 0.3

	const pageWidth = doc.page.width
	const contentLeft = doc.page.margins.left
	const contentRight = pageWidth - doc.page.margins.right
	const contentWidth = contentRight - contentLeft

	const colWidths = [80, 110, 110, contentWidth - (80 + 110 + 110)]
	const headers = ['Type', 'Date', 'Amount', 'Note']
	const rowHeight = 16 // Reduced from 24 to 16
	const headerFill = '#f0f0f0'
	const zebraFill = '#fafafa'

	function ensurePageSpace() {
		if (doc.y + rowHeight + 5 > doc.page.height - doc.page.margins.bottom) { // Reduced from 10 to 5
			doc.addPage()
		}
	}
	function drawTableHeader() {
		ensurePageSpace()
		let x = contentLeft
		const y = doc.y
		doc.save()
		doc.fillColor('#000').fontSize(9).font('Helvetica-Bold') // Reduced from 11 to 9
		for (let i = 0; i < headers.length; i++) {
			doc.rect(x, y, colWidths[i], rowHeight).fillAndStroke(headerFill, '#e0e0e0')
			doc.fillColor('#000')
			doc.text(headers[i], x + 4, y + 4, { width: colWidths[i] - 8, height: rowHeight - 8 }) // Reduced padding from 6,7,12 to 4,4,8
			x += colWidths[i]
		}
		doc.restore()
		doc.y = y + rowHeight
	}
	function drawTableRow(values, rowIndex) {
		ensurePageSpace()
		let x = contentLeft
		const y = doc.y
		const isEven = rowIndex % 2 === 0
		if (isEven) {
			doc.save()
			doc.rect(x, y, contentWidth, rowHeight).fill(zebraFill)
			doc.restore()
		}
		doc.save()
		doc.fontSize(9).font('Helvetica') // Reduced from 11 to 9
		for (let i = 0; i < values.length; i++) {
			const cellText = String(values[i] ?? '')
			doc.fillColor('#000').text(cellText, x + 4, y + 3, { width: colWidths[i] - 8, height: rowHeight - 6 }) // Reduced padding from 6,6,12 to 4,3,8
			doc.moveTo(x + colWidths[i], y).lineTo(x + colWidths[i], y + rowHeight).strokeColor('#eee').stroke()
			x += colWidths[i]
		}
		doc.restore()
		doc.moveTo(contentLeft, y + rowHeight).lineTo(contentRight, y + rowHeight).strokeColor('#eee').stroke()
		doc.y = y + rowHeight
	}

	drawTableHeader()
	let index = 0
	for (const t of txs) {
		drawTableRow([
			t.type === 'credit' ? 'Credit' : 'Payment',
			t.date,
			currency(t.amount),
			t.note || ''
		], index++)
	}

	doc.end()

	await new Promise((resolve, reject) => {
		stream.on('finish', resolve)
		stream.on('error', reject)
	})

	return { cancelled: false, filePath }
}) 

// Sales management
ipcMain.handle('nozzles:list', () => {
	return db.prepare('SELECT * FROM nozzles ORDER BY id').all()
})

ipcMain.handle('nozzles:update', (_e, nozzle) => {
	const stmt = db.prepare('UPDATE nozzles SET label=@label, fuel_type=@fuel_type, price_per_litre=@price_per_litre WHERE id=@id')
	stmt.run(nozzle)
	return { ok: true }
})

ipcMain.handle('sales:listByDate', (_e, date) => {
	const readings = db.prepare('SELECT * FROM sales_readings WHERE date = ? ORDER BY nozzle_id').all(date)
	return readings
})

ipcMain.handle('sales:getLastReadings', (_e, currentDate) => {
	// First try to get the previous day's closing reading for each nozzle
	const previousDay = new Date(currentDate)
	previousDay.setDate(previousDay.getDate() - 1)
	const previousDateStr = previousDay.toISOString().split('T')[0]
	
	const previousDayReadings = db.prepare(`
		SELECT nozzle_id, closing, date
		FROM sales_readings 
		WHERE date = ? 
		ORDER BY nozzle_id
	`).all(previousDateStr)
	
	// If no previous day data, get the last available closing reading that's BEFORE the selected date
	const lastAvailableReadings = db.prepare(`
		SELECT sr.nozzle_id, sr.closing, sr.date
		FROM sales_readings sr
		INNER JOIN (
			SELECT nozzle_id, MAX(date) as max_date
			FROM sales_readings
			WHERE date < ?
			GROUP BY nozzle_id
		) latest ON sr.nozzle_id = latest.nozzle_id AND sr.date = latest.max_date
		WHERE sr.date < ?
		ORDER BY sr.nozzle_id
	`).all(currentDate, currentDate)
	
	// Convert to a map - only use previous day readings
	// If no previous day data exists, leave opening empty
	const result = {}
	
	// Only add previous day readings
	previousDayReadings.forEach(r => {
		result[r.nozzle_id] = { closing: r.closing, date: r.date, source: 'previous_day' }
	})
	
	// If no previous day data, add the last available reading that's before the selected date
	lastAvailableReadings.forEach(r => {
		if (!result[r.nozzle_id]) {
			result[r.nozzle_id] = { closing: r.closing, date: r.date, source: 'last_available' }
		}
	})
	
	return result
})

ipcMain.handle('sales:saveForDate', (_e, payload) => {
	const { date, entries } = payload
	const getNozzle = db.prepare('SELECT * FROM nozzles WHERE id = ?')
	
	// Check if the required columns exist before proceeding
	try {
		const schema = db.prepare("PRAGMA table_info(sales_readings)").all()
		
		const hasPetrolPrice = schema.some(col => col.name === 'petrol_price')
		const hasDieselPrice = schema.some(col => col.name === 'diesel_price')
		
		if (!hasPetrolPrice || !hasDieselPrice) {
			console.error('Missing required columns! petrol_price:', hasPetrolPrice, 'diesel_price:', hasDieselPrice)
			throw new Error(`Database is missing required columns. Please click 'Debug Schema' button first. Missing: ${!hasPetrolPrice ? 'petrol_price ' : ''}${!hasDieselPrice ? 'diesel_price' : ''}`)
		}
	} catch (schemaError) {
		console.error('Error checking schema:', schemaError)
		throw new Error(`Cannot check database schema: ${schemaError.message}`)
	}
	
	// Get individual nozzle prices - we'll use the price_per_litre from each nozzle
	const upsert = db.prepare(`REPLACE INTO sales_readings (date, nozzle_id, opening, closing, sales_litres, sales_value, petrol_price, diesel_price)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
	
	const tx = db.transaction((rows) => {
		for (const r of rows) {
			const nozzle = getNozzle.get(r.nozzle_id)
			if (!nozzle) {
				continue
			}
			const litres = Number(r.closing) - Number(r.opening)
			
			// Use provided prices if available (for edited historical data), otherwise use nozzle prices
			let price = 0
			let nozzlePetrolPrice = 0
			let nozzleDieselPrice = 0
			
			if (r.petrol_price !== undefined || r.diesel_price !== undefined) {
				// Use provided prices (edited historical data)
				nozzlePetrolPrice = r.petrol_price || 0
				nozzleDieselPrice = r.diesel_price || 0
				
				// Calculate price based on fuel type
				if (nozzle.fuel_type === 'petrol' || nozzle.fuel_type === 'others') {
					price = nozzlePetrolPrice
				} else if (nozzle.fuel_type === 'diesel') {
					price = nozzleDieselPrice
				}
			} else {
				// Use nozzle prices (normal mode)
				price = nozzle.price_per_litre || 0
				
				// Store the individual nozzle prices that were used for this calculation
				if (nozzle.fuel_type === 'petrol') {
					nozzlePetrolPrice = nozzle.price_per_litre || 0
				} else if (nozzle.fuel_type === 'diesel') {
					nozzleDieselPrice = nozzle.price_per_litre || 0
				} else if (nozzle.fuel_type === 'others') {
					// For "others" fuel type, store the price in petrol_price column for simplicity
					// This allows the "others" nozzle to work while maintaining database compatibility
					nozzlePetrolPrice = nozzle.price_per_litre || 0
				}
			}
			
			const value = litres * price
			
			upsert.run(
				date,
				r.nozzle_id,
				Number(r.opening),
				Number(r.closing),
				litres,
				value,
				nozzlePetrolPrice,
				nozzleDieselPrice
			)
		}
	})
	
	tx(entries)
	return { ok: true }
}) 

// Sales reports
ipcMain.handle('reports:exportSalesCsv', async (_e, payload) => {
	let mode = 'all'
	let startDate = null
	let endDate = null
	let month = null
	if (typeof payload === 'object' && payload !== null) {
		mode = payload.mode || 'all'
		month = payload.month || null
		startDate = payload.startDate || null
		endDate = payload.endDate || null
	}
	if (mode === 'month' && month) {
		const [y, m] = String(month).split('-').map(Number)
		if (y && m) {
			const mm = String(m).padStart(2, '0')
			startDate = `${y}-${mm}-01`
			const nextMonth = m === 12 ? 1 : m + 1
			const nextMonthYear = m === 12 ? y + 1 : y
			const nm = String(nextMonth).padStart(2, '0')
			const nextMonthStart = `${nextMonthYear}-${nm}-01`
			const endRow = db.prepare("SELECT date(?, '-1 day') as end").get(nextMonthStart)
			endDate = endRow.end
		}
	}

	const periodLabel = (mode === 'month' && month)
		? `Period: ${month}`
		: (startDate || endDate)
			? `Period: ${startDate || '—'} to ${endDate || '—'}`
			: 'Period: All Time'

	// Build date range clause
	const whereParts = []
	const params = []
	if (startDate) { whereParts.push('date >= ?'); params.push(startDate) }
	if (endDate) { whereParts.push('date <= ?'); params.push(endDate) }
	const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : ''

	const rows = db.prepare(`
		SELECT 
			sr.date, n.label, n.fuel_type, 
			sr.opening, sr.closing, sr.sales_litres, sr.sales_value,
			CASE 
				WHEN n.fuel_type = 'petrol' THEN sr.petrol_price 
				WHEN n.fuel_type = 'diesel' THEN sr.diesel_price 
				WHEN n.fuel_type = 'others' THEN sr.petrol_price 
				ELSE 0 
			END as unit_price
		FROM sales_readings sr
		JOIN nozzles n ON n.id = sr.nozzle_id
		${whereClause}
		ORDER BY sr.date DESC, n.label ASC
	`).all(...params)

	const { filePath, canceled } = await dialog.showSaveDialog({
		title: 'Save Sales Report',
		defaultPath: 'Sales_Report.csv',
		filters: [{ name: 'CSV', extensions: ['csv'] }]
	})
	if (canceled || !filePath) return { cancelled: true }

	const esc = (v) => (`"${String(v ?? '').replace(/"/g, '""')}"`)
	const lines = []
	lines.push('Sri Lakshmi Narayana Filling station')
	lines.push('Sales Report')
	lines.push(periodLabel)
	lines.push(`Generated: ${new Date().toLocaleString()}`)
	lines.push('')
	
	// Add summary section with fuel type totals and overall total
	const fuelTotals = db.prepare(`
		SELECT 
			n.fuel_type,
			SUM(sr.sales_litres) as total_litres,
			SUM(sr.sales_value) as total_value
		FROM sales_readings sr
		JOIN nozzles n ON n.id = sr.nozzle_id
		${whereClause}
		GROUP BY n.fuel_type
		ORDER BY n.fuel_type
	`).all(...params)
	
	const totalSalesValue = rows.reduce((sum, r) => sum + (r.sales_value || 0), 0)
	
	lines.push('Summary:')
	lines.push('Fuel Type,Total Litres,Total Value (Rs)')
	for (const ft of fuelTotals) {
		lines.push(`${ft.fuel_type.toUpperCase()},${ft.total_litres?.toFixed(2) || '0.00'},${ft.total_value?.toFixed(2) || '0.00'}`)
	}
	lines.push(`TOTAL,${fuelTotals.reduce((sum, ft) => sum + (ft.total_litres || 0), 0).toFixed(2)},${totalSalesValue.toFixed(2)}`)
	lines.push('')
	lines.push('Date,Label,Fuel Type,Opening (L),Closing (L),Sales (L),Sales Value (Rs),Unit Price (Rs/L)')
	
	for (const r of rows) {
		lines.push([
			r.date, esc(r.label), r.fuel_type.toUpperCase(),
			r.opening, r.closing, r.sales_litres, r.sales_value,
			r.unit_price
		].join(','))
	}
	
	await fs.writeFile(filePath, lines.join('\n'), 'utf8')
	return { cancelled: false, filePath }
})

ipcMain.handle('reports:exportSalesPdf', async (_e, payload) => {
	let mode = 'all'
	let startDate = null
	let endDate = null
	let month = null
	if (typeof payload === 'object' && payload !== null) {
		mode = payload.mode || 'all'
		month = payload.month || null
		startDate = payload.startDate || null
		endDate = payload.endDate || null
	}
	if (mode === 'month' && month) {
		const [y, m] = String(month).split('-').map(Number)
		if (y && m) {
			const mm = String(m).padStart(2, '0')
			startDate = `${y}-${mm}-01`
			const nextMonth = m === 12 ? 1 : m + 1
			const nextMonthYear = m === 12 ? y + 1 : y
			const nm = String(nextMonth).padStart(2, '0')
			const nextMonthStart = `${nextMonthYear}-${nm}-01`
			const endRow = db.prepare("SELECT date(?, '-1 day') as end").get(nextMonthStart)
			endDate = endRow.end
		}
	}

	const periodLabel = (mode === 'month' && month)
		? `Period: ${month}`
		: (startDate || endDate)
			? `Period: ${startDate || '—'} to ${endDate || '—'}`
			: 'Period: All Time'

	// Build date range clause
	const whereParts = []
	const params = []
	if (startDate) { whereParts.push('date >= ?'); params.push(startDate) }
	if (endDate) { whereParts.push('date <= ?'); params.push(endDate) }
	const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : ''

	const rows = db.prepare(`
		SELECT 
			sr.date, n.label, n.fuel_type, 
			sr.opening, sr.closing, sr.sales_litres, sr.sales_value,
			CASE 
				WHEN n.fuel_type = 'petrol' THEN sr.petrol_price 
				WHEN n.fuel_type = 'diesel' THEN sr.diesel_price 
				WHEN n.fuel_type = 'others' THEN sr.petrol_price 
				ELSE 0 
			END as unit_price
		FROM sales_readings sr
		JOIN nozzles n ON n.id = sr.nozzle_id
		${whereClause}
		ORDER BY sr.date DESC, n.label ASC
	`).all(...params)

	const { filePath, canceled } = await dialog.showSaveDialog({
		title: 'Save Sales PDF Report',
		defaultPath: 'Sales_Report.pdf',
		filters: [{ name: 'PDF', extensions: ['pdf'] }]
	})
	if (canceled || !filePath) return { cancelled: true }

	const doc = new PDFDocument({ 
		margin: 50,
		size: 'A4',
		layout: 'landscape'
	})
	const stream = createWriteStream(filePath)
	doc.pipe(stream)

	function currency(v) { return `Rs ${Number(v || 0).toFixed(2)}` }

	function drawPageHeader() {
		doc.fontSize(20).fillColor('#111').font('Helvetica-Bold').text('Sri Lakshmi Narayana Filling station', { align: 'center' })
		doc.moveDown(0.2)
		doc.fontSize(16).font('Helvetica').text('Sales Report', { align: 'center' })
		doc.moveDown(0.25)
		doc.fontSize(10).fillColor('#666').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' })
		doc.text(periodLabel, { align: 'center' })
		doc.moveDown(0.8)
		doc.fillColor('#000')
		const lineY = doc.y
		doc.moveTo(doc.page.margins.left, lineY).lineTo(doc.page.width - doc.page.margins.right, lineY).strokeColor('#ddd').stroke()
		doc.moveDown(0.6)
	}

	doc.on('pageAdded', () => {
		drawPageHeader()
	})

	drawPageHeader()

	// Summary by fuel type
	const fuelTotals = db.prepare(`
		SELECT 
			n.fuel_type,
			SUM(sr.sales_litres) as total_litres,
			SUM(sr.sales_value) as total_value
		FROM sales_readings sr
		JOIN nozzles n ON n.id = sr.nozzle_id
		${whereClause}
		GROUP BY n.fuel_type
		ORDER BY n.fuel_type
	`).all(...params)

	const totalSalesValue = rows.reduce((sum, r) => sum + (r.sales_value || 0), 0)

	doc.fontSize(14).text('Summary by Fuel Type', { underline: true })
	doc.moveDown(0.5)
	for (const ft of fuelTotals) {
		doc.fontSize(12).text(`${ft.fuel_type.toUpperCase()}: ${ft.total_litres?.toFixed(2) || '0.00'} L, ${currency(ft.total_value)}`)
	}
	doc.moveDown(0.5)
	doc.fontSize(14).font('Helvetica-Bold').text(`TOTAL SALES VALUE: ${currency(totalSalesValue)}`, { underline: true })
	doc.moveDown(1)

	// Sales table
	doc.fontSize(14).text('Daily Sales Details', { underline: true })
	doc.moveDown(0.5)

	const pageWidth = doc.page.width
	const contentLeft = doc.page.margins.left
	const contentRight = pageWidth - doc.page.margins.right
	const contentWidth = contentRight - contentLeft

	const colWidths = [100, 120, 80, 90, 90, 90, 100, 100]
	const headers = ['Date', 'Label', 'Fuel', 'Opening', 'Closing', 'Sales(L)', 'Value', 'Unit Price (Rs/L)']
	const rowHeight = 20
	const headerFill = '#f0f0f0'
	const zebraFill = '#fafafa'
	
	// Calculate total column width and adjust if needed
	const totalColWidth = colWidths.reduce((sum, width) => sum + width, 0)
	
	// If columns are too wide, scale them down proportionally
	if (totalColWidth > contentWidth) {
		const scale = contentWidth / totalColWidth
		colWidths.forEach((width, i) => {
			colWidths[i] = Math.floor(width * scale)
		})
	}

	function ensurePageSpace() {
		if (doc.y + rowHeight + 10 > doc.page.height - doc.page.margins.bottom) {
			doc.addPage()
		}
	}

	function drawTableHeader() {
		ensurePageSpace()
		let x = contentLeft
		const y = doc.y
		doc.save()
		doc.fillColor('#000').fontSize(9).font('Helvetica-Bold')
		for (let i = 0; i < headers.length; i++) {
			doc.rect(x, y, colWidths[i], rowHeight).fillAndStroke(headerFill, '#e0e0e0')
			doc.fillColor('#000')
			doc.text(headers[i], x + 3, y + 5, { width: colWidths[i] - 6, height: rowHeight - 10 })
			x += colWidths[i]
		}
		doc.restore()
		doc.y = y + rowHeight
	}

	function drawTableRow(values, rowIndex) {
		ensurePageSpace()
		let x = contentLeft
		const y = doc.y
		const isEven = rowIndex % 2 === 0
		if (isEven) {
			doc.save()
			doc.rect(x, y, contentWidth, rowHeight).fill(zebraFill)
			doc.restore()
		}
		doc.save()
		doc.fontSize(9).font('Helvetica')
		for (let i = 0; i < values.length; i++) {
			const cellText = String(values[i] ?? '')
			doc.fillColor('#000').text(cellText, x + 3, y + 3, { width: colWidths[i] - 6, height: rowHeight - 6 })
			doc.moveTo(x + colWidths[i], y).lineTo(x + colWidths[i], y + rowHeight).strokeColor('#eee').stroke()
			x += colWidths[i]
		}
		doc.restore()
		doc.moveTo(contentLeft, y + rowHeight).lineTo(contentRight, y + rowHeight).strokeColor('#eee').stroke()
		doc.y = y + rowHeight
	}

	drawTableHeader()
	let index = 0
	for (const r of rows) {
		drawTableRow([
			r.date, r.label, r.fuel_type.toUpperCase(),
			Number(r.opening).toFixed(2), Number(r.closing).toFixed(2), 
			Number(r.sales_litres).toFixed(2), currency(r.sales_value),
			currency(r.unit_price)
		], index++)
	}

	doc.end()

	await new Promise((resolve, reject) => {
		stream.on('finish', resolve)
		stream.on('error', reject)
	})

	return { cancelled: false, filePath }
}) 

// Expenses handlers
ipcMain.handle('expenses:add', (_e, expense) => {
	const stmt = db.prepare(`INSERT INTO expenses (date, description, amount) VALUES (@date, @description, @amount)`)
	const result = stmt.run(expense)
	return { ok: true, id: result.lastInsertRowid }
})

ipcMain.handle('expenses:listByDate', (_e, date) => {
	return db.prepare('SELECT * FROM expenses WHERE date = ? ORDER BY created_at DESC').all(date)
})

ipcMain.handle('expenses:update', (_e, expense) => {
	const stmt = db.prepare(`UPDATE expenses SET date = @date, description = @description, amount = @amount WHERE id = @id`)
	stmt.run(expense)
	return { ok: true }
})

ipcMain.handle('expenses:delete', (_e, expenseId) => {
	db.prepare('DELETE FROM expenses WHERE id = ?').run(expenseId)
	return { ok: true }
})

// Expenses reports
ipcMain.handle('reports:exportExpensesCsv', async (_e, payload) => {
	let mode = 'all'
	let startDate = null
	let endDate = null
	let month = null
	if (typeof payload === 'object' && payload !== null) {
		mode = payload.mode || 'all'
		month = payload.month || null
		startDate = payload.startDate || null
		endDate = payload.endDate || null
	}
	if (mode === 'month' && month) {
		const [y, m] = String(month).split('-').map(Number)
		if (y && m) {
			const mm = String(m).padStart(2, '0')
			startDate = `${y}-${mm}-01`
			const nextMonth = m === 12 ? 1 : m + 1
			const nextMonthYear = m === 12 ? y + 1 : y
			const nm = String(nextMonth).padStart(2, '0')
			const nextMonthStart = `${nextMonthYear}-${nm}-01`
			const endRow = db.prepare("SELECT date(?, '-1 day') as end").get(nextMonthStart)
			endDate = endRow.end
		}
	}

	const periodLabel = (mode === 'month' && month)
		? `Period: ${month}`
		: (startDate || endDate)
			? `Period: ${startDate || '—'} to ${endDate || '—'}`
			: 'Period: All Time'

	// Build date range clause
	const whereParts = []
	const params = []
	if (startDate) { whereParts.push('date >= ?'); params.push(startDate) }
	if (endDate) { whereParts.push('date <= ?'); params.push(endDate) }
	const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : ''

	const rows = db.prepare(`
		SELECT date, description, amount
		FROM expenses
		${whereClause}
		ORDER BY date DESC, created_at DESC
	`).all(...params)

	const { filePath, canceled } = await dialog.showSaveDialog({
		title: 'Save Expenses Report',
		defaultPath: 'Expenses_Report.csv',
		filters: [{ name: 'CSV', extensions: ['csv'] }]
	})
	if (canceled || !filePath) return { cancelled: true }

	const esc = (v) => (`"${String(v ?? '').replace(/"/g, '""')}"`)
	const lines = []
	lines.push('Sri Lakshmi Narayana Filling station')
	lines.push('Expenses Report')
	lines.push(periodLabel)
	lines.push(`Generated: ${new Date().toLocaleString()}`)
	lines.push('')
	
	// Add summary section
	const totalExpenses = rows.reduce((sum, r) => sum + (r.amount || 0), 0)
	const categoryTotals = db.prepare(`
		SELECT 
			description,
			SUM(amount) as total_amount,
			COUNT(*) as count
		FROM expenses
		${whereClause}
		GROUP BY description
		ORDER BY total_amount DESC
	`).all(...params)
	
	lines.push('Summary:')
	lines.push('Description,Total Amount (Rs),Count')
	for (const ct of categoryTotals) {
		lines.push(`${ct.description},${ct.total_amount?.toFixed(2) || '0.00'},${ct.count}`)
	}
	lines.push(`TOTAL,${totalExpenses.toFixed(2)},${rows.length}`)
	lines.push('')
	lines.push('Date,Description,Amount (Rs)')
	
	for (const r of rows) {
		lines.push([
			r.date, esc(r.description), r.amount
		].join(','))
	}
	
	await fs.writeFile(filePath, lines.join('\n'), 'utf8')
	return { cancelled: false, filePath }
})

ipcMain.handle('reports:exportExpensesPdf', async (_e, payload) => {
	let mode = 'all'
	let startDate = null
	let endDate = null
	let month = null
	if (typeof payload === 'object' && payload !== null) {
		mode = payload.mode || 'all'
		month = payload.month || null
		startDate = payload.startDate || null
		endDate = payload.endDate || null
	}
	if (mode === 'month' && month) {
		const [y, m] = String(month).split('-').map(Number)
		if (y && m) {
			const mm = String(m).padStart(2, '0')
			startDate = `${y}-${mm}-01`
			const nextMonth = m === 12 ? 1 : m + 1
			const nextMonthYear = m === 12 ? y + 1 : y
			const nm = String(nextMonth).padStart(2, '0')
			const nextMonthStart = `${nextMonthYear}-${nm}-01`
			const endRow = db.prepare("SELECT date(?, '-1 day') as end").get(nextMonthStart)
			endDate = endRow.end
		}
	}

	const periodLabel = (mode === 'month' && month)
		? `Period: ${month}`
		: (startDate || endDate)
			? `Period: ${startDate || '—'} to ${endDate || '—'}`
			: 'Period: All Time'

	// Build date range clause
	const whereParts = []
	const params = []
	if (startDate) { whereParts.push('date >= ?'); params.push(startDate) }
	if (endDate) { whereParts.push('date <= ?'); params.push(endDate) }
	const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : ''

	const rows = db.prepare(`
		SELECT date, description, amount
		FROM expenses
		${whereClause}
		ORDER BY date DESC, created_at DESC
	`).all(...params)

	const { filePath, canceled } = await dialog.showSaveDialog({
		title: 'Save Expenses PDF Report',
		defaultPath: 'Expenses_Report.pdf',
		filters: [{ name: 'PDF', extensions: ['pdf'] }]
	})
	if (canceled || !filePath) return { cancelled: true }

	const doc = new PDFDocument({ 
		margin: 50,
		size: 'A4',
		layout: 'portrait'
	})
	const stream = createWriteStream(filePath)
	doc.pipe(stream)

	function currency(v) { return `Rs ${Number(v || 0).toFixed(2)}` }

	function drawPageHeader() {
		doc.fontSize(20).fillColor('#111').font('Helvetica-Bold').text('Sri Lakshmi Narayana Filling station', { align: 'center' })
		doc.moveDown(0.2)
		doc.fontSize(16).font('Helvetica').text('Expenses Report', { align: 'center' })
		doc.moveDown(0.25)
		doc.fontSize(10).fillColor('#666').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' })
		doc.text(periodLabel, { align: 'center' })
		doc.moveDown(0.8)
		doc.fillColor('#000')
		const lineY = doc.y
		doc.moveTo(doc.page.margins.left, lineY).lineTo(doc.page.width - doc.page.margins.right, lineY).strokeColor('#ddd').stroke()
		doc.moveDown(0.6)
	}

	doc.on('pageAdded', () => {
		drawPageHeader()
	})

	drawPageHeader()

	// Summary by category
	const categoryTotals = db.prepare(`
		SELECT 
			description,
			SUM(amount) as total_amount,
			COUNT(*) as count
		FROM expenses
		${whereClause}
		GROUP BY description
		ORDER BY total_amount DESC
	`).all(...params)

	const totalExpenses = rows.reduce((sum, r) => sum + (r.amount || 0), 0)

	doc.fontSize(14).text('Summary by Category', { underline: true })
	doc.moveDown(0.5)
	for (const ct of categoryTotals) {
		doc.fontSize(12).text(`${ct.description}: ${currency(ct.total_amount)} (${ct.count} items)`)
	}
	doc.moveDown(0.5)
	doc.fontSize(14).font('Helvetica-Bold').text(`TOTAL EXPENSES: ${currency(totalExpenses)}`, { underline: true })
	doc.moveDown(1)

	// Expenses table
	doc.fontSize(14).text('Expense Details', { underline: true })
	doc.moveDown(0.5)

	const pageWidth = doc.page.width
	const contentLeft = doc.page.margins.left
	const contentRight = pageWidth - doc.page.margins.right
	const contentWidth = contentRight - contentLeft

	const colWidths = [80, 120, 200, 100]
	const headers = ['Date', 'Description', 'Amount (Rs)']
	const rowHeight = 20
	const headerFill = '#f0f0f0'
	const zebraFill = '#fafafa'
	
	// Calculate total column width and adjust if needed
	const totalColWidth = colWidths.reduce((sum, width) => sum + width, 0)
	
	// If columns are too wide, scale them down proportionally
	if (totalColWidth > contentWidth) {
		const scale = contentWidth / totalColWidth
		colWidths.forEach((width, i) => {
			colWidths[i] = Math.floor(width * scale)
		})
	}

	function ensurePageSpace() {
		if (doc.y + rowHeight + 10 > doc.page.height - doc.page.margins.bottom) {
			doc.addPage()
		}
	}

	function drawTableHeader() {
		ensurePageSpace()
		let x = contentLeft
		const y = doc.y
		doc.save()
		doc.fillColor('#000').fontSize(9).font('Helvetica-Bold')
		for (let i = 0; i < headers.length; i++) {
			doc.rect(x, y, colWidths[i], rowHeight).fillAndStroke(headerFill, '#e0e0e0')
			doc.fillColor('#000')
			doc.text(headers[i], x + 3, y + 5, { width: colWidths[i] - 6, height: rowHeight - 10 })
			x += colWidths[i]
		}
		doc.restore()
		doc.y = y + rowHeight
	}

	function drawTableRow(values, rowIndex) {
		ensurePageSpace()
		let x = contentLeft
		const y = doc.y
		const isEven = rowIndex % 2 === 0
		if (isEven) {
			doc.save()
			doc.rect(x, y, contentWidth, rowHeight).fill(zebraFill)
			doc.restore()
		}
		doc.save()
		doc.fontSize(9).font('Helvetica')
		for (let i = 0; i < values.length; i++) {
			const cellText = String(values[i] ?? '')
			doc.fillColor('#000').text(cellText, x + 3, y + 3, { width: colWidths[i] - 6, height: rowHeight - 6 })
			doc.moveTo(x + colWidths[i], y).lineTo(x + colWidths[i], y + rowHeight).strokeColor('#eee').stroke()
			x += colWidths[i]
		}
		doc.restore()
		doc.moveTo(contentLeft, y + rowHeight).lineTo(contentRight, y + rowHeight).strokeColor('#eee').stroke()
		doc.y = y + rowHeight
	}

	drawTableHeader()
	let index = 0
	for (const r of rows) {
		drawTableRow([
			r.date, r.description, currency(r.amount)
		], index++)
	}

	doc.end()

	await new Promise((resolve, reject) => {
		stream.on('finish', resolve)
		stream.on('error', reject)
	})

	return { cancelled: false, filePath }
}) 

// Dashboard metrics
ipcMain.handle('dashboard:getMetrics', (_e, payload) => {
	try {
		const month = (payload && payload.month) ? String(payload.month) : new Date().toISOString().slice(0,7)
		// Sales totals by day and fuel
		const salesRows = db.prepare(`
			SELECT sr.date as date, n.fuel_type as fuel_type, SUM(sr.sales_value) as total_value, SUM(sr.sales_litres) as total_litres
			FROM sales_readings sr
			JOIN nozzles n ON n.id = sr.nozzle_id
			WHERE strftime('%Y-%m', sr.date) = ?
			GROUP BY sr.date, n.fuel_type
			ORDER BY sr.date ASC
		`).all(month)
		
		const salesTotalsRow = db.prepare(`
			SELECT SUM(sr.sales_value) as total_sales
			FROM sales_readings sr
			WHERE strftime('%Y-%m', sr.date) = ?
		`).get(month) || { total_sales: 0 }
		
		const salesTotalsByFuel = db.prepare(`
			SELECT n.fuel_type, SUM(sr.sales_value) as total_value
			FROM sales_readings sr
			JOIN nozzles n ON n.id = sr.nozzle_id
			WHERE strftime('%Y-%m', sr.date) = ?
			GROUP BY n.fuel_type
		`).all(month)
		
		const dailyMap = {}
		const fuelSetDates = { petrol: new Set(), diesel: new Set(), others: new Set() }
		for (const r of salesRows) {
			if (!dailyMap[r.date]) dailyMap[r.date] = { date: r.date, petrol: 0, diesel: 0, others: 0, total: 0 }
			dailyMap[r.date][r.fuel_type] += r.total_value || 0
			dailyMap[r.date].total += r.total_value || 0
			if (fuelSetDates[r.fuel_type]) fuelSetDates[r.fuel_type].add(r.date)
		}
		const dailySeries = Object.values(dailyMap).sort((a,b) => a.date.localeCompare(b.date))
		
		const totalsByFuel = { petrol: 0, diesel: 0, others: 0 }
		for (const r of salesTotalsByFuel) {
			totalsByFuel[r.fuel_type] = r.total_value || 0
		}
		const dailyAverageByFuel = {
			petrol: totalsByFuel.petrol / Math.max(1, fuelSetDates.petrol.size),
			diesel: totalsByFuel.diesel / Math.max(1, fuelSetDates.diesel.size),
			others: totalsByFuel.others / Math.max(1, fuelSetDates.others.size)
		}
		
		// Expenses
		const expenseTotalRow = db.prepare(`
			SELECT COALESCE(SUM(amount), 0) as total_expenses FROM expenses WHERE strftime('%Y-%m', date) = ?
		`).get(month) || { total_expenses: 0 }
		const expenseDaily = db.prepare(`
			SELECT date, SUM(amount) as amount FROM expenses WHERE strftime('%Y-%m', date) = ? GROUP BY date ORDER BY date ASC
		`).all(month)
		
		// Credits/payments for month and total due overall
		const monthTx = db.prepare(`
			SELECT 
				SUM(CASE WHEN type='credit' THEN amount ELSE 0 END) as credit,
				SUM(CASE WHEN type='payment' THEN amount ELSE 0 END) as payment
			FROM transactions WHERE strftime('%Y-%m', date) = ?
		`).get(month) || { credit: 0, payment: 0 }
		const totalDueRow = db.prepare(`
			SELECT COALESCE(SUM(CASE WHEN type='credit' THEN amount ELSE -amount END), 0) as due
			FROM transactions
		`).get() || { due: 0 }
		
		return {
			month,
			sales: {
				totalSales: salesTotalsRow.total_sales || 0,
				totalsByFuel,
				dailySeries,
				dailyAverageByFuel
			},
			expenses: {
				total: expenseTotalRow.total_expenses || 0,
				dailySeries: expenseDaily
			},
			credits: {
				monthCredit: monthTx.credit || 0,
				monthPayment: monthTx.payment || 0,
				monthNet: (monthTx.credit || 0) - (monthTx.payment || 0),
				totalDue: totalDueRow.due || 0
			}
		}
	} catch (err) {
		console.error('Error building dashboard metrics:', err)
		return { error: String(err) }
	}
}) 

// Data Management: backup database
ipcMain.handle('dataManagementBackup', async () => {
	try {
		const backupDir = path.join(app.getPath('downloads'), 'SLNFS_CRM_Backups')
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
		const backupFileName = `slnfs_crm_backup_${timestamp}.db`
		const backupPath = path.join(backupDir, backupFileName)
		
		// Create backup directory if it doesn't exist
		await fs.mkdir(backupDir, { recursive: true })
		
		// Copy the database file
		await fs.copyFile(dbPath, backupPath)
		
		// Get backup file stats
		const stats = await fs.stat(backupPath)
		const fileSize = (stats.size / 1024).toFixed(2) + ' KB'
		
		// Get database information
		const tables = ['customers', 'transactions', 'nozzles', 'sales_readings', 'expenses']
		const recordCounts = {}
		
		for (const table of tables) {
			try {
				const count = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get()
				recordCounts[table] = count.count
			} catch (err) {
				recordCounts[table] = 0
			}
		}
		
		const backupInfo = {
			timestamp: new Date().toLocaleString(),
			tables: tables,
			recordCounts: recordCounts,
			totalSize: fileSize,
			filePath: backupPath
		}
		
		return {
			success: true,
			backupInfo: backupInfo,
			filePath: backupPath
		}
	} catch (err) {
		console.error('Error during backup:', err)
		return {
			success: false,
			error: err.message
		}
	}
}) 