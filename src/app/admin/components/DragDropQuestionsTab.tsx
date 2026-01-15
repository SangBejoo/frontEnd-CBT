'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import React from 'react';
import {
  Box,
  Button,
  Container,
  IconButton,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Input,
  Select,
  Textarea,
  useToast,
  HStack,
  VStack,
  Text,
  Badge,
  Heading,
  Card,
  CardBody,
  SimpleGrid,
  Flex,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Divider,
  Image,
  NumberInput,
  NumberInputField,
  Wrap,
  WrapItem,
  Tag,
  TagLabel,
  TagCloseButton,
  useBreakpointValue,
  Stack,
} from '@chakra-ui/react';
import { EditIcon, DeleteIcon, AddIcon, DragHandleIcon } from '@chakra-ui/icons';

// Types
interface DragItem {
  id?: number;
  label: string;
  imageUrl?: string;
  urutan: number;
}

interface DragSlot {
  id?: number;
  label: string;
  imageUrl?: string;
  urutan: number;
}

interface CorrectAnswer {
  itemUrutan: number;
  slotUrutan: number;
}

interface DragDropQuestionData {
  id?: number;
  pertanyaan: string;
  dragType: 'ordering' | 'matching';
  idMateri: number;
  idTingkat: number;
  pembahasan?: string;
  items: DragItem[];
  slots: DragSlot[];
  correctAnswers: CorrectAnswer[];
  materi?: {
    id: number;
    nama: string;
    mataPelajaran: { id: number; nama: string };
    tingkat: { id: number; nama: string };
  };
}

interface Topic {
  id: number;
  nama: string;
  mataPelajaran: { id: number; nama: string };
  tingkat: { id: number; nama: string };
}

// Image compression utility (max 400x400, 70% quality, under 200KB)
async function compressImage(file: File, maxWidth: number, maxHeight: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image() as HTMLImageElement;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        
        // Resize if needed
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Try WebP first, fallback to JPEG
        let result = canvas.toDataURL('image/webp', quality);
        if (!result.startsWith('data:image/webp')) {
          result = canvas.toDataURL('image/jpeg', quality);
        }
        
        resolve(result);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// API functions
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080';

async function fetchDragDropQuestions(idMateri?: number): Promise<DragDropQuestionData[]> {
  const params = new URLSearchParams();
  if (idMateri) params.append('id_materi', idMateri.toString());
  params.append('page_size', '100');
  
  const res = await fetch(`${API_BASE}/v1/soal-drag-drop?${params}`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
    },
  });
  
  if (!res.ok) {
    const error = await res.json();
    console.error('API Error:', error);
    throw new Error(error.message || 'Failed to fetch drag-drop questions');
  }
  
  const data = await res.json();
  
  // Ensure we have an array of questions
  if (!data.soal) {
    console.warn('No soal field in response:', data);
    return [];
  }
  
  // Transform the API response to match our interface
  return data.soal.map((q: any) => ({
    id: q.id,
    pertanyaan: q.pertanyaan,
    dragType: q.dragType?.toLowerCase() === 'matching' ? 'matching' : 'ordering',
    idMateri: q.materi?.id || 0,
    idTingkat: q.materi?.tingkat?.id || 0,
    pembahasan: q.pembahasan,
    items: (q.items || []).map((item: any) => ({
      id: item.id,
      label: item.label,
      imageUrl: item.imageUrl || item.image_url || '', // Handle both camelCase and snake_case
      urutan: item.urutan,
    })),
    slots: (q.slots || []).map((slot: any) => ({
      id: slot.id,
      label: slot.label,
      imageUrl: slot.imageUrl || slot.image_url || '', // Handle both camelCase and snake_case
      urutan: slot.urutan,
    })),
    correctAnswers: (q.correctAnswers || []).map((ca: any) => {
      // API returns itemId/slotId or itemUrutan/slotUrutan, we need to convert to urutan
      // Find the urutan values based on IDs
      const itemId = ca.itemId || ca.item_id;
      const slotId = ca.slotId || ca.slot_id;
      const itemUrutan = ca.itemUrutan || ca.item_urutan;
      const slotUrutan = ca.slotUrutan || ca.slot_urutan;
      
      // If IDs are provided, we need to find the urutan from items/slots
      let finalItemUrutan = itemUrutan;
      let finalSlotUrutan = slotUrutan;
      
      if (itemId && !itemUrutan) {
        const item = q.items?.find((i: any) => i.id === itemId);
        finalItemUrutan = item?.urutan || itemId;
      }
      if (slotId && !slotUrutan) {
        const slot = q.slots?.find((s: any) => s.id === slotId);
        finalSlotUrutan = slot?.urutan || slotId;
      }
      
      return {
        itemUrutan: finalItemUrutan,
        slotUrutan: finalSlotUrutan,
      };
    }),
    materi: q.materi,
  }));
}

