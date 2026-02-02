# SLNSS CRM - Fuel Station Management System

A comprehensive Customer Relationship Management (CRM) application designed specifically for fuel stations. This Electron-based desktop application provides complete fuel sales tracking, customer management, expense tracking, and detailed reporting capabilities.

## 🚀 Features

### Core Functionality
- **Sales Management**: Daily fuel sales tracking with nozzle-specific readings
- **Customer Management**: Customer database with transaction history
- **Expense Tracking**: Daily expense recording and management
- **Dashboard**: Visual analytics with charts and key metrics
- **Reporting**: Comprehensive PDF and CSV reports
- **Data Backup**: Database backup and restoration capabilities
- **Authentication**: Secure login system

### Sales Features
- **8 Nozzles**: Support for petrol, diesel, and miscellaneous fuel types
- **Daily Readings**: Opening/closing meter readings with automatic calculations
- **Price Management**: Individual nozzle pricing
- **Historical Data**: View and edit historical sales data
- **Auto-prefill**: Automatic opening reading suggestions from previous day

### Customer Features
- **Customer Database**: Store customer information (name, phone, email, notes)
- **Transaction History**: Track credits, payments, and outstanding balances
- **Search & Filter**: Find customers quickly
- **Transaction Management**: Add, edit, and delete individual transactions

### Reporting Features
- **Sales Reports**: Daily, monthly, and custom period reports
- **Customer Reports**: Individual customer transaction summaries
- **Expense Reports**: Expense tracking and analysis
- **Multiple Formats**: PDF (landscape) and CSV export options

## 📋 System Requirements

### Operating System
- **macOS**: 10.15 (Catalina) or later
- **Windows**: 10 or later
- **Linux**: Ubuntu 18.04+ or equivalent

### Hardware Requirements
- **RAM**: Minimum 4GB, Recommended 8GB+
- **Storage**: 500MB available space
- **Processor**: Any modern multi-core processor

### Software Requirements
- **Node.js**: Version 18.0.0 or later
- **npm**: Version 8.0.0 or later (comes with Node.js)

## 🛠️ Installation & Setup

