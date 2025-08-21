import React, { useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Stack,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Chip
} from '@mui/material'

interface BackupInfo {
  timestamp: string
  tables: string[]
  recordCounts: Record<string, number>
  totalSize: string
  filePath: string
}

const DataManagement: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [backupInfo, setBackupInfo] = useState<BackupInfo | null>(null)

  const handleBackup = async () => {
    setLoading(true)
    setMessage(null)

    try {
      // Call the backup function from the backend
      const result = await window.api.dataManagementBackup()
      
      if (result.success) {
        setMessage({ 
          type: 'success', 
          text: `Backup completed successfully! Database file saved to: ${result.filePath}` 
        })
        setBackupInfo(result.backupInfo)
      } else {
        setMessage({ type: 'error', text: `Backup failed: ${result.error}` })
      }
    } catch (error) {
      console.error('Error during backup:', error)
      setMessage({ type: 'error', text: `Backup failed: ${error}` })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Data Management
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Create a complete backup of your application database. The backup file can be used to restore data by manually replacing the database file.
      </Typography>

      {message && (
        <Alert severity={message.type} sx={{ mb: 3 }}>
          {message.text}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Backup Section */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Create Database Backup</Typography>
              </Box>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Create a complete backup of your application database including all customers, transactions, sales, expenses, and nozzle configurations.
              </Typography>

              <Stack spacing={2}>
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  onClick={handleBackup}
                  disabled={loading}
                  sx={{ py: 1.5, px: 4 }}
                >
                  {loading ? 'Creating Backup...' : 'Create Database Backup'}
                </Button>

                {backupInfo && (
                  <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Backup Information:
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Date:</strong> {backupInfo.timestamp}<br/>
                      <strong>Tables:</strong> {backupInfo.tables.join(', ')}<br/>
                      <strong>Total Records:</strong> {Object.values(backupInfo.recordCounts).reduce((a, b) => a + b, 0)}<br/>
                      <strong>File Size:</strong> {backupInfo.totalSize}<br/>
                      <strong>File Location:</strong> {backupInfo.filePath}
                    </Typography>
                  </Paper>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* How to Restore Section */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                How to Restore
              </Typography>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                To restore your data from a backup:
              </Typography>

              <List dense>
                <ListItem sx={{ px: 0 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <Chip label="1" size="small" color="primary" />
                  </ListItemIcon>
                  <ListItemText primary="Close the application" />
                </ListItem>
                <ListItem sx={{ px: 0 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <Chip label="2" size="small" color="primary" />
                  </ListItemIcon>
                  <ListItemText primary="Locate your backup .db file" />
                </ListItem>
                <ListItem sx={{ px: 0 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <Chip label="3" size="small" color="primary" />
                  </ListItemIcon>
                  <ListItemText primary="Replace the existing database file" />
                </ListItem>
                <ListItem sx={{ px: 0 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <Chip label="4" size="small" color="primary" />
                  </ListItemIcon>
                  <ListItemText primary="Restart the application" />
                </ListItem>
              </List>

              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>Note:</strong> The database file is typically located in the application's data directory.
                </Typography>
              </Alert>
            </CardContent>
          </Card>
        </Grid>

        {/* Information Section */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                What Gets Backed Up
              </Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <Box sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                      Customer Data
                    </Typography>
                    <List dense>
                      <ListItem sx={{ px: 0 }}>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <Chip label="✓" size="small" color="success" />
                        </ListItemIcon>
                        <ListItemText primary="Customer Information" />
                      </ListItem>
                      <ListItem sx={{ px: 0 }}>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <Chip label="✓" size="small" color="success" />
                        </ListItemIcon>
                        <ListItemText primary="Credit & Payment Records" />
                      </ListItem>
                      <ListItem sx={{ px: 0 }}>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <Chip label="✓" size="small" color="success" />
                        </ListItemIcon>
                        <ListItemText primary="Transaction History" />
                      </ListItem>
                    </List>
                  </Box>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Box sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                      Business Data
                    </Typography>
                    <List dense>
                      <ListItem sx={{ px: 0 }}>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <Chip label="✓" size="small" color="success" />
                        </ListItemIcon>
                        <ListItemText primary="Sales Data & Readings" />
                      </ListItem>
                      <ListItem sx={{ px: 0 }}>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <Chip label="✓" size="small" color="success" />
                        </ListItemIcon>
                        <ListItemText primary="Expense Records" />
                      </ListItem>
                      <ListItem sx={{ px: 0 }}>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <Chip label="✓" size="small" color="success" />
                        </ListItemIcon>
                        <ListItemText primary="Nozzle Configuration" />
                      </ListItem>
                    </List>
                  </Box>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Box sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                      Backup Features
                    </Typography>
                    <List dense>
                      <ListItem sx={{ px: 0 }}>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <Chip label="🔒" size="small" />
                        </ListItemIcon>
                        <ListItemText primary="Complete database copy" />
                      </ListItem>
                      <ListItem sx={{ px: 0 }}>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <Chip label="🔒" size="small" />
                        </ListItemIcon>
                        <ListItemText primary="Data integrity preserved" />
                      </ListItem>
                      <ListItem sx={{ px: 0 }}>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <Chip label="🔒" size="small" />
                        </ListItemIcon>
                        <ListItemText primary="Easy manual restore" />
                      </ListItem>
                    </List>
                  </Box>
                </Grid>
              </Grid>

              <Divider sx={{ my: 3 }} />
              
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>Tip:</strong> Create regular backups of your database to protect against data loss. 
                  Store backup files in a secure location separate from your computer.
                </Typography>
              </Alert>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}

export default DataManagement 