import axios from 'axios';
import { getAuthToken } from '../utils/auth';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5001',
  headers: {
    'Content-Type': 'application/json'
  },
  // Add timeout
  timeout: 30000,
  // Add withCredentials for cookies
  withCredentials: true
});

// Add auth token to requests
api.interceptors.request.use(
  async (config) => {
    try {
      const token = getAuthToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    } catch (error) {
      console.error('Error setting up request:', error);
      return Promise.reject(error);
    }
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Server responded with error status
      console.error('Server error:', error.response.data);
      
      if (error.response.status === 401) {
        // Clear token and redirect to login
        localStorage.removeItem('token');
        window.location.href = '/login';
      } else if (error.response.status === 429) {
        // Rate limit exceeded
        console.error('Rate limit exceeded:', error.response.data);
      }
    } else if (error.request) {
      // Request made but no response
      console.error('No response received:', error.request);
      error.response = { data: { message: 'Server not responding. Please try again later.' } };
    } else {
      // Request setup error
      console.error('Request setup error:', error.message);
      error.response = { data: { message: 'Failed to make request. Please check your connection.' } };
    }
    return Promise.reject(error);
  }
);

export default api; 