### Step 1: Install Node.js
1. Visit [nodejs.org](https://nodejs.org/)
2. Download the LTS (Long Term Support) version
3. Run the installer and follow the setup wizard
4. Verify installation by opening terminal/command prompt:
   ```bash
   node --version
   npm --version
   ```

### Step 2: Clone/Download the Application
1. Download the application files to your computer
2. Extract the ZIP file (if downloaded as ZIP)
3. Open terminal/command prompt and navigate to the app directory:
   ```bash
   cd /path/to/App
   ```

### Step 3: Install Dependencies
1. In the app directory, run:
   ```bash
   npm install
   ```
2. Wait for installation to complete (may take 2-5 minutes)
3. This will install all required packages and rebuild native dependencies

### Step 4: Launch the Application
1. **Development Mode** (for testing and development):
   ```bash
   npm run dev
   ```
2. **Production Mode** (for regular use):
   ```bash
   npm start
   ```

## 🔐 First Time Setup

### Initial Login
- **Username**: `admin`
- **Password**: `admin`
- **Note**: These are default credentials. For production use, consider changing them.

### Database Initialization
- The app automatically creates the database on first run
- Default nozzles are pre-configured:
  - Nozzles 1-3: Petrol
  - Nozzles 4-7: Diesel
  - Nozzle 8: Others/Miscellaneous

## 📱 Application Usage

### Dashboard
- **Overview**: Monthly sales totals, expenses, and customer metrics
- **Charts**: Visual representation of daily sales and expenses
- **Quick Stats**: Total sales, average daily sales, outstanding balances

### Sales Management
1. **Select Date**: Choose the date for sales entry
2. **Enter Readings**: Input opening and closing meter readings for each nozzle
3. **Set Prices**: Enter current fuel prices per liter
4. **Save Data**: Click "Save" to store the day's sales data
5. **Historical View**: Click on any date to view/edit historical data

### Customer Management
1. **Add Customer**: Click "Add Customer" and fill in details
2. **Search**: Use the search bar to find customers quickly
3. **View Details**: Click on a customer to see transaction history
4. **Add Transactions**: Record credits, payments, or other transactions
5. **Edit/Delete**: Modify customer information or remove transactions

### Expense Tracking
1. **Daily Expenses**: Add expenses for each day
2. **Description**: Enter what the expense was for
3. **Amount**: Record the expense amount
4. **Historical View**: View and edit past expenses
5. **Reports**: Generate expense reports for any period

### Reports Generation
1. **Select Report Type**: Choose from Sales, Customer, or Expense reports
2. **Set Period**: Select day, month, all-time, or custom range
3. **Generate**: Click "Generate Report" to create PDF or CSV
4. **Download**: Reports are saved to your Downloads folder

### Data Management
1. **Backup**: Create database backups for data safety
2. **Backup Location**: Backups are saved to your Downloads folder
3. **File Format**: `.db` files that can be restored manually

## 🔧 Troubleshooting

### Common Issues

#### App Won't Start
- **Check Node.js**: Ensure Node.js version 18+ is installed
- **Dependencies**: Run `npm install` again
- **Permissions**: Ensure you have write permissions in the app directory

#### Database Errors
- **Reset Database**: Delete the `slnss_crm.db` file and restart the app
- **Migration Issues**: The app automatically handles database migrations

#### Performance Issues
- **Close Other Apps**: Free up system resources
- **Restart App**: Close and reopen the application
- **Check Storage**: Ensure adequate disk space

#### Report Generation Fails
- **Check Permissions**: Ensure write access to Downloads folder
- **Close PDFs**: Close any open PDF files
- **Restart App**: Try generating reports after restart

### Error Messages

#### "Missing required columns"
- The database needs to be recreated
- Delete the database file and restart the app

#### "Port already in use"
- Close any other instances of the app
- Wait a few seconds and try again

#### "Permission denied"
- Check file/folder permissions
- Run as administrator (Windows) or with sudo (macOS/Linux)

## 📁 File Structure

```
App/
├── electron/           # Backend Electron code
│   ├── main.js        # Main process
│   └── preload.cjs    # Preload scripts
├── src/               # Frontend React code
│   ├── screens/       # Application screens
│   ├── contexts/      # React contexts
│   └── main.tsx       # Main React component
├── dist/              # Built application files
├── node_modules/      # Dependencies
├── package.json       # Project configuration
└── README.md          # This file
```

## 🗄️ Database Schema

### Tables
- **sales_readings**: Daily fuel sales data
- **customers**: Customer information
- **transactions**: Customer credits/payments
- **nozzles**: Fuel nozzle configuration
- **expenses**: Daily expense records

### Key Fields
- **sales_readings**: date, nozzle_id, opening, closing, sales_litres, sales_value, petrol_price, diesel_price
- **customers**: id, name, phone, email, notes
- **transactions**: id, customer_id, amount, type, date, note
- **nozzles**: id, label, fuel_type, price_per_litre

## 🔒 Security Features

- **Authentication**: Login required to access the application
- **Data Isolation**: Each user's data is separate
- **Input Validation**: All user inputs are validated
- **Error Handling**: Comprehensive error handling and logging

## 📊 Data Export & Backup

### Export Formats
- **PDF Reports**: Professional formatted reports
- **CSV Files**: Data for external analysis
- **Database Backup**: Complete data backup (.db files)

### Backup Strategy
- **Automatic**: Create backups before major operations
- **Manual**: Use Data Management section for manual backups
- **Storage**: Backups saved to Downloads folder with timestamps

## 🚀 Development

### For Developers
- **Framework**: Electron + React + TypeScript
- **Database**: SQLite with better-sqlite3
- **UI Library**: Material-UI (MUI)
- **Charts**: @mui/x-charts
- **PDF Generation**: PDFKit

### Building for Production
```bash
npm run build
npm run electron:build
```

### Development Commands
```bash
npm run dev          # Start development server
npm run build        # Build frontend
npm start           # Start production app
```

## 📞 Support & Contact

### Getting Help
1. **Check this README** for common solutions
2. **Review error messages** in the application
3. **Check console logs** for technical details
4. **Restart the application** for temporary issues

### System Information
- **App Version**: 0.1.0
- **Database**: SQLite
- **Framework**: Electron 31.3.0
- **Frontend**: React 18.3.1

## 📝 License

This application is proprietary software developed for SLNSS fuel station management.

## 🔄 Updates

### Version History
- **v0.1.0**: Initial release with core CRM functionality
- Features: Sales tracking, customer management, expense tracking, reporting

### Future Enhancements
- Multi-user support
- Advanced analytics
- Cloud backup integration
- Mobile companion app

---

**Note**: This application is designed for fuel station operations. Ensure all data entry is accurate and regularly backup your database for data safety. 