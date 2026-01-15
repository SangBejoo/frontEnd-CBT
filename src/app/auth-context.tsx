'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

interface User {
  id: number;
  email: string;
  nama: string;
  role: 'SISWA' | 'ADMIN';
  isActive: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for stored token on mount
    const storedToken = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('auth_user');

    if (storedToken && storedUser) {
      // Check if token is expired
      try {
        const payload = JSON.parse(atob(storedToken.split('.')[1]));
        const currentTime = Math.floor(Date.now() / 1000);
        if (payload.exp < currentTime) {
          // Token expired, clear storage
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
          setToken(null);
          setUser(null);
          delete axios.defaults.headers.common['Authorization'];
        } else {
          setToken(storedToken);
          const parsedUser = JSON.parse(storedUser);
          // Convert role from number to string if needed
          const processedUser = {
            ...parsedUser,
            role: typeof parsedUser.role === 'number' 
              ? (parsedUser.role === 1 ? 'SISWA' : parsedUser.role === 2 ? 'ADMIN' : 'SISWA')
              : parsedUser.role
          };
          setUser(processedUser);
          // Set axios default authorization header
          axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        }
      } catch (error) {
        // Invalid token, clear storage
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        setToken(null);
        setUser(null);
        delete axios.defaults.headers.common['Authorization'];
      }
    }

    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Login failed');
      }

      const { token: newToken, user: userData } = data;

      // Convert role from number to string if needed
      const processedUserData: User = {
        ...userData,
        role: typeof userData.role === 'number' 
          ? (userData.role === 1 ? 'SISWA' : userData.role === 2 ? 'ADMIN' : 'SISWA')
          : userData.role
      };

      // Store token and user data
      localStorage.setItem('auth_token', newToken);
      localStorage.setItem('auth_user', JSON.stringify(processedUserData));

      setToken(newToken);
      setUser(processedUserData);

      // Set axios default authorization header
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;

      // Return user data for redirect logic
      return processedUserData;
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setToken(null);
    setUser(null);
    // Remove axios authorization header
    delete axios.defaults.headers.common['Authorization'];
  };

  const value: AuthContextType = {
    user,
    token,
    login,
    logout,
    isLoading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}