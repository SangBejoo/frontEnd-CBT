import { useState, useCallback, useEffect, useMemo } from 'react';
import { useToast } from '@chakra-ui/react';
import useSWR from 'swr';
import apiClient from '../services/api';
import { Question, Level, Subject, Topic } from '../types';

export interface UseQuestionsOptions {
  autoFetch?: boolean;
}

// Single fetcher for questions - levels/subjects/topics are derived from question.materi
const questionsFetcher = async (url: string) => {
  const response = await apiClient.get<any>(url, { timeout: 30000 });
  return response.data?.soal || [];
};

// Separate fetcher for topics (needed for the form dropdown)
const topicsFetcher = async (url: string) => {
  const response = await apiClient.get<any>(url, { timeout: 20000 });
  return response.data?.materi || [];
};

export function useQuestions(options: UseQuestionsOptions = { autoFetch: true }) {
  const toast = useToast();

  // Only fetch questions and topics - levels/subjects can be derived from questions
  const { data: questions, error: questionsError, isLoading: questionsLoading, mutate: mutateQuestions } = useSWR(
    options.autoFetch !== false ? '/questions' : null,
    questionsFetcher,
    { 
      revalidateOnFocus: false, 
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // Cache for 1 minute
    }
  );

  // Topics are needed for the create/edit form dropdown
  const { data: topicsData, isLoading: topicsLoading } = useSWR(
    options.autoFetch !== false ? '/materi' : null,
    topicsFetcher,
    { 
      revalidateOnFocus: false, 
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // Cache for 1 minute
    }
  );

  // Derive levels from questions data - no extra API call needed!
  const levels = useMemo<Level[]>(() => {
    if (!questions || !Array.isArray(questions)) return [];
    const levelMap = new Map<number, Level>();
    for (const q of questions) {
      if (q.materi?.tingkat?.id && !levelMap.has(q.materi.tingkat.id)) {
        levelMap.set(q.materi.tingkat.id, q.materi.tingkat);
      }
    }
    return Array.from(levelMap.values());
  }, [questions]);

  // Derive subjects from questions data - no extra API call needed!
  const subjects = useMemo<Subject[]>(() => {
    if (!questions || !Array.isArray(questions)) return [];
    const subjectMap = new Map<number, Subject>();
    for (const q of questions) {
      if (q.materi?.mataPelajaran?.id && !subjectMap.has(q.materi.mataPelajaran.id)) {
        subjectMap.set(q.materi.mataPelajaran.id, q.materi.mataPelajaran);
      }
    }
    return Array.from(subjectMap.values());
  }, [questions]);

  // Topics from API (needed for form with full list)
  const topics = useMemo<Topic[]>(() => {
    return topicsData || [];
  }, [topicsData]);

  useEffect(() => {
    if (questionsError) {
      toast({
        title: 'Error',
        description: 'Gagal memuat soal',
        status: 'error',
      });
    }
  }, [questionsError, toast]);

  // For backward compatibility, return questions as state
  const [questionsState, setQuestionsState] = useState<Question[]>([]);
  
  // Also expose setQuestions for direct manipulation
  const setQuestions = useCallback((updater: Question[] | ((prev: Question[]) => Question[])) => {
    setQuestionsState(prev => {
      if (typeof updater === 'function') {
        return updater(prev);
      }
      return updater;
    });
  }, []);

  useEffect(() => {
    if (questions) setQuestionsState(questions);
  }, [questions]);

  const createQuestion = useCallback(
    async (data: Partial<Question>) => {
      try {
        const response = await apiClient.post<any>('/questions', data);
        const newQuestion = response.data?.soal || response.data?.data || response.data;
        setQuestions((prev) => [...prev, newQuestion]);
        // Revalidate cache
        mutateQuestions();
        return newQuestion;
      } catch (error: any) {
        const message =
          error.response?.data?.message || error.message || 'Gagal membuat soal';
        toast({
          title: 'Error',
          description: message,
          status: 'error',
        });
        throw error;
      }
    },
    [toast, mutateQuestions, setQuestions]
  );

  const updateQuestion = useCallback(
    async (id: number, data: Partial<Question>) => {
      try {
        const response = await apiClient.put<any>(`/questions/${id}`, data);
        const updatedQuestion = response.data?.soal || response.data?.data || response.data;
        setQuestions((prev) =>
          prev.map((q) => (q.id === id ? updatedQuestion : q))
        );
        return updatedQuestion;
      } catch (error: any) {
        const message =
          error.response?.data?.message ||
          error.message ||
          'Gagal update soal';
        toast({
          title: 'Error',
          description: message,
          status: 'error',
        });
        throw error;
      }
    },
    [toast, setQuestions]
  );

  const deleteQuestion = useCallback(
    async (id: number) => {
      try {
        await apiClient.delete(`/questions/${id}`);
        setQuestions((prev) => prev.filter((q) => q.id !== id));
        toast({
          title: 'Berhasil',
          description: 'Soal berhasil dihapus',
          status: 'success',
        });
      } catch (error: any) {
        const message =
          error.response?.data?.message || error.message || 'Gagal hapus soal';
        toast({
          title: 'Error',
          description: message,
          status: 'error',
        });
        throw error;
      }
    },
    [toast, setQuestions]
  );

  const uploadImage = useCallback(
    async (questionId: number, files: FileList) => {
      try {
        const uploadPromises = Array.from(files).map(async (file, index) => {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });

          // Remove data:image/...;base64, prefix
          const imageBytes = base64.split(',')[1];

          return apiClient.post<any>(`/questions/${questionId}/images`, {
            imageBytes,
            namaFile: file.name,
            urutan: index,
            keterangan: '',
          });
        });

        await Promise.all(uploadPromises);

        toast({
          title: 'Berhasil',
          description: 'Gambar berhasil diupload',
          status: 'success',
        });
      } catch (error: any) {
        const message =
          error.response?.data?.message ||
          error.message ||
          'Gagal upload gambar';
        toast({
          title: 'Error',
          description: message,
          status: 'error',
        });
        throw error;
      }
    },
    [toast]
  );

  const deleteImage = useCallback(
    async (questionId: number, imageId: number) => {
      try {
        await apiClient.delete(`/questions/images/${imageId}`);
        setQuestions((prev) =>
          prev.map((q) =>
            q.id === questionId
              ? {
                  ...q,
                  gambar: q.gambar.filter((img) => img.id !== imageId),
                }
              : q
          )
        );
        toast({
          title: 'Berhasil',
          description: 'Gambar berhasil dihapus',
          status: 'success',
        });
      } catch (error: any) {
        const message =
          error.response?.data?.message ||
          error.message ||
          'Gagal hapus gambar';
        toast({
          title: 'Error',
          description: message,
          status: 'error',
        });
        throw error;
      }
    },
    [toast, setQuestions]
  );

  return {
    questions: questionsState,
    levels,
    subjects,
    topics,
    loading: questionsLoading || topicsLoading,
    fetchQuestions: () => mutateQuestions(), // Trigger revalidation
    fetchLevels: () => {}, // No-op, derived from questions
    fetchSubjects: () => {}, // No-op, derived from questions
    fetchTopics: () => {}, // No-op for now
    createQuestion,
    updateQuestion,
    deleteQuestion,
    uploadImage,
    deleteImage,
  };
}
