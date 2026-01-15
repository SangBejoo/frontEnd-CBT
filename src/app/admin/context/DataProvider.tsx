'use client';

import React, { createContext, useContext, ReactNode, useCallback } from 'react';
import useSWR from 'swr';
import apiClient from '../services/api';
import { Level, Subject, Topic } from '../types';

interface DataContextType {
  levels: Level[];
  subjects: Subject[];
  topics: Topic[];
  loading: boolean;
  error: string | null;
  refreshLevels: () => Promise<void>;
  refreshSubjects: () => Promise<void>;
  refreshTopics: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

interface DataProviderProps {
  children: ReactNode;
}

// Fetchers with proper response parsing
const levelsFetcher = async () => {
  const res = await apiClient.get('/levels', { timeout: 15000 });
  return res.data?.tingkat || [];
};

const subjectsFetcher = async () => {
  const res = await apiClient.get('/subjects', { timeout: 15000 });
  return res.data?.mataPelajaran || [];
};

const topicsFetcher = async () => {
  const res = await apiClient.get('/materi', { timeout: 20000 });
  return res.data?.materi || [];
};

export function DataProvider({ children }: DataProviderProps) {
  // Use SWR with long deduping interval to prevent redundant fetches
  const { 
    data: levels = [], 
    error: levelsError,
    isLoading: levelsLoading,
    mutate: mutateLevels 
  } = useSWR<Level[]>('shared-levels', levelsFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 120000, // 2 minutes - shared data changes less frequently
  });

  const { 
    data: subjects = [], 
    error: subjectsError,
    isLoading: subjectsLoading,
    mutate: mutateSubjects 
  } = useSWR<Subject[]>('shared-subjects', subjectsFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 120000,
  });

  const { 
    data: topics = [], 
    error: topicsError,
    isLoading: topicsLoading,
    mutate: mutateTopics 
  } = useSWR<Topic[]>('shared-topics', topicsFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 120000,
  });

  const refreshLevels = useCallback(async () => {
    await mutateLevels();
  }, [mutateLevels]);

  const refreshSubjects = useCallback(async () => {
    await mutateSubjects();
  }, [mutateSubjects]);

  const refreshTopics = useCallback(async () => {
    await mutateTopics();
  }, [mutateTopics]);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      mutateLevels(),
      mutateSubjects(),
      mutateTopics(),
    ]);
  }, [mutateLevels, mutateSubjects, mutateTopics]);

  const loading = levelsLoading || subjectsLoading || topicsLoading;
  const error = levelsError?.message || subjectsError?.message || topicsError?.message || null;

  const value: DataContextType = {
    levels,
    subjects,
    topics,
    loading,
    error,
    refreshLevels,
    refreshSubjects,
    refreshTopics,
    refreshAll,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useSharedData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useSharedData must be used within a DataProvider');
  }
  return context;
}