async function createDragDropQuestion(question: DragDropQuestionData): Promise<DragDropQuestionData> {
  const res = await fetch(`${API_BASE}/v1/soal-drag-drop`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
    },
    body: JSON.stringify({
      id_materi: question.idMateri,
      id_tingkat: question.idTingkat,
      pertanyaan: question.pertanyaan,
      drag_type: question.dragType.toUpperCase(),
      pembahasan: question.pembahasan,
      items: question.items.map((item, i) => ({
        label: item.label,
        image_url: item.imageUrl,
        urutan: item.urutan || i + 1,
      })),
      slots: question.slots.map((slot, i) => ({
        label: slot.label,
        image_url: slot.imageUrl,
        urutan: slot.urutan || i + 1,
      })),
      correct_answers: question.correctAnswers.map(ca => ({
        item_urutan: ca.itemUrutan,
        slot_urutan: ca.slotUrutan,
      })),
    }),
  });
  
  if (!res.ok) throw new Error('Failed to create question');
  const data = await res.json();
  return data.soal || data;
}

async function updateDragDropQuestion(id: number, question: DragDropQuestionData): Promise<DragDropQuestionData> {
  const res = await fetch(`${API_BASE}/v1/soal-drag-drop/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
    },
    body: JSON.stringify({
      id_materi: question.idMateri,
      id_tingkat: question.idTingkat,
      pertanyaan: question.pertanyaan,
      drag_type: question.dragType.toUpperCase(),
      pembahasan: question.pembahasan,
      is_active: true,
      items: question.items.map((item, i) => ({
        label: item.label,
        image_url: item.imageUrl,
        urutan: item.urutan || i + 1,
      })),
      slots: question.slots.map((slot, i) => ({
        label: slot.label,
        image_url: slot.imageUrl,
        urutan: slot.urutan || i + 1,
      })),
      correct_answers: question.correctAnswers.map(ca => ({
        item_urutan: ca.itemUrutan,
        slot_urutan: ca.slotUrutan,
      })),
    }),
  });
  
  if (!res.ok) throw new Error('Failed to update question');
  const data = await res.json();
  return data.soal || data;
}

async function deleteDragDropQuestion(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/v1/soal-drag-drop/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
    },
  });
  if (!res.ok) throw new Error('Failed to delete question');
}

// Drag-Drop Question Form Modal
function DragDropFormModal({
  isOpen,
  onClose,
  question,
  topics,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  question: DragDropQuestionData | null;
  topics: Topic[];
  onSave: (data: DragDropQuestionData) => Promise<void>;
}) {
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState<DragDropQuestionData>({
    pertanyaan: '',
    dragType: 'ordering',
    idMateri: 0,
    idTingkat: 0,
    pembahasan: '',
    items: [{ label: '', urutan: 1 }, { label: '', urutan: 2 }],
    slots: [],
    correctAnswers: [],
  });

  useEffect(() => {
    if (isOpen) {
      if (question) {
        setFormData({
          ...question,
          items: question.items?.length ? question.items : [{ label: '', urutan: 1 }, { label: '', urutan: 2 }],
          slots: question.dragType === 'matching' 
            ? (question.slots?.length ? question.slots : [{ label: '', urutan: 1 }, { label: '', urutan: 2 }])
            : [],
          correctAnswers: question.correctAnswers || [],
        });
      } else {
        setFormData({
          pertanyaan: '',
          dragType: 'ordering',
          idMateri: 0,
          idTingkat: 0,
          pembahasan: '',
          items: [{ label: '', urutan: 1 }, { label: '', urutan: 2 }],
          slots: [],
          correctAnswers: [],
        });
      }
    }
  }, [isOpen, question]);

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { label: '', urutan: prev.items.length + 1 }],
    }));
  };

  const removeItem = (idx: number) => {
    if (formData.items.length <= 2) {
      toast({ title: 'Minimal 2 item diperlukan', status: 'warning' });
      return;
    }
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx).map((item, i) => ({ ...item, urutan: i + 1 })),
      correctAnswers: prev.correctAnswers.filter(ca => ca.itemUrutan !== idx + 1),
    }));
  };

  const addSlot = () => {
    setFormData(prev => ({
      ...prev,
      slots: [...prev.slots, { label: '', urutan: prev.slots.length + 1 }],
    }));
  };

  const removeSlot = (idx: number) => {
    if (formData.slots.length <= 2) {
      toast({ title: 'Minimal 2 slot diperlukan', status: 'warning' });
      return;
    }
    setFormData(prev => ({
      ...prev,
      slots: prev.slots.filter((_, i) => i !== idx).map((slot, i) => ({ ...slot, urutan: i + 1 })),
      correctAnswers: prev.correctAnswers.filter(ca => ca.slotUrutan !== idx + 1),
    }));
  };

  const setCorrectAnswer = (itemUrutan: number, slotUrutan: number) => {
    setFormData(prev => {
      // Remove existing mapping for this item
      const filteredAnswers = prev.correctAnswers.filter(ca => ca.itemUrutan !== itemUrutan);
      return {
        ...prev,
        correctAnswers: [...filteredAnswers, { itemUrutan, slotUrutan }],
      };
    });
  };

  const handleSlotImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, slotIdx: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressedBase64 = await compressImage(file, 400, 400, 0.7);
      const newSlots = [...formData.slots];
      newSlots[slotIdx].imageUrl = compressedBase64;
      setFormData(prev => ({ ...prev, slots: newSlots }));
      toast({
        title: 'Gambar slot berhasil diunggah',
        status: 'success',
        duration: 2,
      });
    } catch (error) {
      toast({
        title: 'Gagal mengunggah gambar',
        description: error instanceof Error ? error.message : 'Ukuran file terlalu besar atau format tidak didukung',
        status: 'error',
      });
    }
  };

  const handleSubmit = async () => {
    if (!formData.pertanyaan) {
      toast({ title: 'Pertanyaan harus diisi', status: 'warning' });
      return;
    }
    if (!formData.idMateri) {
      toast({ title: 'Pilih materi', status: 'warning' });
      return;
    }
    if (formData.items.some(item => !item.label)) {
      toast({ title: 'Semua item harus memiliki label', status: 'warning' });
      return;
    }
    
    // For MATCHING type, require slots and correct answers mapping
    if (formData.dragType === 'matching') {
      if (formData.slots.length === 0) {
        toast({ title: 'Tambahkan minimal 1 slot untuk tipe MATCHING', status: 'warning' });
        return;
      }
      if (formData.correctAnswers.length !== formData.items.length) {
        toast({ title: 'Setiap item harus dipetakan ke slot', status: 'warning' });
        return;
      }
    }
    
    // For ORDERING type, require correct answers mapping (each item must have a position)
    if (formData.dragType === 'ordering') {
      if (formData.items.length < 2) {
        toast({ title: 'Minimal ada 2 item untuk tipe ORDERING', status: 'warning' });
        return;
      }
      if (formData.correctAnswers.length !== formData.items.length) {
        toast({ title: 'Setiap item harus dipetakan ke posisi untuk ORDERING', status: 'warning' });
        return;
      }
      // Check for duplicate slots (each position can only have one item)
      const usedSlots = formData.correctAnswers.map(ca => ca.slotUrutan);
      const uniqueSlots = new Set(usedSlots);
      if (usedSlots.length !== uniqueSlots.size) {
        toast({ title: 'Setiap posisi hanya bisa memiliki satu item', status: 'warning' });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      toast({ title: 'Gagal menyimpan soal', status: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="4xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{question?.id ? 'Edit Soal Drag & Drop' : 'Tambah Soal Drag & Drop'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody py={6}>
          <VStack spacing={5} align="stretch">
            {/* Materi Select */}
            <FormControl isRequired>
              <FormLabel>Materi</FormLabel>
              <Select
                value={formData.idMateri || ''}
                onChange={(e) => {
                  const topic = topics.find(t => t.id === Number(e.target.value));
                  if (topic) {
                    setFormData(prev => ({
                      ...prev,
                      idMateri: topic.id,
                      idTingkat: topic.tingkat.id,
                    }));
                  }
                }}
              >
                <option value="" disabled>Pilih Materi</option>
                {topics.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.mataPelajaran.nama} • {t.tingkat.nama} • {t.nama}
                  </option>
                ))}
              </Select>
            </FormControl>

            {/* Question Type */}
            <FormControl isRequired>
              <FormLabel>Tipe Soal</FormLabel>
              <Select
                value={formData.dragType}
                onChange={(e) => {
                  const newType = e.target.value as 'ordering' | 'matching';
                  setFormData(prev => ({
                    ...prev,
                    dragType: newType,
                    // When switching to MATCHING, ensure we have at least 2 slots
                    slots: newType === 'matching' && prev.slots.length === 0
                      ? [{ label: '', urutan: 1 }, { label: '', urutan: 2 }]
                      : newType === 'ordering'
                      ? [] // When switching to ORDERING, clear slots (will be auto-generated)
                      : prev.slots,
                    // Keep correct answers when switching - admin needs to set them for ORDERING too
                    correctAnswers: prev.correctAnswers,
                  }));
                }}
              >
                <option value="ordering">Ordering (Urutkan)</option>
                <option value="matching">Matching (Cocokkan)</option>
              </Select>
              <Text fontSize="xs" color="gray.500" mt={1}>
                {formData.dragType === 'ordering' 
                  ? 'Siswa akan mengurutkan item ke dalam posisi yang benar (1, 2, 3, dst)'
                  : 'Siswa akan mencocokkan item dengan kategori yang sesuai'}
              </Text>
            </FormControl>

            {/* Pertanyaan */}
            <FormControl isRequired>
              <FormLabel>Pertanyaan</FormLabel>
              <Textarea
                value={formData.pertanyaan}
                onChange={(e) => setFormData(prev => ({ ...prev, pertanyaan: e.target.value }))}
                placeholder="Masukkan pertanyaan..."
                rows={3}
              />
            </FormControl>

            <Divider />

            {/* Items Section */}
            <Box>
              <HStack justify="space-between" mb={3}>
                <VStack align="start" spacing={0}>
                  <Heading size="sm">Item yang Dapat Didrag</Heading>
                  <Text fontSize="xs" color="gray.500">Setiap item bisa memiliki gambar (opsional)</Text>
                </VStack>
                <Button size="sm" leftIcon={<AddIcon />} onClick={addItem}>
                  Tambah Item
                </Button>
              </HStack>
              <VStack spacing={4} align="stretch">
                {formData.items.map((item, idx) => (
                  <Box key={idx} p={3} bg="gray.50" borderRadius="md" border="1px solid" borderColor="gray.200">
                    <HStack spacing={3} mb={2}>
                      <Badge colorScheme="blue" fontSize="md" px={2}>{idx + 1}</Badge>
                      <Input
                        flex={1}
                        value={item.label}
                        onChange={(e) => {
                          const newItems = [...formData.items];
                          newItems[idx].label = e.target.value;
                          setFormData(prev => ({ ...prev, items: newItems }));
                        }}
                        placeholder={`Item ${idx + 1} (contoh: Jawa Barat, Gajah, dst)`}
                        bg="white"
                      />
                      <IconButton
                        aria-label="Remove item"
                        icon={<DeleteIcon />}
                        size="sm"
                        colorScheme="red"
                        variant="ghost"
                        onClick={() => removeItem(idx)}
                      />
                    </HStack>
                    
                    {/* Image Upload/URL Section */}
                    <HStack spacing={3} align="start">
                      <Box flex={1}>
                        <FormLabel fontSize="xs" mb={1}>Gambar (URL atau Upload)</FormLabel>
                        <HStack>
                          <Input
                            size="sm"
                            value={item.imageUrl || ''}
                            onChange={(e) => {
                              const newItems = [...formData.items];
                              newItems[idx].imageUrl = e.target.value;
                              setFormData(prev => ({ ...prev, items: newItems }));
                            }}
                            placeholder="https://... atau upload gambar"
                            bg="white"
                          />
                          <Input
                            type="file"
                            accept="image/*"
                            size="sm"
                            display="none"
                            id={`item-image-${idx}`}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                // Compress and convert to base64
                                const compressed = await compressImage(file, 400, 400, 0.7);
                                const newItems = [...formData.items];
                                newItems[idx].imageUrl = compressed;
                                setFormData(prev => ({ ...prev, items: newItems }));
                              }
                            }}
                          />
                          <label htmlFor={`item-image-${idx}`}>
                            <Button as="span" size="sm" variant="outline" cursor="pointer">
                              📷 Upload
                            </Button>
                          </label>
                        </HStack>
                      </Box>
                      {item.imageUrl && (
                        <Box>
                          <FormLabel fontSize="xs" mb={1}>Preview</FormLabel>
                          <Image
                            src={item.imageUrl}
                            alt={item.label}
                            boxSize="60px"
                            objectFit="cover"
                            borderRadius="md"
                            border="1px solid"
                            borderColor="gray.300"
                            fallbackSrc="https://via.placeholder.com/60?text=?"
                          />
                        </Box>
                      )}
                    </HStack>
                  </Box>
                ))}
              </VStack>
            </Box>

            <Divider />

            {/* Slots Section - Only for MATCHING type */}
            {formData.dragType === 'matching' && (
            <Box>
              <HStack justify="space-between" mb={3}>
                <Heading size="sm">Slot/Kategori Drop Zone</Heading>
                <Button size="sm" leftIcon={<AddIcon />} onClick={addSlot}>
                  Tambah Slot
                </Button>
              </HStack>
              <VStack spacing={4} align="stretch">
                {formData.slots.map((slot, idx) => (
                  <Box key={idx} p={3} bg="gray.50" borderRadius="md" borderWidth="1px" borderColor="gray.200">
                    <VStack spacing={3} align="stretch">
                      <HStack>
                        <Badge colorScheme="green" fontSize="md" px={2}>{idx + 1}</Badge>
                        <Input
                          flex={1}
                          value={slot.label}
                          onChange={(e) => {
                            const newSlots = [...formData.slots];
                            newSlots[idx].label = e.target.value;
                            setFormData(prev => ({ ...prev, slots: newSlots }));
                          }}
                          placeholder={formData.dragType === 'ordering' 
                            ? `Posisi ${idx + 1}` 
                            : `Label Slot ${idx + 1} (Wajib diisi, misal: 'Darat', 'Laut', 'Udara')`}
                        />
                        <IconButton
                          aria-label="Remove slot"
                          icon={<DeleteIcon />}
                          size="sm"
                          colorScheme="red"
                          variant="ghost"
                          onClick={() => removeSlot(idx)}
                        />
                      </HStack>
                      
                      {/* Image for Slot (matching type only) */}
                      {formData.dragType === 'matching' && (
                        <FormControl>
                          <FormLabel fontSize="sm">Gambar untuk Slot (Opsional)</FormLabel>
                          <HStack spacing={3} align="flex-start">
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleSlotImageUpload(e, idx)}
                              flex={1}
                            />
                            {slot.imageUrl && (
                              <Box position="relative" w="80px" h="80px" borderRadius="md" overflow="hidden" borderWidth="1px" borderColor="gray.300">
                                <Image 
                                  src={slot.imageUrl} 
                                  alt={slot.label} 
                                  w="full" 
                                  h="full" 
                                  objectFit="cover"
                                />
                                <IconButton
                                  aria-label="Remove image"
                                  icon={<DeleteIcon />}
                                  size="sm"
                                  position="absolute"
                                  top={1}
                                  right={1}
                                  onClick={() => {
                                    const newSlots = [...formData.slots];
                                    newSlots[idx].imageUrl = undefined;
                                    setFormData(prev => ({ ...prev, slots: newSlots }));
                                  }}
                                />
                              </Box>
                            )}
                          </HStack>
                        </FormControl>
                      )}
                    </VStack>
                  </Box>
                ))}
              </VStack>
            </Box>
            )}

            {/* Correct Answers Mapping - Only for MATCHING type */}
            {formData.dragType === 'matching' && (
            <Box>
              <Heading size="sm" mb={3}>Jawaban Benar (Pemetaan Item → Slot)</Heading>
              <Text fontSize="sm" color="gray.600" mb={3}>
                Pilih slot yang benar untuk setiap item:
              </Text>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                {formData.items.map((item, itemIdx) => (
                  <HStack key={itemIdx} p={3} bg="gray.50" borderRadius="md">
                    <Badge colorScheme="blue">{item.label || `Item ${itemIdx + 1}`}</Badge>
                    <Text>→</Text>
                    <Select
                      size="sm"
                      value={formData.correctAnswers.find(ca => ca.itemUrutan === itemIdx + 1)?.slotUrutan || ''}
                      onChange={(e) => setCorrectAnswer(itemIdx + 1, Number(e.target.value))}
                    >
                      <option value="">Pilih slot...</option>
                      {formData.slots.map((slot, slotIdx) => (
                        <option key={slotIdx} value={slotIdx + 1}>
                          {slot.label || `Slot ${slotIdx + 1}`}
                        </option>
                      ))}
                    </Select>
                  </HStack>
                ))}
              </SimpleGrid>
            </Box>
            )}

            {formData.dragType === 'matching' && (
            <Box>
              <Heading size="sm" color="blue.600" mb={2}>Info Tipe MATCHING</Heading>
              <Text fontSize="sm" color="gray.600">
                Siswa akan mencocokkan item dengan kategori/slot yang sesuai. Pastikan setiap item dipetakan ke slot yang benar untuk kunci jawaban.
              </Text>
            </Box>
            )}

            {/* Correct Answers Mapping for ORDERING type */}
            {formData.dragType === 'ordering' && (
            <Box>
              <Box bg="purple.50" p={4} borderRadius="md" mb={4}>
                <Heading size="sm" color="purple.600" mb={3}>Info Tipe ORDERING (Seperti Brilliant)</Heading>
                <VStack align="stretch" spacing={2}>
                  <Text fontSize="sm" color="gray.700">
                    <strong>Cara Kerja:</strong> Siswa akan mengurutkan item ke posisi yang benar. Item akan ditampilkan secara acak ke siswa.
                  </Text>
                  <Text fontSize="sm" color="gray.600">
                    <strong>Set jawaban benar di bawah:</strong> Pilih posisi yang benar untuk setiap item.
                  </Text>
                </VStack>
              </Box>

              <Box bg="green.50" p={4} borderRadius="md" border="1px solid" borderColor="green.200">
                <Heading size="sm" color="green.700" mb={3}>Jawaban Benar (Pemetaan Item → Posisi)</Heading>
                <Text fontSize="sm" color="gray.600" mb={3}>
                  Pilih posisi yang benar untuk setiap item. Contoh: Jika item "100" harus di posisi pertama, pilih "Posisi 1".
                </Text>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                  {formData.items.map((item, itemIdx) => (
                    <HStack key={itemIdx} p={3} bg="white" borderRadius="md" border="1px solid" borderColor="green.200">
                      <Badge colorScheme="blue" minW="100px" textAlign="center">
                        {item.label || `Item ${itemIdx + 1}`}
                      </Badge>
                      <Text fontWeight="bold">→</Text>
                      <Select
                        size="sm"
                        flex={1}
                        value={formData.correctAnswers.find(ca => ca.itemUrutan === itemIdx + 1)?.slotUrutan || ''}
                        onChange={(e) => setCorrectAnswer(itemIdx + 1, Number(e.target.value))}
                        bg="white"
                      >
                        <option value="">Pilih posisi...</option>
                        {formData.items.map((_, slotIdx) => {
                          const isUsed = formData.correctAnswers.some(
                            ca => ca.slotUrutan === slotIdx + 1 && ca.itemUrutan !== itemIdx + 1
                          );
                          return (
                            <option key={slotIdx} value={slotIdx + 1} disabled={isUsed}>
                              Posisi {slotIdx + 1} {isUsed ? '(sudah digunakan)' : ''}
                            </option>
                          );
                        })}
                      </Select>
                    </HStack>
                  ))}
                </SimpleGrid>
                
                {/* Visual Preview */}
                <Box bg="purple.50" p={3} borderRadius="md" mt={4} border="1px solid" borderColor="purple.200">
                  <Text fontSize="xs" fontWeight="bold" color="purple.600" mb={2}>🎮 PREVIEW JAWABAN BENAR:</Text>
                  <HStack spacing={2} justify="center" flexWrap="wrap">
                    {formData.items.map((_, posIdx) => {
                      const answer = formData.correctAnswers.find(ca => ca.slotUrutan === posIdx + 1);
                      const item = answer ? formData.items.find((_, idx) => idx + 1 === answer.itemUrutan) : null;
                      return (
                        <VStack key={posIdx} spacing={1}>
                          <Badge colorScheme="purple" fontSize="sm" px={3} py={1}>Posisi {posIdx + 1}</Badge>
                          <Box 
                            p={2} 
                            borderRadius="md" 
                            border={item ? "2px solid" : "2px dashed"}
                            borderColor={item ? "green.400" : "gray.300"}
                            bg={item ? "green.50" : "white"}
                            minW="80px"
                            textAlign="center"
                          >
                            <Text fontSize="xs" color={item ? "green.700" : "gray.400"} fontWeight={item ? "bold" : "normal"}>
                              {item?.label || '?'}
                            </Text>
                          </Box>
                        </VStack>
                      );
                    })}
                  </HStack>
                  <Text fontSize="xs" color="gray.500" mt={2} textAlign="center">
                    Siswa akan melihat item dalam urutan acak dan harus menyusun ke posisi yang benar
                  </Text>
                </Box>
              </Box>
            </Box>
            )}

            <Divider />

            {/* Pembahasan */}
            <FormControl>
              <FormLabel>Pembahasan (Opsional)</FormLabel>
              <Textarea
                value={formData.pembahasan || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, pembahasan: e.target.value }))}
                placeholder="Masukkan pembahasan..."
                rows={2}
              />
            </FormControl>
          </VStack>
        </ModalBody>
        <ModalFooter gap={2}>
          <Button variant="outline" onClick={onClose} isDisabled={isSubmitting}>
            Batal
          </Button>
          <Button colorScheme="blue" onClick={handleSubmit} isLoading={isSubmitting}>
            Simpan Soal
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// Main Component
export default function DragDropQuestionsTab({ topics }: { topics: Topic[] }) {
  const toast = useToast();
  const [questions, setQuestions] = useState<DragDropQuestionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState<DragDropQuestionData | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  
  const { isOpen: isFormOpen, onOpen: onFormOpen, onClose: onFormClose } = useDisclosure();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();

  const loadQuestions = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchDragDropQuestions();
      setQuestions(data);
    } catch (error) {
      toast({ title: 'Gagal memuat soal', status: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const handleAddQuestion = () => {
    setCurrentQuestion(null);
    onFormOpen();
  };

  const handleEditQuestion = (q: DragDropQuestionData) => {
    setCurrentQuestion(q);
    onFormOpen();
  };

  const handleDeleteClick = (id: number) => {
    setDeleteId(id);
    onDeleteOpen();
  };

  const handleConfirmDelete = async () => {
    if (deleteId) {
      try {
        await deleteDragDropQuestion(deleteId);
        toast({ title: 'Soal dihapus', status: 'success' });
        loadQuestions();
        onDeleteClose();
      } catch (error) {
        toast({ title: 'Gagal menghapus soal', status: 'error' });
      }
    }
  };

  const handleSaveQuestion = async (data: DragDropQuestionData) => {
    if (data.id) {
      await updateDragDropQuestion(data.id, data);
      toast({ title: 'Soal berhasil diupdate', status: 'success' });
    } else {
      await createDragDropQuestion(data);
      toast({ title: 'Soal berhasil dibuat', status: 'success' });
    }
    loadQuestions();
  };

  return (
    <Container maxW="container.xl" py={6}>
      <VStack spacing={6} align="stretch">
        <Box bg="purple.50" py={6} px={4} borderRadius="md" textAlign="center">
          <Heading as="h1" size="lg" color="purple.700">
            <DragHandleIcon mr={2} />
            SOAL DRAG & DROP
          </Heading>
          <Text color="purple.600" mt={2}>
            Kelola soal tipe ordering dan matching
          </Text>
        </Box>

        <HStack justify="space-between">
          <Text fontWeight="bold">Total: {questions.length} soal</Text>
          <Button colorScheme="purple" leftIcon={<AddIcon />} onClick={handleAddQuestion}>
            Tambah Soal Drag & Drop
          </Button>
        </HStack>

        {isLoading ? (
          <Box textAlign="center" py={10}>
            <Text color="gray.500">Memuat soal...</Text>
          </Box>
        ) : questions.length === 0 ? (
          <Box textAlign="center" py={10} bg="gray.50" borderRadius="md">
            <DragHandleIcon boxSize={12} color="gray.400" mb={4} />
            <Text color="gray.500" mb={4}>Belum ada soal drag & drop</Text>
            <Button colorScheme="purple" onClick={handleAddQuestion}>
              Tambah Soal Pertama
            </Button>
          </Box>
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
            {questions.map((q) => (
              <Card key={q.id} shadow="md" _hover={{ shadow: 'lg' }} transition="shadow 0.2s">
                <CardBody>
                  <VStack align="stretch" spacing={3}>
                    <HStack justify="space-between">
                      <Badge colorScheme={q.dragType === 'ordering' ? 'blue' : 'green'}>
                        {q.dragType === 'ordering' ? '🔢 Ordering' : '🔗 Matching'}
                      </Badge>
                      <HStack>
                        <IconButton
                          aria-label="Edit"
                          icon={<EditIcon />}
                          size="sm"
                          colorScheme="blue"
                          onClick={() => handleEditQuestion(q)}
                        />
                        <IconButton
                          aria-label="Delete"
                          icon={<DeleteIcon />}
                          size="sm"
                          colorScheme="red"
                          onClick={() => handleDeleteClick(q.id!)}
                        />
                      </HStack>
                    </HStack>
                    
                    <Text fontWeight="medium" noOfLines={2}>{q.pertanyaan}</Text>
                    
                    <Wrap>
                      {q.items?.slice(0, 4).map((item, i) => (
                        <WrapItem key={i}>
                          <Tag size="sm" colorScheme="blue" variant="subtle">
                            <TagLabel>{item.label}</TagLabel>
                          </Tag>
                        </WrapItem>
                      ))}
                      {(q.items?.length || 0) > 4 && (
                        <WrapItem>
                          <Tag size="sm" variant="outline">+{(q.items?.length || 0) - 4}</Tag>
                        </WrapItem>
                      )}
                    </Wrap>

                    <Divider />
                    
                    <Text fontSize="sm" color="gray.600">
                      {q.materi?.mataPelajaran?.nama} • {q.materi?.tingkat?.nama} • {q.materi?.nama}
                    </Text>
                  </VStack>
                </CardBody>
              </Card>
            ))}
          </SimpleGrid>
        )}

        {/* Form Modal */}
        <DragDropFormModal
          isOpen={isFormOpen}
          onClose={onFormClose}
          question={currentQuestion}
          topics={topics}
          onSave={handleSaveQuestion}
        />

        {/* Delete Confirmation */}
        <Modal isOpen={isDeleteOpen} onClose={onDeleteClose} size="sm">
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Konfirmasi Hapus</ModalHeader>
            <ModalCloseButton />
            <ModalBody>Apakah Anda yakin ingin menghapus soal ini?</ModalBody>
            <ModalFooter gap={2}>
              <Button variant="outline" onClick={onDeleteClose}>Batal</Button>
              <Button colorScheme="red" onClick={handleConfirmDelete}>Hapus</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </VStack>
    </Container>
  );
}
