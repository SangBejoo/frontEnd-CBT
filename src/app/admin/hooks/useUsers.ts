import { useState, useCallback, useEffect } from 'react';
import { useToast } from '@chakra-ui/react';
import apiClient from '../services/api';
import { AxiosError } from 'axios';

export interface User {
  id: number;
  email: string;
  nama: string;
  role: string;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CreateUserData {
  email: string;
  password: string;
  nama: string;
  role: string;
}

export interface UpdateUserData {
  email: string;
  nama: string;
  role: string;
  isActive: boolean;
}

export interface PaginationInfo {
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

export interface UseUsersOptions {
  pageSize?: number;
}

export function useUsers(options: UseUsersOptions = { pageSize: 10 }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo>({
    totalCount: 0,
    totalPages: 0,
    currentPage: 1,
    pageSize: options.pageSize || 10,
  });
  const toast = useToast();

  const fetchUsers = useCallback(
    async (
      page: number = 1,
      roleFilter: string = 'all',
      statusFilter: string = 'all'
    ) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.append('page', page.toString());
        params.append('page_size', pagination.pageSize.toString());

        if (roleFilter !== 'all') {
          params.append('role', roleFilter.toUpperCase());
        }

        if (statusFilter !== 'all') {
          params.append('isActive', statusFilter === 'active' ? 'true' : 'false');
        }

        const response = await apiClient.get<any>(
          `/auth/users?${params.toString()}`
        );

        if (response.data.success) {
          setUsers(response.data.users || []);
          setPagination({
            totalCount: response.data.total || response.data.pagination?.totalCount || 0,
            totalPages: response.data.pagination?.totalPages || 0,
            currentPage: page,
            pageSize: pagination.pageSize,
          });
        } else {
          throw new Error(response.data.message || 'Failed to fetch users');
        }
      } catch (error: any) {
        const message = error.response?.data?.message || error.message || 'Gagal memuat users';
        toast({
          title: 'Error',
          description: message,
          status: 'error',
          duration: 4000,
          isClosable: true,
        });
        setUsers([]);
      } finally {
        setLoading(false);
      }
    },
    [pagination.pageSize, toast]
  );

  useEffect(() => {
    fetchUsers(1);
  }, []);

  const createUser = useCallback(
    async (data: CreateUserData) => {
      try {
        const response = await apiClient.post<any>('/auth/users', data);

        if (response.data.success) {
          toast({
            title: 'Berhasil',
            description: 'User berhasil dibuat',
            status: 'success',
            duration: 3000,
            isClosable: true,
          });
          await fetchUsers(1);
          return response.data.user;
        } else {
          throw new Error(response.data.message || 'Failed to create user');
        }
      } catch (error: any) {
        const message = error.response?.data?.message || error.message || 'Gagal membuat user';
        toast({
          title: 'Error',
          description: message,
          status: 'error',
          duration: 4000,
          isClosable: true,
        });
        throw error;
      }
    },
    [fetchUsers, toast]
  );

  const updateUser = useCallback(
    async (id: number, data: UpdateUserData) => {
      try {
        const response = await apiClient.put<any>(`/auth/users/${id}`, data);

        if (response.data.success) {
          toast({
            title: 'Berhasil',
            description: 'User berhasil diperbarui',
            status: 'success',
            duration: 3000,
            isClosable: true,
          });
          setUsers((prev) =>
            prev.map((user) => (user.id === id ? { ...user, ...data } : user))
          );
          return response.data.user;
        } else {
          throw new Error(response.data.message || 'Failed to update user');
        }
      } catch (error: any) {
        const message = error.response?.data?.message || error.message || 'Gagal update user';
        toast({
          title: 'Error',
          description: message,
          status: 'error',
          duration: 4000,
          isClosable: true,
        });
        throw error;
      }
    },
    [toast]
  );

  const deleteUser = useCallback(
    async (id: number) => {
      try {
        const response = await apiClient.delete<any>(`/auth/users/${id}`);

        if (response.data.success || response.status === 200) {
          toast({
            title: 'Berhasil',
            description: 'User berhasil dihapus',
            status: 'success',
            duration: 3000,
            isClosable: true,
          });
          setUsers((prev) => prev.filter((user) => user.id !== id));
          return true;
        } else {
          throw new Error(response.data.message || 'Failed to delete user');
        }
      } catch (error: any) {
        const message = error.response?.data?.message || error.message || 'Gagal hapus user';
        toast({
          title: 'Error',
          description: message,
          status: 'error',
          duration: 4000,
          isClosable: true,
        });
        throw error;
      }
    },
    [toast]
  );

  return {
    users,
    loading,
    pagination,
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
  };
}
