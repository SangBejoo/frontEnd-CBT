import { useCallback, useMemo, useState, useEffect } from 'react';
import { useToast } from '@chakra-ui/react';
import useSWR from 'swr';
import apiClient from '../services/api';
import { BaseEntity } from '../types';
import { AxiosError } from 'axios';

export interface UseCRUDOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: AxiosError) => void;
  autoFetch?: boolean;
}

// Maps internal endpoint names to actual API endpoints
// GET requests can use alias endpoints (levels, subjects, topics)
// POST/PUT/DELETE must use actual endpoints (tingkat, mata-pelajaran, materi)
const getReadEndpoint = (endpoint: string): string => {
  // Read operations - use actual endpoints for topics
  switch (endpoint) {
    case 'topics':
      return 'materi';
    default:
      return endpoint;
  }
};

const getWriteEndpoint = (endpoint: string): string => {
  // Write operations must use actual API endpoints
  switch (endpoint) {
    case 'levels':
      return 'tingkat';
    case 'subjects':
      return 'mata-pelajaran';
    case 'topics':
      return 'materi';
    default:
      return endpoint;
  }
};

const createFetcher = (endpoint: string) => async () => {
  const apiEndpoint = getReadEndpoint(endpoint);
  const res = await apiClient.get<any>(apiEndpoint, { timeout: 20000 });
  
  // Handle different response formats based on endpoint
  if (endpoint === 'levels' || endpoint === '/levels') {
    return res.data?.tingkat || [];
  } else if (endpoint === 'subjects' || endpoint === '/subjects') {
    return res.data?.mataPelajaran || [];
  } else if (endpoint === 'topics' || endpoint === '/topics' || endpoint === 'materi') {
    return res.data?.materi || [];
  } else if (endpoint === 'auth/users' || endpoint === '/auth/users') {
    return res.data?.users || [];
  } else {
    // Default parsing for other endpoints
    return Array.isArray(res.data)
      ? res.data
      : Array.isArray(res.data?.data)
      ? res.data.data
      : Array.isArray(res.data?.items)
      ? res.data.items
      : [];
  }
};

export function useCRUD<T extends BaseEntity>(
  endpoint: string,
  options: UseCRUDOptions = { autoFetch: true }
) {
  const toast = useToast();
  const [localData, setLocalData] = useState<T[]>([]);

  // Create fetcher for this endpoint
  const fetcher = useMemo(() => createFetcher(endpoint), [endpoint]);

  // Use SWR for data fetching with deduplication and caching
  const { data: swrData, error, isLoading, mutate } = useSWR<T[]>(
    options.autoFetch !== false ? `crud-${endpoint}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // 1 minute deduplication
      errorRetryCount: 2,
    }
  );

  // Sync SWR data to local state
  useEffect(() => {
    if (swrData) {
      setLocalData(swrData);
    }
  }, [swrData]);

  const handleError = useCallback((err: any, defaultMessage: string) => {
    const message = err.response?.data?.message || err.message || defaultMessage;
    toast({
      title: 'Error',
      description: message,
      status: 'error',
      duration: 4000,
      isClosable: true,
    });
    options.onError?.(err);
  }, [toast, options]);

  const handleSuccess = useCallback((message: string, newData?: any) => {
    toast({
      title: 'Berhasil',
      description: message,
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
    options.onSuccess?.(newData);
  }, [toast, options]);

  const fetch = useCallback(() => {
    mutate();
  }, [mutate]);

  const create = useCallback(
    async (payload: Omit<T, 'id'>) => {
      try {
        // Use write endpoint for POST
        const apiEndpoint = getWriteEndpoint(endpoint);
        const res = await apiClient.post<any>(apiEndpoint, payload);

        // Handle different response formats based on endpoint
        let newItem: T;
        if (endpoint === 'levels') {
          newItem = res.data?.tingkat as T;
        } else if (endpoint === 'subjects') {
          newItem = res.data?.mataPelajaran as T;
        } else if (endpoint === 'topics') {
          newItem = res.data?.materi as T;
        } else if (endpoint === 'auth/users') {
          newItem = res.data?.user as T;
        } else {
          newItem = (res.data?.data || res.data) as T;
        }

        // Update local state immediately
        setLocalData(prev => [...prev, newItem]);
        // Then revalidate from server
        mutate();
        handleSuccess('Data berhasil dibuat', newItem);
        return newItem;
      } catch (err: any) {
        handleError(err, 'Gagal membuat data');
        throw err;
      }
    },
    [endpoint, handleError, handleSuccess, mutate]
  );

  const update = useCallback(
    async (id: number, payload: Partial<Omit<T, 'id'>>) => {
      try {
        // Use write endpoint for PUT
        const apiEndpoint = getWriteEndpoint(endpoint);
        const res = await apiClient.put<any>(
          `${apiEndpoint}/${id}`,
          payload
        );

        // Handle different response formats based on endpoint
        let updatedItem: T;
        if (endpoint === 'levels') {
          updatedItem = res.data?.tingkat as T;
        } else if (endpoint === 'subjects') {
          updatedItem = res.data?.mataPelajaran as T;
        } else if (endpoint === 'topics') {
          updatedItem = res.data?.materi as T;
        } else if (endpoint === 'auth/users') {
          updatedItem = res.data?.user as T;
        } else {
          updatedItem = (res.data?.data || res.data) as T;
        }

        // Update local state immediately
        setLocalData(prev => prev.map(item => item.id === id ? updatedItem : item));
        // Then revalidate from server
        mutate();
        handleSuccess('Data berhasil diperbarui', updatedItem);
        return updatedItem;
      } catch (err: any) {
        handleError(err, 'Gagal memperbarui data');
        throw err;
      }
    },
    [endpoint, handleError, handleSuccess, mutate]
  );

  const remove = useCallback(
    async (id: number) => {
      try {
        // Use write endpoint for DELETE
        const apiEndpoint = getWriteEndpoint(endpoint);
        await apiClient.delete(`${apiEndpoint}/${id}`);
        // Update local state immediately
        setLocalData(prev => prev.filter(item => item.id !== id));
        // Then revalidate from server
        mutate();
        handleSuccess('Data berhasil dihapus');
      } catch (err: any) {
        handleError(err, 'Gagal menghapus data');
        throw err;
      }
    },
    [endpoint, handleError, handleSuccess, mutate]
  );

  return { 
    data: localData, 
    loading: isLoading, 
    error: error?.message || null, 
    fetch, 
    create, 
    update, 
    remove 
  };
}
