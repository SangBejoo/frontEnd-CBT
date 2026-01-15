'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box,
  Button,
  RadioGroup,
  Radio,
  VStack,
  Heading,
  Container,
  useToast,
  Card,
  CardBody,
  Text,
  HStack,
  Badge,
  SimpleGrid,
  Flex,
  Image,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Stat,
  StatLabel,
  StatNumber,
  StatGroup,
  Spinner,
} from '@chakra-ui/react';
import axios from 'axios';
import { useAuth } from '../../../auth-context';
import { DndContext, DragEndEvent, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import DragDropQuestion from '../../components/DragDropQuestion';

interface Question {
  id: number;
  nomorUrut: number;
  questionType: string;
  isAnswered: boolean;
  materi: {
    nama: string;
    mataPelajaran: {
      nama: string;
    };
    tingkat: {
      nama: string;
    };
  };
  // Multiple Choice fields
  mcId?: number;
  mcPertanyaan?: string;
  mcOpsiA?: string;
  mcOpsiB?: string;
  mcOpsiC?: string;
  mcOpsiD?: string;
  mcJawabanDipilih?: string;
  mcGambar?: Array<{
    id: number;
    namaFile: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
    urutan: number;
    keterangan?: string;
    createdAt: string;
  }>;
  // Drag-Drop fields
  ddId?: number;
  ddPertanyaan?: string;
  ddDragType?: string;
  ddItems?: Array<{
    id: number;
    label: string;
    imageUrl?: string;
    urutan: number;
  }>;
  ddSlots?: Array<{
    id: number;
    label: string;
    imageUrl?: string;
    urutan: number;
  }>;
  ddUserAnswer?: Record<number, number>;
  // Legacy fields for backward compatibility
  pertanyaan?: string;
  opsiA?: string;
  opsiB?: string;
  opsiC?: string;
  opsiD?: string;
  jawabanDipilih?: string;
  gambar?: Array<{
    id: number;
    namaFile: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
    urutan: number;
    keterangan?: string;
    createdAt: string;
  }>;
}

interface TestSessionData {
  session_token: string;
  soal: Question[];
  total_soal: number;
  current_nomor_urut: number;
  dijawab_count: number;
  is_answered_status: boolean[];
  batas_waktu?: string;
  batasWaktu?: string;
  BatasWaktu?: string;
  durasi_menit?: number;
  waktu_mulai?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE + '/v1/test-sessions';

export default function TestPage() {
  const params = useParams();
  const token = params.token as string;
  const router = useRouter();
  const toast = useToast();
  const hasFetchedRef = useRef(false);
  const { isLoading: isAuthLoading } = useAuth();

  const [sessionData, setSessionData] = useState<TestSessionData | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [dragDropAnswers, setDragDropAnswers] = useState<Record<number, number[]>>({});  // questionId -> ordered item IDs (for ORDERING) - LEGACY
  const [orderingMaps, setOrderingMaps] = useState<Record<number, Record<number, number>>>({}); // questionId -> {itemId: slotId} - NEW: Direct map for ORDERING
  const [matchingAnswers, setMatchingAnswers] = useState<Record<number, Record<number, number[]>>>({}); // questionId -> { slotId: itemId[] } (for MATCHING)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [isAutoSubmitting, setIsAutoSubmitting] = useState(false);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  // Load state from localStorage on mount
  useEffect(() => {
    if (mounted && token) {
      const savedState = localStorage.getItem(`test_session_${token}`);
      if (savedState) {
        try {
          const parsed = JSON.parse(savedState);
          setCurrentQuestionIndex(parsed.currentQuestionIndex || 0);
          setAnswers(parsed.answers || {});
        } catch (error) {
          console.error('Error loading saved state:', error);
        }
      }
    }
  }, [mounted, token]);

  // Save state to localStorage when answers or currentQuestionIndex changes
  useEffect(() => {
    if (mounted && token && sessionData) {
      localStorage.setItem(`test_session_${token}`, JSON.stringify({
        currentQuestionIndex,
        answers,
      }));
    }
  }, [mounted, token, currentQuestionIndex, answers, sessionData]);

  useEffect(() => {
    if (!token) {
      toast({ title: 'Invalid session token', status: 'error' });
      router.push('/student');
      return;
    }
    // Only fetch once to prevent double calls
    if (!hasFetchedRef.current && !isAuthLoading) {
      hasFetchedRef.current = true;
      fetchAllQuestions();
    }
  }, [token, isAuthLoading]);

  // Countdown timer effect - simplified
  useEffect(() => {
    // Check multiple possible field names for batas_waktu (protobuf JSON naming variations)
    const batasWaktuValue = sessionData?.batas_waktu || sessionData?.batasWaktu || sessionData?.BatasWaktu;
    if (!batasWaktuValue) {
      return;
    }

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const batasWaktu = new Date(batasWaktuValue).getTime();
      const remaining = Math.max(0, batasWaktu - now);

      setTimeRemaining(remaining);

      // Debug: log when time is running low
      if (remaining <= 10000 && remaining > 0) { // Last 10 seconds
      }

      if (remaining === 0 && !isAutoSubmitting && !submitting) {
        setIsTimeUp(true);
        setIsAutoSubmitting(true);
        clearInterval(timer);
        toast({ title: 'Waktu telah habis! Otomatis menyimpan...', status: 'warning' });
        setTimeout(() => {
          confirmFinish(true);
        }, 1000);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [sessionData?.batas_waktu, sessionData?.batasWaktu, sessionData?.BatasWaktu, submitting, isAutoSubmitting]);

  // Format remaining time for display
  const formatTimeRemaining = (ms: number | null) => {
    if (ms === null || ms === 0) return '00:00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  // Get timer color based on remaining time
  const getTimerColor = () => {
    if (!timeRemaining) return 'red';
    const totalSeconds = Math.floor(timeRemaining / 1000);
    if (totalSeconds <= 60) return 'red';
    if (totalSeconds <= 300) return 'orange'; // 5 minutes
    return 'green';
  };

  // Drag-drop handlers
  const handleDragEnd = (event: DragEndEvent, questionId: number, items: any[], dragType: string) => {
    const { active, over } = event;
    
    if (!over) return;
    
    if (dragType === 'MATCHING' || dragType === 'matching') {
      // For MATCHING: active.id is itemId, over.id is slotId
      const itemId = Number(active.id);
      const slotId = Number(over.id);
      
      // Get current state directly to ensure we're not missing items
      setMatchingAnswers(prev => {
        // Start with existing slots for this question
        const currentSlots = { ...(prev[questionId] || {}) };
        
        // Remove this item from ALL slots first
        Object.keys(currentSlots).forEach(sId => {
          const sid = Number(sId);
          currentSlots[sid] = (currentSlots[sid] || []).filter(id => id !== itemId);
          // Clean up empty slot arrays
          if (currentSlots[sid].length === 0) {
            delete currentSlots[sid];
          }
        });
        
        // Add item to the new slot
        if (!currentSlots[slotId]) {
          currentSlots[slotId] = [];
        }
        currentSlots[slotId].push(itemId);
        
        const updated = {
          ...prev,
          [questionId]: currentSlots
        };
        
        // Build answer map and submit immediately (like multiple choice)
        const answerMap: Record<number, number> = {};
        Object.entries(currentSlots).forEach(([sId, itemIds]) => {
          if (Array.isArray(itemIds)) {
            itemIds.forEach(iId => {
              answerMap[iId] = Number(sId);
            });
          }
        });
        
        // Submit immediately after state update
        handleDragDropSubmit(questionId, dragType, answerMap);
        
        return updated;
      });
    } else {
      // For ORDERING: reorder items
      if (active.id === over.id) return;
      
      const currentOrder = dragDropAnswers[questionId] || (currentQuestion.ddItems || []).map(item => item.id);
      const oldIndex = currentOrder.indexOf(Number(active.id));
      const newIndex = currentOrder.indexOf(Number(over.id));
      
      const newOrder = arrayMove(currentOrder, oldIndex, newIndex);
      setDragDropAnswers(prev => {
        const updated = {
          ...prev,
          [questionId]: newOrder
        };
        
        // Build answer map and submit immediately (like multiple choice)
        const answerMap: Record<number, number> = {};
        newOrder.forEach((itemId, position) => {
          answerMap[position] = itemId;
        });
        
        // Submit immediately after state update
        handleDragDropSubmit(questionId, dragType, answerMap);
        
        return updated;
      });
    }
  };

  // Sortable Item Component (for ORDERING)
  const SortableItem = ({ id, children }: { id: number; children: React.ReactNode }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <Box ref={setNodeRef} style={style} {...attributes} {...listeners}>
        {children}
      </Box>
    );
  };
  
  // Draggable Item Component (for MATCHING)
  const DraggableItem = ({ id, children }: { id: number; children: React.ReactNode }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <Box ref={setNodeRef} style={style} {...attributes} {...listeners}>
        {children}
      </Box>
    );
  };
  
  // Droppable Slot Component (for MATCHING)
  const DroppableSlot = ({ id, children }: { id: number; children: React.ReactNode }) => {
    const {
      setNodeRef,
      isOver,
    } = useSortable({ id });

    return (
      <Box 
        ref={setNodeRef}
        borderColor={isOver ? 'blue.500' : 'gray.300'}
        bg={isOver ? 'blue.50' : 'gray.50'}
        transition="all 0.2s"
      >
        {children}
      </Box>
    );
  };

  const fetchAllQuestions = async () => {
    try {
      // Ensure auth token is set before making request
      const authToken = localStorage.getItem('auth_token');
      if (authToken && !axios.defaults.headers.common['Authorization']) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
      }
      
      const response = await axios.get(`${API_BASE}/${token}/questions`);
      const data = response.data;
      
      // Transform response to match expected structure
      const transformedData = {
        session_token: data.sessionToken || data.session_token,
        soal: data.questions || data.soal || [],
        total_soal: data.totalSoal || data.total_soal,
        current_nomor_urut: data.currentNomorUrut || data.current_nomor_urut,
        dijawab_count: data.dijawabCount || data.dijawab_count,
        is_answered_status: data.isAnsweredStatus || data.is_answered_status,
        batas_waktu: data.batasWaktu || data.batas_waktu,
        durasi_menit: data.durasiMenit || data.durasi_menit,
        waktu_mulai: data.waktuMulai || data.waktu_mulai,
      };
      
      setSessionData(transformedData);
      
      // Handle empty or undefined soal array
      if (!transformedData.soal || !Array.isArray(transformedData.soal)) {
        console.error('Invalid response structure:', data);
        toast({ title: 'No questions available', status: 'error' });
        setLoading(false);
        return;
      }
      
      // Load saved state from localStorage first
      const savedState = localStorage.getItem(`test_session_${token}`);
      let savedAnswers: Record<number, string> = {};
      let savedIndex = 0;
      
      if (savedState) {
        try {
          const parsed = JSON.parse(savedState);
          savedAnswers = parsed.answers || {};
          savedIndex = parsed.currentQuestionIndex || 0;
        } catch (e) {
          console.error('Error parsing saved state:', e);
        }
      }
      
      // Merge server answers with saved answers (prefer saved answers)
      const mergedAnswers: Record<number, string> = { ...savedAnswers };
      transformedData.soal.forEach((q: Question) => {
        if (q.jawabanDipilih && q.jawabanDipilih !== 'JAWABAN_INVALID' && !mergedAnswers[q.nomorUrut]) {
          mergedAnswers[q.nomorUrut] = q.jawabanDipilih;
        }
      });
      
      setAnswers(mergedAnswers);
      setCurrentQuestionIndex(savedIndex);
      
      // Save merged state
      localStorage.setItem(`test_session_${token}`, JSON.stringify({
        currentQuestionIndex: savedIndex,
        answers: mergedAnswers,
      }));
    } catch (error) {
      console.error('Error fetching questions:', error);
      toast({ title: 'Error loading questions', status: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = async (questionId: number, answer: string) => {
    setAnswers({ ...answers, [questionId]: answer });
    // Submit answer immediately without refetching all
    try {
      // Ensure auth token is set before making request
      const authToken = localStorage.getItem('auth_token');
      if (authToken && !axios.defaults.headers.common['Authorization']) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
      }
      
      await axios.post(`${API_BASE}/${token}/answers`, {
        nomor_urut: questionId,
        jawaban_dipilih: answer,
      });
      // Update dijawab_count locally
      if (sessionData) {
        setSessionData({
          ...sessionData,
          dijawab_count: Object.keys({ ...answers, [questionId]: answer }).length,
        });
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
      toast({ title: 'Error menyimpan jawaban', status: 'error' });
    }
  };

  const handleDragDropSubmit = async (questionId: number, dragType: string, answerMapParam?: Record<number, number>) => {
    try {
      const authToken = localStorage.getItem('auth_token');
      if (authToken && !axios.defaults.headers.common['Authorization']) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
      }

      let answerMap: Record<number, number> = answerMapParam || {};

      // If answerMap not provided as parameter, build it from state
      if (!answerMapParam) {
        if (dragType === 'ORDERING' || dragType === 'ordering') {
          // For ORDERING: map position (0, 1, 2...) to item ID
          const order = dragDropAnswers[questionId];
          if (order && order.length > 0) {
            order.forEach((itemId, position) => {
              answerMap[position] = itemId;
            });
          }
        } else {
          // For MATCHING: flatten the array structure to map Item ID to Slot ID
          // Backend expects map<ItemId, SlotId>
          const matchingData = matchingAnswers[questionId] || {};
          
          Object.entries(matchingData).forEach(([slotId, itemIds]) => {
            if (Array.isArray(itemIds)) {
              itemIds.forEach(itemId => {
                answerMap[itemId] = Number(slotId);
              });
            }
          });
        }
      }

      // Only submit if there's an answer
      if (Object.keys(answerMap).length > 0) {
        
        await axios.post(`${API_BASE}/${token}/drag-drop-answers`, {
          nomor_urut: questionId,
          answer: answerMap,
        });

        // Mark as answered
        if (sessionData) {
          const updatedQuestions = sessionData.soal.map(q => 
            q.nomorUrut === questionId ? { ...q, isAnswered: true } : q
          );
          setSessionData({
            ...sessionData,
            soal: updatedQuestions,
          });
        }
      }
    } catch (error) {
      console.error('Error submitting drag-drop answer:', error);
      toast({ title: 'Error menyimpan jawaban drag-drop', status: 'error' });
    }
  };

  const handleFinish = () => {
    setShowConfirmModal(true);
  };

  const handleConfirmFinish = () => {
    setShowConfirmModal(false);
    confirmFinish();
  };

  const handleCancelFinish = () => {
    setShowConfirmModal(false);
  };

  const confirmFinish = async (isAutoSubmit = false) => {
    setSubmitting(true);
    try {
      // Ensure auth token is set before making request
      const authToken = localStorage.getItem('auth_token');
      if (authToken && !axios.defaults.headers.common['Authorization']) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
      }
      
      await axios.post(`${API_BASE}/${token}/complete`);
      if (!isAutoSubmit) {
        toast({ title: 'Tes selesai!', status: 'success' });
      }
      // Clear localStorage after completing test
      localStorage.removeItem(`test_session_${token}`);
      if (!isAutoSubmit) {
        toast({ title: 'Tes selesai!', status: 'success' });
      }
      // Clear localStorage after completing test
      localStorage.removeItem(`test_session_${token}`);
      // Small delay before redirect
      setTimeout(() => {
        router.push(`/student/results/${token}`);
      }, 500);
    } catch (error) {
      console.error('Error completing test:', error);
      if (!isAutoSubmit) {
        toast({ title: 'Error menyelesaikan tes', status: 'error' });
      } else {
        // For auto-submit, try again after a delay
        setTimeout(() => {
          confirmFinish(true);
        }, 2000);
      }
    } finally {
      setSubmitting(false);
      onClose();
    }
  };

  const goToQuestion = (index: number) => {
    setCurrentQuestionIndex(index);
  };

  const goToNextQuestion = () => {
    if (currentQuestionIndex < sessionData!.soal.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  if (!mounted) {
    return (
      <Container maxW="container.md" py={10} suppressHydrationWarning>
        <Text>Loading question...</Text>
      </Container>
    );
  }

  if (loading || isAuthLoading) {
    return (
      <Container maxW="container.md" py={10}>
        <Text>Loading question...</Text>
      </Container>
    );
  }

  if (!sessionData?.soal || sessionData.soal.length === 0) {
    return (
      <Container maxW="container.md" py={10}>
        <Text>Tidak ada soal untuk tes ini.</Text>
        <Button onClick={() => router.push('/student')} mt={4}>
          Kembali
        </Button>
      </Container>
    );
  }

  const currentQuestion = sessionData.soal[currentQuestionIndex];
  const getQuestionStatus = (index: number) => {
    const nomorUrut = sessionData.soal[index].nomorUrut;
    const question = sessionData.soal[index];
    
    // Check multiple choice answer
    if (answers[nomorUrut]) return 'answered';
    
    // Check drag-drop answers
    if (question.questionType === 'QUESTION_TYPE_DRAG_DROP' || question.ddPertanyaan) {
      if (question.ddDragType === 'MATCHING' || question.ddDragType === 'matching') {
        // Check if any items are placed in slots
        if (matchingAnswers[nomorUrut] && Object.keys(matchingAnswers[nomorUrut]).length > 0) {
          return 'answered';
        }
      } else {
        // Check if ordering items are placed (using orderingMaps)
        if (orderingMaps[nomorUrut] && Object.keys(orderingMaps[nomorUrut]).length > 0) {
          return 'answered';
        }
      }
    }
    
    return 'unanswered';
  };

  const handleClearAnswer = async () => {
    try {
      await axios.post(`${API_BASE}/${token}/clear-answer`, {
        nomor_urut: currentQuestion.nomorUrut,
      });
      
      // Clear based on question type
      if (currentQuestion.questionType === 'QUESTION_TYPE_DRAG_DROP' || currentQuestion.ddPertanyaan) {
        // For drag-drop questions
        if (currentQuestion.ddDragType === 'MATCHING' || currentQuestion.ddDragType === 'matching') {
          // Clear matching answers
          const newMatchingAnswers = { ...matchingAnswers };
          delete newMatchingAnswers[currentQuestion.nomorUrut];
          setMatchingAnswers(newMatchingAnswers);
        } else {
          // Clear ordering answers (using orderingMaps)
          const newOrderingMaps = { ...orderingMaps };
          delete newOrderingMaps[currentQuestion.nomorUrut];
          setOrderingMaps(newOrderingMaps);
        }
      } else {
        // Clear multiple choice answer
        const newAnswers = { ...answers };
        delete newAnswers[currentQuestion.nomorUrut];
        setAnswers(newAnswers);
      }
      
      // Update dijawab_count locally
      if (sessionData) {
        let newCount = 0;
        Object.keys(answers).forEach(key => {
          if (Number(key) !== currentQuestion.nomorUrut) {
            newCount++;
          }
        });
        setSessionData({
          ...sessionData,
          dijawab_count: newCount,
        });
      }
      
      toast({
        title: 'Jawaban dibatalkan',
        status: 'success',
        duration: 2,
      });
    } catch (error) {
      console.error('Error clearing answer:', error);
      toast({ title: 'Error membatalkan jawaban', status: 'error' });
    }
  };

  const getDragDropQuestionProps = () => {
    const q = currentQuestion;
    const dragType = (q.ddDragType || 'ORDERING').toLowerCase() as 'ordering' | 'matching';
    
    // 1. Prepare Question Data
    const questionProps = {
      id: q.id,
      pertanyaan: q.ddPertanyaan || q.pertanyaan || '',
      dragType: dragType,
      items: (q.ddItems || []).map(item => ({
        id: item.id,
        label: item.label,
        imageUrl: item.imageUrl,
        urutan: item.urutan
      })),
      slots: (q.ddSlots || []).map(slot => ({
        id: slot.id,
        label: slot.label,
        urutan: slot.urutan
      }))
    };

    // 2. Prepare User Answer Data
    let userAnswerMap: Record<number, number> = {};

    if (dragType === 'matching') {
      const matchingData = matchingAnswers[q.nomorUrut] || {};
      // matchingData is { slotId: [itemId1, itemId2] }
      Object.entries(matchingData).forEach(([slotId, itemIds]) => {
        if (Array.isArray(itemIds)) {
          itemIds.forEach(itemId => {
            userAnswerMap[itemId] = Number(slotId);
          });
        }
      });
    } else {
      // ORDERING - Use direct map from orderingMaps state
      const existingMap = orderingMaps[q.nomorUrut] || {};
      userAnswerMap = { ...existingMap };
    }

    // 3. Handle Answer Change
    const handleAnswerChange = (newAnswerMap: Record<number, number>) => {
      // Determine dragType (sometimes q.ddDragType might be capitalized)
      const isMatching = dragType === 'matching';

      if (isMatching) {
        // Convert { itemId: slotId } -> { slotId: [itemId...] }
        const newMatching: Record<number, number[]> = {};
        Object.entries(newAnswerMap).forEach(([itemIdStr, slotId]) => {
          const itemId = Number(itemIdStr);
          if (!newMatching[slotId]) newMatching[slotId] = [];
          newMatching[slotId].push(itemId);
        });
        
        setMatchingAnswers(prev => ({ ...prev, [q.nomorUrut]: newMatching }));
        
        // Submit
        handleDragDropSubmit(q.nomorUrut, 'MATCHING', newAnswerMap);
      } else {
        // ORDERING - Store direct itemId->slotId map using orderingMaps
        // This preserves exact slot positions without lossy array conversion
        
        setOrderingMaps(prev => {
          const existingMap = prev[q.nomorUrut] || {};
          const mergedMap = { ...existingMap, ...newAnswerMap };
          
          setTimeout(() => {
            handleDragDropSubmit(q.nomorUrut, 'ORDERING', mergedMap);
          }, 0);
          
          return { ...prev, [q.nomorUrut]: mergedMap };
        });
      }
    };

    // Handler for removing an item (ORDERING only)
    const handleRemoveItem = (itemId: number) => {
      setOrderingMaps(prev => {
        const existingMap = { ...(prev[q.nomorUrut] || {}) };
        delete existingMap[itemId];
        
        setTimeout(() => {
          handleDragDropSubmit(q.nomorUrut, 'ORDERING', existingMap);
        }, 0);
        
        return { ...prev, [q.nomorUrut]: existingMap };
      });
    };

    return {
      question: questionProps,
      userAnswer: userAnswerMap,
      onAnswerChange: handleAnswerChange,
      onRemoveItem: dragType === 'ordering' ? handleRemoveItem : undefined,
    };
  };

  return (
    <Container maxW="container.xl" py={6}>
      {/* Timer Display - Simple */}
      <Box textAlign="center" mb={4} p={4} bg={isTimeUp ? 'red.50' : 'blue.50'} borderRadius="md" borderWidth="2px" borderColor={isTimeUp ? 'red.200' : 'blue.200'}>
        <Text fontSize="sm" color="gray.600" mb={1}>Sisa Waktu</Text>
        <Text fontSize="2xl" fontFamily="mono" fontWeight="bold" color={getTimerColor()}>
          {isTimeUp ? '⏰ WAKTU HABIS!' : formatTimeRemaining(timeRemaining)}
        </Text>
      </Box>

      <Flex gap={6} direction={{ base: 'column', lg: 'row' }}>
        {/* Main Question Area */}
        <Box flex="1">
          <Card bg="orange.50" borderWidth="2px" borderColor="orange.200" mb={4}>
            <CardBody>
              <HStack spacing={4}>
                <Box bg="orange.500" p={3} borderRadius="md" color="white" fontWeight="bold" fontSize="lg">
                  CBT
                </Box>
                <VStack align="start" spacing={0}>
                  <Text fontWeight="bold" fontSize="lg">
                    {currentQuestion.materi.mataPelajaran.nama.toUpperCase()} {currentQuestion.materi.tingkat.nama} SD KELAS {currentQuestion.materi.tingkat.nama === '1' ? 'I' : currentQuestion.materi.tingkat.nama === '2' ? 'II' : currentQuestion.materi.tingkat.nama === '3' ? 'III' : 'IV'}
                  </Text>
                  <Text fontSize="sm" color="gray.600">
                    {currentQuestion.materi.nama}
                  </Text>
                </VStack>
                <Box ml="auto">
                  <Button
                    size="sm"
                    colorScheme="orange"
                    variant="outline"
                    onClick={onOpen}
                  >
                    Daftar Soal
                  </Button>
                </Box>
              </HStack>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <VStack spacing={6} align="stretch">
                <Badge alignSelf="flex-start" colorScheme="blue" fontSize="md" px={3} py={1}>
                  Soal No. {currentQuestion.nomorUrut}
                </Badge>

                {/* Multiple Choice Question */}
                {(currentQuestion.questionType === 'QUESTION_TYPE_MULTIPLE_CHOICE' || currentQuestion.mcPertanyaan) && (
                  <>
                    <Text fontSize="lg" fontWeight="medium">
                      {currentQuestion.mcPertanyaan || currentQuestion.pertanyaan}
                    </Text>

                    {((currentQuestion.mcGambar && currentQuestion.mcGambar.length > 0) || 
                      (currentQuestion.gambar && currentQuestion.gambar.length > 0)) && (
                      <Box>
                        <Text fontSize="sm" color="gray.600" mb={2}>
                          Perhatikan gambar dibawah ini
                        </Text>
                        <VStack spacing={3}>
                          {(currentQuestion.mcGambar || currentQuestion.gambar || [])
                            .sort((a, b) => a.urutan - b.urutan)
                            .map((img) => (
                              <Box key={img.id} borderWidth="1px" borderRadius="md" p={2} bg="gray.50">
                                <Image
                                  src={img.filePath || ''}
                                  alt={img.keterangan || 'Gambar soal'}
                                  maxH="300px"
                                  objectFit="contain"
                                  mx="auto"
                                />
                                {img.keterangan && (
                                  <Text fontSize="sm" color="gray.600" mt={2} textAlign="center">
                                    {img.keterangan}
                                  </Text>
                                )}
                              </Box>
                            ))}
                        </VStack>
                      </Box>
                    )}

                    <RadioGroup value={answers[currentQuestion.nomorUrut] || ''}>
                      <VStack spacing={3} align="stretch">
                        <Box
                          p={3}
                          borderWidth="1px"
                          borderRadius="md"
                          cursor="pointer"
                          _hover={{ bg: 'gray.50' }}
                          bg={answers[currentQuestion.nomorUrut] === 'A' ? 'orange.50' : 'white'}
                          onClick={() => handleAnswerChange(currentQuestion.nomorUrut, 'A')}
                        >
                          <Radio value="A">A. {currentQuestion.mcOpsiA || currentQuestion.opsiA}</Radio>
                        </Box>
                        <Box
                          p={3}
                          borderWidth="1px"
                          borderRadius="md"
                          cursor="pointer"
                          _hover={{ bg: 'gray.50' }}
                          bg={answers[currentQuestion.nomorUrut] === 'B' ? 'orange.50' : 'white'}
                          onClick={() => handleAnswerChange(currentQuestion.nomorUrut, 'B')}
                        >
                          <Radio value="B">B. {currentQuestion.mcOpsiB || currentQuestion.opsiB}</Radio>
                        </Box>
                        <Box
                          p={3}
                          borderWidth="1px"
                          borderRadius="md"
                          cursor="pointer"
                          _hover={{ bg: 'gray.50' }}
                          bg={answers[currentQuestion.nomorUrut] === 'C' ? 'orange.50' : 'white'}
                          onClick={() => handleAnswerChange(currentQuestion.nomorUrut, 'C')}
                        >
                          <Radio value="C">C. {currentQuestion.mcOpsiC || currentQuestion.opsiC}</Radio>
                        </Box>
                        <Box
                          p={3}
                          borderWidth="1px"
                          borderRadius="md"
                          cursor="pointer"
                          _hover={{ bg: 'gray.50' }}
                          bg={answers[currentQuestion.nomorUrut] === 'D' ? 'orange.50' : 'white'}
                          onClick={() => handleAnswerChange(currentQuestion.nomorUrut, 'D')}
                        >
                          <Radio value="D">D. {currentQuestion.mcOpsiD || currentQuestion.opsiD}</Radio>
                        </Box>
                      </VStack>
                    </RadioGroup>
                  </>
                )}

                {/* Drag-Drop Question */}
                {/* Drag-Drop Question */}
                {(currentQuestion.questionType === 'QUESTION_TYPE_DRAG_DROP' || currentQuestion.ddPertanyaan) && (
                  <DragDropQuestion {...getDragDropQuestionProps()!} />
                )}
                
                {/* Legacy Inline Implementation (Disabled) */}
                {false && (currentQuestion.questionType === 'QUESTION_TYPE_DRAG_DROP' || currentQuestion.ddPertanyaan) && (
                  <>
                    {/* Question Text */}
                    <Box mb={4} p={4} bg="gray.50" borderRadius="md" borderLeftWidth="4px" borderLeftColor="blue.500">
                      <Text fontSize="xl" fontWeight="bold" color="gray.800">
                        {currentQuestion.ddPertanyaan || currentQuestion.pertanyaan}
                      </Text>
                    </Box>
                    
                    {/* Instructions */}
                    <Box p={3} bg="blue.50" borderRadius="md" mb={4}>
                      <HStack spacing={2} align="center">
                        <Box as="span" fontSize="lg">ℹ️</Box>
                        <Text fontSize="sm" fontWeight="bold" color="blue.700">
                          {currentQuestion.ddDragType === 'ORDERING' || currentQuestion.ddDragType === 'ordering' 
                            ? '🔢 Drag items untuk mengubah urutan dari atas ke bawah' 
                            : '🎯 Tarik dan letakkan gambar hewan ke kategori habitat yang benar'}
                        </Text>
                      </HStack>
                    </Box>
                    
                    {/* MATCHING Type - Horizontal Tab Layout Style */}
                    {(currentQuestion.ddDragType?.toUpperCase() === 'MATCHING') && (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(event) => handleDragEnd(event, currentQuestion.nomorUrut, currentQuestion.ddItems || [], currentQuestion.ddDragType || '')}
                      >
                        <SortableContext
                          items={[...(currentQuestion.ddItems || []).map(item => item.id), ...(currentQuestion.ddSlots || []).map(slot => slot.id)]}
                          strategy={verticalListSortingStrategy}
                        >
                          <Box>
                            {/* Items Section - Top */}
                            <Box mb={8}>
                              <Flex align="center" justify="space-between" mb={4}>
                                <HStack spacing={2}>
                                  <Box
                                    w="40px"
                                    h="40px"
                                    borderRadius="full"
                                    bg="purple.500"
                                    display="flex"
                                    alignItems="center"
                                    justifyContent="center"
                                    color="white"
                                  >
                                    <Text fontSize="xl">🐾</Text>
                                  </Box>
                                  <Text fontSize="lg" fontWeight="bold" color="gray.700">
                                    Hewan
                                  </Text>
                                </HStack>
                                <Badge colorScheme="purple" fontSize="xs" px={2} py={1}>
                                  {(currentQuestion.ddItems || []).length} Items
                                </Badge>
                              </Flex>
                              
                              <SimpleGrid columns={{ base: 2, md: 3, lg: 4 }} spacing={4}>
                                {(currentQuestion.ddItems || []).map((item) => {
                                  // Check if this item is already placed in a slot
                                  const isPlaced = matchingAnswers[currentQuestion.nomorUrut] && 
                                    Object.values(matchingAnswers[currentQuestion.nomorUrut]).some(
                                      (itemIds) => Array.isArray(itemIds) && itemIds.includes(item.id)
                                    );
                                  
                                  return (
                                    <DraggableItem key={item.id} id={item.id}>
                                      <Card
                                        variant="elevated"
                                        bg={isPlaced ? "gray.100" : "white"}
                                        borderWidth="2px"
                                        borderColor={isPlaced ? "gray.300" : "transparent"}
                                        cursor={isPlaced ? "not-allowed" : "grab"}
                                        opacity={isPlaced ? 0.4 : 1}
                                        _hover={!isPlaced ? { 
                                          shadow: '2xl', 
                                          transform: 'translateY(-4px)',
                                          borderColor: 'purple.400'
                                        } : {}}
                                        _active={!isPlaced ? { cursor: 'grabbing', transform: 'scale(0.98)' } : {}}
                                        transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                                        overflow="hidden"
                                      >
                                        <CardBody p={2} display="flex" flexDirection="column" alignItems="center" justifyContent="center" h="full">
                                          {item.imageUrl ? (
                                            <>
                                              <Box
                                                w="full"
                                                h="140px"
                                                display="flex"
                                                alignItems="center"
                                                justifyContent="center"
                                                bg="white"
                                                borderRadius="md"
                                                overflow="hidden"
                                                mb={2}
                                              >
                                                <Image 
                                                  src={item.imageUrl} 
                                                  alt={item.label} 
                                                  maxH="100%" 
                                                  maxW="100%" 
                                                  objectFit="contain" 
                                                  pointerEvents="none" 
                                                />
                                              </Box>
                                              {item.label && (
                                                <Text 
                                                  textAlign="center" 
                                                  fontSize="xs" 
                                                  color="gray.500" 
                                                  noOfLines={2}
                                                  display={item.label.length > 20 ? 'block' : 'none'} // Hide short labels like 'A' if image exists, show long ones
                                                >
                                                  {item.label}
                                                </Text>
                                              )}
                                            </>
                                          ) : (
                                            <Text 
                                              textAlign="center" 
                                              fontWeight="bold" 
                                              fontSize="md" 
                                              color={isPlaced ? "gray.400" : "gray.800"}
                                            >
                                              {item.label}
                                            </Text>
                                          )}
                                        </CardBody>
                                      </Card>
                                    </DraggableItem>
                                  );
                                })}
                              </SimpleGrid>
                            </Box>

                            {/* Category Slots Section - Bottom with Horizontal Tabs */}
                            <Box 
                              bg="white" 
                              borderRadius="xl" 
                              borderWidth="2px" 
                              borderColor="gray.200"
                              overflow="hidden"
                            >
                              {/* Horizontal Tab Headers */}
                              <Flex 
                                bg="gray.50" 
                                borderBottomWidth="2px" 
                                borderBottomColor="gray.200"
                                overflowX="auto"
                              >
                                {(currentQuestion.ddSlots || []).map((slot, index) => {
                                  const placedItemIds = (matchingAnswers[currentQuestion.nomorUrut] && matchingAnswers[currentQuestion.nomorUrut][slot.id]) || [];
                                  const itemCount = placedItemIds.length;
                                  
                                  // Icon mapping based on slot label
                                  const getSlotIcon = (label: string) => {
                                    const lower = label.toLowerCase();
                                    if (lower.includes('darat') || lower.includes('land')) return '🌳';
                                    if (lower.includes('udara') || lower.includes('air') || lower.includes('sky')) return '☁️';
                                    if (lower.includes('air') || lower.includes('water') || lower.includes('laut') || lower.includes('sea')) return '🌊';
                                    return '📍';
                                  };
                                  
                                  // Color mapping
                                  const getSlotColor = (label: string) => {
                                    const lower = label.toLowerCase();
                                    if (lower.includes('darat') || lower.includes('land')) return 'green';
                                    if (lower.includes('udara') || lower.includes('sky')) return 'blue';
                                    if (lower.includes('air') || lower.includes('water') || lower.includes('laut')) return 'cyan';
                                    return 'gray';
                                  };
                                  
                                  const slotColor = getSlotColor(slot.label);
                                  
                                  return (
                                    <DroppableSlot key={slot.id} id={slot.id}>
                                      <Box
                                        flex="1"
                                        minW="200px"
                                        borderRightWidth={index < (currentQuestion.ddSlots || []).length - 1 ? "2px" : "0"}
                                        borderRightColor="gray.200"
                                      >
                                        {/* Tab Header */}
                                        <Box
                                          p={4}
                                          bg={`${slotColor}.50`}
                                          borderBottomWidth="3px"
                                          borderBottomColor={`${slotColor}.500`}
                                        >
                                          <VStack justify="center" spacing={2}>
                                            {/* Display slot image if available */}
                                            {slot.imageUrl ? (
                                              <Box
                                                w="100px"
                                                h="100px"
                                                display="flex"
                                                alignItems="center"
                                                justifyContent="center"
                                                bg="white"
                                                borderRadius="lg"
                                                overflow="hidden"
                                                borderWidth="2px"
                                                borderColor={`${slotColor}.300`}
                                              >
                                                <Image 
                                                  src={slot.imageUrl} 
                                                  alt={slot.label} 
                                                  maxH="95px"
                                                  maxW="95px"
                                                  objectFit="contain"
                                                />
                                              </Box>
                                            ) : (
                                              <Text fontSize="3xl">{getSlotIcon(slot.label)}</Text>
                                            )}
                                            <Text 
                                              fontWeight="bold" 
                                              fontSize="md" 
                                              color={`${slotColor}.700`}
                                              textAlign="center"
                                            >
                                              {slot.label}
                                            </Text>
                                          </VStack>
                                        </Box>
                                        
                                        {/* Drop Zone Content */}
                                        <Box 
                                          p={6}
                                          minH="300px"
                                          display="flex"
                                          flexDirection="column"
                                          alignItems="center"
                                          gap={3}
                                          bg={placedItemIds.length > 0 ? `${slotColor}.50` : 'white'}
                                          borderTopWidth="1px"
                                          borderTopColor="gray.200"
                                          transition="all 0.2s ease"
                                          position="relative"
                                          _before={
                                            placedItemIds.length === 0 ? {
                                              content: '""',
                                              position: 'absolute',
                                              top: 0,
                                              left: 0,
                                              right: 0,
                                              bottom: 0,
                                              border: '2px dashed',
                                              borderColor: `${slotColor}.300`,
                                              borderRadius: 'inherit',
                                              pointerEvents: 'none',
                                              opacity: 0.5,
                                            } : {}
                                          }
                                        >
                                          {placedItemIds.length > 0 ? (
                                            <VStack spacing={3} w="full" align="stretch">
                                              {placedItemIds.map((itemId) => {
                                                const placedItem = (currentQuestion.ddItems || []).find(item => item.id === itemId);
                                                if (!placedItem) return null;
                                                
                                                return (
                                                  <Card 
                                                    key={itemId}
                                                    variant="outline"
                                                    bg={`${slotColor}.50`}
                                                    borderColor={`${slotColor}.300`}
                                                    borderWidth="2px"
                                                    cursor="pointer"
                                                    _hover={{ 
                                                      shadow: 'md',
                                                      borderColor: `${slotColor}.500`,
                                                      transform: 'translateY(-2px)',
                                                    }}
                                                    transition="all 0.2s ease"
                                                  >
                                                    <CardBody p={3}>
                                                      <VStack spacing={2}>
                                                        <HStack w="full" justify="space-between">
                                                          {placedItem.imageUrl ? (
                                                            <Box
                                                              w="60px"
                                                              h="60px"
                                                              display="flex"
                                                              alignItems="center"
                                                              justifyContent="center"
                                                              bg="white"
                                                              borderRadius="md"
                                                              borderWidth="1px"
                                                              borderColor={`${slotColor}.200`}
                                                              overflow="hidden"
                                                              flexShrink={0}
                                                            >
                                                              <Image 
                                                                src={placedItem.imageUrl} 
                                                                alt={placedItem.label} 
                                                                maxH="55px"
                                                                maxW="55px"
                                                                objectFit="contain"
                                                              />
                                                            </Box>
                                                          ) : null}
                                                          <VStack align="flex-start" spacing={0} flex={1}>
                                                            <Text 
                                                              textAlign="left" 
                                                              fontSize="sm" 
                                                              fontWeight="bold"
                                                              color={`${slotColor}.800`}
                                                            >
                                                              {placedItem.label}
                                                            </Text>
                                                            <HStack spacing={1}>
                                                              <Box
                                                                w="16px"
                                                                h="16px"
                                                                borderRadius="full"
                                                                bg={`${slotColor}.500`}
                                                                display="flex"
                                                                alignItems="center"
                                                                justifyContent="center"
                                                                color="white"
                                                                fontSize="xs"
                                                              >
                                                                ✓
                                                              </Box>
                                                              <Text fontSize="xs" color={`${slotColor}.600`} fontWeight="semibold">
                                                                Cocok
                                                              </Text>
                                                            </HStack>
                                                          </VStack>
                                                        </HStack>
                                                      </VStack>
                                                    </CardBody>
                                                  </Card>
                                                );
                                              })}
                                            </VStack>
                                          ) : (
                                            <Flex 
                                              direction="column" 
                                              align="center" 
                                              justify="center"
                                              h="full"
                                              color={`${slotColor}.400`}
                                              zIndex={0}
                                            >
                                              <Text fontSize="4xl" mb={2} opacity={0.5}>➕</Text>
                                              <Text fontSize="sm" fontStyle="italic" color={`${slotColor}.300`}>
                                                Letakkan di sini
                                              </Text>
                                            </Flex>
                                          )}
                                        </Box>
                                      </Box>
                                    </DroppableSlot>
                                  );
                                })}
                              </Flex>
                            </Box>
                          </Box>
                        </SortableContext>
                      </DndContext>
                    )}
                    
                    {/* ORDERING Type - Numbered Position Slots (like MATCHING) */}
                    {(!currentQuestion.ddDragType || currentQuestion.ddDragType?.toUpperCase() === 'ORDERING') && (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(event) => handleDragEnd(event, currentQuestion.nomorUrut, currentQuestion.ddItems || [], currentQuestion.ddDragType || '')}
                      >
                        <SortableContext
                          items={[...(currentQuestion.ddItems || []).map((item, idx) => `pos-${idx}`)]}
                          strategy={verticalListSortingStrategy}
                        >
                          <Box>
                            {/* Items Section - Top */}
                            <Box mb={8}>
                              <Flex align="center" justify="space-between" mb={4}>
                                <HStack spacing={2}>
                                  <Box
                                    w="40px"
                                    h="40px"
                                    borderRadius="full"
                                    bg="purple.500"
                                    display="flex"
                                    alignItems="center"
                                    justifyContent="center"
                                    color="white"
                                  >
                                    <Text fontSize="xl">📋</Text>
                                  </Box>
                                  <Text fontSize="lg" fontWeight="bold" color="gray.700">
                                    Item untuk Diurutkan
                                  </Text>
                                </HStack>
                                <Badge colorScheme="purple" fontSize="xs" px={2} py={1}>
                                  {(currentQuestion.ddItems || []).length} Items
                                </Badge>
                              </Flex>
                              
                              <SimpleGrid columns={{ base: 2, md: 3, lg: 4 }} spacing={4}>
                                {(currentQuestion.ddItems || []).map((item) => {
                                  // Check if this item is already placed in a position
                                  const placedPosition = dragDropAnswers[currentQuestion.nomorUrut]?.indexOf(item.id);
                                  const isPlaced = placedPosition !== undefined && placedPosition !== -1;
                                  
                                  return (
                                    <DraggableItem key={item.id} id={item.id}>
                                      <Card
                                        variant="elevated"
                                        bg={isPlaced ? "gray.100" : "white"}
                                        borderWidth="2px"
                                        borderColor={isPlaced ? "gray.300" : "transparent"}
                                        cursor={isPlaced ? "not-allowed" : "grab"}
                                        opacity={isPlaced ? 0.4 : 1}
                                        _hover={!isPlaced ? { 
                                          shadow: '2xl', 
                                          transform: 'translateY(-4px)',
                                          borderColor: 'purple.400'
                                        } : {}}
                                        _active={!isPlaced ? { cursor: 'grabbing', transform: 'scale(0.98)' } : {}}
                                        transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                                        overflow="hidden"
                                      >
                                        <CardBody p={2} display="flex" flexDirection="column" alignItems="center" justifyContent="center" h="full">
                                          {item.imageUrl ? (
                                            <>
                                              <Box
                                                w="full"
                                                h="140px"
                                                display="flex"
                                                alignItems="center"
                                                justifyContent="center"
                                                bg="white"
                                                borderRadius="md"
                                                overflow="hidden"
                                                mb={2}
                                              >
                                                <Image 
                                                  src={item.imageUrl} 
                                                  alt={item.label} 
                                                  maxH="100%" 
                                                  maxW="100%" 
                                                  objectFit="contain" 
                                                  pointerEvents="none" 
                                                />
                                              </Box>
                                              {item.label && (
                                                <Text 
                                                  textAlign="center" 
                                                  fontSize="xs" 
                                                  color="gray.500" 
                                                  noOfLines={2}
                                                  display={item.label.length > 20 ? 'block' : 'none'}
                                                >
                                                  {item.label}
                                                </Text>
                                              )}
                                            </>
                                          ) : (
                                            <Text 
                                              textAlign="center" 
                                              fontWeight="bold" 
                                              fontSize="md" 
                                              color={isPlaced ? "gray.400" : "gray.800"}
                                            >
                                              {item.label}
                                            </Text>
                                          )}
                                        </CardBody>
                                      </Card>
                                    </DraggableItem>
                                  );
                                })}
                              </SimpleGrid>
                            </Box>

                            {/* Position Slots Section - Bottom with Horizontal Tabs (like MATCHING) */}
                            <Box 
                              bg="white" 
                              borderRadius="xl" 
                              borderWidth="2px" 
                              borderColor="gray.200"
                              overflow="hidden"
                            >
                              {/* Horizontal Tab Headers */}
                              <Flex 
                                bg="gray.50" 
                                borderBottomWidth="2px" 
                                borderBottomColor="gray.200"
                                overflowX="auto"
                              >
                                {(currentQuestion.ddItems || []).map((_, index) => {
                                  const placedItemIds = dragDropAnswers[currentQuestion.nomorUrut]?.[index];
                                  const placedItem = placedItemIds ? (currentQuestion.ddItems || []).find(item => item.id === placedItemIds) : null;
                                  
                                  return (
                                    <DroppableSlot key={index} id={index + 1}>
                                      <Box
                                        flex="1"
                                        minW="180px"
                                        borderRightWidth={index < (currentQuestion.ddItems?.length || 0) - 1 ? "2px" : "0"}
                                        borderRightColor="gray.200"
                                      >
                                        {/* Tab Header */}
                                        <Box
                                          p={4}
                                          bg="blue.50"
                                          borderBottomWidth="3px"
                                          borderBottomColor="blue.500"
                                        >
                                          <VStack justify="center" spacing={2}>
                                            <Text fontSize="2xl">
                                              {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                                            </Text>
                                            <Text 
                                              fontWeight="bold" 
                                              fontSize="md" 
                                              color="blue.700"
                                              textAlign="center"
                                            >
                                              Posisi {index + 1}
                                            </Text>
                                          </VStack>
                                        </Box>
                                        
                                        {/* Drop Zone Content */}
                                        <Box 
                                          p={6}
                                          minH="250px"
                                          display="flex"
                                          flexDirection="column"
                                          alignItems="center"
                                          justifyContent="center"
                                          bg="white"
                                        >
                                          {placedItem ? (
                                            <VStack spacing={3} w="full">
                                              {placedItem.imageUrl ? (
                                                <Box
                                                  w="120px"
                                                  h="120px"
                                                  display="flex"
                                                  alignItems="center"
                                                  justifyContent="center"
                                                  bg="blue.50"
                                                  borderRadius="lg"
                                                  overflow="hidden"
                                                  borderWidth="2px"
                                                  borderColor="blue.300"
                                                >
                                                  <Image 
                                                    src={placedItem.imageUrl} 
                                                    alt={placedItem.label} 
                                                    maxH="110px"
                                                    maxW="110px"
                                                    objectFit="contain"
                                                  />
                                                </Box>
                                              ) : null}
                                              <VStack spacing={1} align="center">
                                                <HStack spacing={1}>
                                                  <Box
                                                    w="24px"
                                                    h="24px"
                                                    borderRadius="full"
                                                    bg="blue.500"
                                                    display="flex"
                                                    alignItems="center"
                                                    justifyContent="center"
                                                    color="white"
                                                    fontSize="sm"
                                                  >
                                                    ✓
                                                  </Box>
                                                  <Text fontSize="sm" color="blue.600" fontWeight="semibold">
                                                    Ditempatkan
                                                  </Text>
                                                </HStack>
                                                <Text 
                                                  fontWeight="bold" 
                                                  fontSize="sm" 
                                                  color="gray.800"
                                                  textAlign="center"
                                                >
                                                  {placedItem.label}
                                                </Text>
                                              </VStack>
                                            </VStack>
                                          ) : (
                                            <Flex 
                                              direction="column" 
                                              align="center" 
                                              justify="center"
                                              h="full"
                                              color="blue.300"
                                            >
                                              <Text fontSize="4xl" mb={2} opacity={0.5}>➕</Text>
                                              <Text fontSize="sm" fontStyle="italic" color="blue.200">
                                                Letakkan di sini
                                              </Text>
                                            </Flex>
                                          )}
                                        </Box>
                                      </Box>
                                    </DroppableSlot>
                                  );
                                })}
                              </Flex>
                            </Box>
                          </Box>
                        </SortableContext>
                      </DndContext>
                    )}
                    
                    <Text fontSize="xs" color="gray.600" fontStyle="italic" mt={3}>
                      {currentQuestion.ddDragType?.toUpperCase() === 'MATCHING'
                        ? '💡 Tip: Drag setiap item ke slot yang sesuai. Item yang sudah dipasangkan akan muncul di slot.'
                        : '💡 Tip: Drag untuk mengubah urutan. Nomor akan otomatis berubah sesuai posisi.'}
                    </Text>
                  </>
                )}

                <HStack justify="space-between" pt={4}>
                  <Button
                    onClick={goToPreviousQuestion}
                    isDisabled={currentQuestionIndex === 0}
                    colorScheme="orange"
                    variant="outline"
                    leftIcon={<Text>←</Text>}
                  >
                    Sebelumnya
                  </Button>
                  
                  {/* Clear/Retry button for current question */}
                  {getQuestionStatus(currentQuestionIndex) === 'answered' && (
                    <Button
                      colorScheme="gray"
                      variant="outline"
                      onClick={handleClearAnswer}
                      size="md"
                      leftIcon={<Text>↻</Text>}
                    >
                      Ulangi
                    </Button>
                  )}
                  
                  {currentQuestionIndex === sessionData.soal.length - 1 ? (
                    <Button
                      colorScheme="green"
                      onClick={handleFinish}
                      isLoading={submitting}
                      rightIcon={<Text>✓</Text>}
                    >
                      Selesai
                    </Button>
                  ) : (
                    <Button
                      onClick={goToNextQuestion}
                      colorScheme="purple"
                      rightIcon={<Text>→</Text>}
                    >
                      Selanjutnya
                    </Button>
                  )}
                </HStack>
              </VStack>
            </CardBody>
          </Card>
        </Box>

        {/* Question Navigation Sidebar - Desktop Only */}
        <Box width={{ base: 'full', lg: '300px' }} display={{ base: 'none', lg: 'block' }}>
          <Card position="sticky" top="20px">
            <CardBody>
              <VStack spacing={4} align="stretch">
                <Heading size="md" textAlign="center">Daftar Soal</Heading>
                <SimpleGrid columns={5} spacing={2}>
                  {sessionData.soal.map((q, index) => {
                    const status = getQuestionStatus(index);
                    return (
                      <Button
                        key={`${q.id}-${index}`}
                        onClick={() => goToQuestion(index)}
                        size="sm"
                        colorScheme={
                          currentQuestionIndex === index
                            ? 'gray'
                            : status === 'answered'
                            ? 'green'
                            : 'gray'
                        }
                        variant={currentQuestionIndex === index ? 'solid' : 'solid'}
                      >
                        {q.nomorUrut}
                      </Button>
                    );
                  })}
                </SimpleGrid>
                <HStack spacing={2} fontSize="xs" justify="center">
                  <HStack>
                    <Box w="12px" h="12px" bg="green.500" borderRadius="sm" />
                    <Text>Dijawab</Text>
                  </HStack>
                  <HStack>
                    <Box w="12px" h="12px" bg="gray.500" borderRadius="sm" />
                    <Text>Belum Dijawab</Text>
                  </HStack>
                </HStack>
              </VStack>
            </CardBody>
          </Card>
        </Box>
      </Flex>

      {/* Question Navigation Modal - Mobile */}
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Daftar Soal</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <SimpleGrid columns={5} spacing={3}>
              {sessionData.soal.map((q, index) => {
                const status = getQuestionStatus(index);
                return (
                  <Button
                    key={`${q.id}-${index}`}
                    onClick={() => {
                      goToQuestion(index);
                      onClose();
                    }}
                    colorScheme={
                      currentQuestionIndex === index
                        ? 'gray'
                        : status === 'answered'
                        ? 'green'
                        : 'gray'
                    }
                  >
                    {q.nomorUrut}
                  </Button>
                );
              })}
            </SimpleGrid>
            <HStack spacing={3} fontSize="sm" justify="center" mt={4}>
              <HStack>
                <Box w="12px" h="12px" bg="green.500" borderRadius="sm" />
                <Text>Dijawab</Text>
              </HStack>
              <HStack>
                <Box w="12px" h="12px" bg="gray.500" borderRadius="sm" />
                <Text>Belum</Text>
              </HStack>
            </HStack>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onClose}>Tutup</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Confirmation Modal */}
      <Modal isOpen={showConfirmModal} onClose={handleCancelFinish} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Konfirmasi Selesai Tes</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={6} align="stretch">
              <Box textAlign="center">
                <Text fontSize="lg" fontWeight="medium">
                  Apakah Anda yakin ingin menyelesaikan tes?
                </Text>
                <Text fontSize="sm" color="gray.600" mt={2}>
                  Pastikan semua jawaban sudah benar sebelum mengumpulkan.
                </Text>
              </Box>

              <Card>
                <CardBody>
                  <VStack spacing={4}>
                    <StatGroup width="full">
                      <Stat>
                        <StatLabel>Total Soal</StatLabel>
                        <StatNumber>{sessionData?.soal.length || 0}</StatNumber>
                      </Stat>
                      <Stat>
                        <StatLabel>Sudah Dijawab</StatLabel>
                        <StatNumber color="green.500">
                          {sessionData?.soal.reduce((count, _, index) => getQuestionStatus(index) === 'answered' ? count + 1 : count, 0) || 0}
                        </StatNumber>
                      </Stat>
                      <Stat>
                        <StatLabel>Belum Dijawab</StatLabel>
                        <StatNumber color="red.500">
                          {(sessionData?.soal.length || 0) - (sessionData?.soal.reduce((count, _, index) => getQuestionStatus(index) === 'answered' ? count + 1 : count, 0) || 0)}
                        </StatNumber>
                      </Stat>
                    </StatGroup>
                  </VStack>
                </CardBody>
              </Card>

              <Box>
                <Text fontWeight="medium" mb={3}>Status Soal:</Text>
                <SimpleGrid columns={{ base: 6, md: 8, lg: 10 }} spacing={2}>
                  {sessionData?.soal.map((q, index) => {
                    const status = getQuestionStatus(index);
                    return (
                      <Button
                        key={`${q.id}-${index}`}
                        size="sm"
                        colorScheme={
                          status === 'answered' ? 'green' : 'gray'
                        }
                        variant="solid"
                        isDisabled
                        title={status === 'answered' ? 'Sudah dijawab' : 'Belum dijawab'}
                      >
                        {q.nomorUrut}
                      </Button>
                    );
                  })}
                </SimpleGrid>
                <HStack spacing={4} fontSize="sm" justify="center" mt={3}>
                  <HStack>
                    <Box w="12px" h="12px" bg="green.500" borderRadius="sm" />
                    <Text>Dijawab</Text>
                  </HStack>
                  <HStack>
                    <Box w="12px" h="12px" bg="gray.500" borderRadius="sm" />
                    <Text>Belum Dijawab</Text>
                  </HStack>
                </HStack>
              </Box>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" onClick={handleCancelFinish} mr={3}>
              Batal
            </Button>
            <Button
              colorScheme="green"
              onClick={handleConfirmFinish}
              isLoading={submitting}
            >
              Ya, Selesai Tes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Container>
  );
}