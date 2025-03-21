/**
 * @fileoverview Main application component for WisdomAI.
 * Handles user authentication and chat interface.
 */

import React, { useState } from "react";
import {
  Box,
  Typography,
  Button,
} from "@mui/material";
import "./index.css";
import Login from './components/Login';
import Register from './components/Register';
import Chat from './components/Chat';
import { isAuthenticated, logout } from './utils/auth';

/**
 * Main application component that handles user authentication and chat interface.
 * 
 * @component
 * @returns {JSX.Element} The rendered App component
 */
function App() {
  // Authentication state
  const [isLoggedIn, setIsLoggedIn] = useState(isAuthenticated());
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'

  /**
   * Handles user logout.
   */
  const handleLogout = () => {
    logout();
    setIsLoggedIn(false);
  };

  /**
   * Handles successful login by updating authentication state.
   */
  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
  };

  /**
   * Handles successful registration by updating authentication state.
   */
  const handleRegisterSuccess = () => {
    setIsLoggedIn(true);
  };

  // Render authentication components if not logged in
  if (!isLoggedIn) {
    return authMode === 'login' ? (
      <Login 
        onLoginSuccess={handleLoginSuccess}
        onSwitchToRegister={() => setAuthMode('register')}
      />
    ) : (
      <Register
        onRegisterSuccess={handleRegisterSuccess}
        onSwitchToLogin={() => setAuthMode('login')}
      />
    );
  }

  // Render main chat interface
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        backgroundColor: "#fafafa",
        py: 4,
        px: 2,
      }}
    >
      <Box 
        sx={{ 
          width: "100%", 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          mb: 4,
          px: 2
        }}
      >
        <Typography variant="h3">
          WisdomAI
        </Typography>
        <Button variant="outlined" color="primary" onClick={handleLogout}>
          Logout
        </Button>
      </Box>

      <Chat />
    </Box>
  );
}

export default App; 