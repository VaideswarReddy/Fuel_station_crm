import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface AuthContextType {
  isAuthenticated: boolean
  login: () => void
  logout: () => void
  checkAuth: () => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const checkAuth = (): boolean => {
    try {
      const authStatus = localStorage.getItem('isAuthenticated')
      const authTimestamp = localStorage.getItem('authTimestamp')
      
      if (authStatus === 'true' && authTimestamp) {
        // Check if authentication is not too old (24 hours)
        const timestamp = parseInt(authTimestamp)
        const now = Date.now()
        const maxAge = 24 * 60 * 60 * 1000 // 24 hours
        
        if (now - timestamp < maxAge) {
          return true
        } else {
          // Authentication expired, clear it
          localStorage.removeItem('isAuthenticated')
          localStorage.removeItem('authTimestamp')
          return false
        }
      }
      return false
    } catch (error) {
      console.error('Error checking authentication:', error)
      return false
    }
  }

  const login = () => {
    setIsAuthenticated(true)
  }

  const logout = () => {
    setIsAuthenticated(false)
    localStorage.removeItem('isAuthenticated')
    localStorage.removeItem('authTimestamp')
  }

  useEffect(() => {
    // Check authentication status on app start
    const authStatus = checkAuth()
    setIsAuthenticated(authStatus)
  }, [])

  const value: AuthContextType = {
    isAuthenticated,
    login,
    logout,
    checkAuth
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
} 