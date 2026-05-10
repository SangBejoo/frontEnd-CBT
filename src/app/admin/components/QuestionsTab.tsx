'use client';

import { useState, useRef, useCallback, useMemo, useEffect, useDeferredValue, memo } from 'react';
import React from 'react';
import {
  Box,
  Button,
  Container,
  Checkbox,
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
  useToast,
  HStack,
  VStack,
  Text,
  Badge,
  Heading,
  Divider,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Card,
  CardBody,
  SimpleGrid,
  Flex,
} from '@chakra-ui/react';
import { EditIcon, DeleteIcon, AddIcon, ChevronUpIcon, ChevronDownIcon } from '@chakra-ui/icons';
import { Question, Topic } from '../types';
import { useQuestions } from '../hooks';
import RichTextEditor from './RichTextEditor';
import { hasRenderableHtml, plainTextFromHtml } from '../../shared/html-utils';

const QUESTION_TYPE_SINGLE = 'multiple_choice';
const QUESTION_TYPE_COMPLEX = 'multiple_choice_complex';

const normalizeIndices = (indices: Array<number | string | null | undefined> = []) => {
  const seen = new Set<number>();
  const result: number[] = [];

  for (const raw of indices) {
    const value = typeof raw === 'string' ? Number(raw) : raw;
    if (!Number.isFinite(value) || value === null || value === undefined) {
      continue;
    }
    const index = Math.trunc(Number(value));
    if (index <= 0 || seen.has(index)) {
      continue;
    }
    seen.add(index);
    result.push(index);
  }

  result.sort((a, b) => a - b);
  return result;
};

const extractQuestionOptions = (question: any): string[] => {
  const dynamicOptions = Array.isArray(question?.options) && question.options.length > 0
    ? question.options
    : Array.isArray(question?.mcOptions) && question.mcOptions.length > 0
      ? question.mcOptions
      : null;

  if (dynamicOptions) {
    return dynamicOptions
      .map((option: unknown) => (typeof option === 'string' ? option.trim() : String(option ?? '').trim()))
      .filter(Boolean);
  }

  const legacy = [
    question?.opsiA || question?.mcOpsiA,
    question?.opsiB || question?.mcOpsiB,
    question?.opsiC || question?.mcOpsiC,
    question?.opsiD || question?.mcOpsiD,
  ];

  return legacy
    .map((option) => (typeof option === 'string' ? option.trim() : String(option ?? '').trim()))
    .filter(Boolean);
};

const extractQuestionCorrectIndices = (question: any, optionsLength = 0): number[] => {
  const dynamicIndices = Array.isArray(question?.correctOptionIndices) && question.correctOptionIndices.length > 0
    ? question.correctOptionIndices
    : Array.isArray(question?.mcSelectedOptionIndices) && question.mcSelectedOptionIndices.length > 0
      ? question.mcSelectedOptionIndices
      : Array.isArray(question?.selectedOptionIndices) && question.selectedOptionIndices.length > 0
        ? question.selectedOptionIndices
        : null;

  if (dynamicIndices) {
    return normalizeIndices(dynamicIndices);
  }

  const dynamicIndex = question?.correctOptionIndex ?? question?.mcSelectedOptionIndex ?? question?.selectedOptionIndex;
  if (typeof dynamicIndex === 'number' && dynamicIndex > 0) {
    return [Math.trunc(dynamicIndex)];
  }

  const legacyValue = String(question?.jawabanBenar || question?.mcJawabanDipilih || '').trim().toUpperCase();
  const legacyMap: Record<string, number> = { A: 1, B: 2, C: 3, D: 4 };
  if (legacyMap[legacyValue]) {
    return [legacyMap[legacyValue]];
  }

  const numericLegacy = Number(legacyValue);
  if (Number.isFinite(numericLegacy) && numericLegacy > 0) {
    return [Math.trunc(numericLegacy)];
  }

  if (optionsLength > 0) {
    return [1];
  }

  return [];
};

const normalizeQuestionType = (value: unknown, optionsLength = 0, correctCount = 0) => {
  const normalized = String(value || '').toLowerCase();
  if (normalized.includes('drag')) {
    return 'drag_drop';
  }
  if (normalized.includes('complex') || optionsLength > 4 || correctCount > 1) {
    return QUESTION_TYPE_COMPLEX;
  }
  return QUESTION_TYPE_SINGLE;
};

const splitCsvLine = (line: string) => {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
};

const parseCsvText = (csvText: string) => {
  const normalizedText = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalizedText) {
    return [];
  }

  const lines = normalizedText.split('\n').filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return [];
  }

  const headers = splitCsvLine(lines[0]).map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = (values[index] ?? '').trim();
    });

    return row;
  });
};

const escapeCsvCell = (value: string) => {
  const normalized = String(value ?? '').replace(/"/g, '""');
  return /[",\n\r]/.test(normalized) ? `"${normalized}"` : normalized;
};

const buildQuestionTemplateCsv = () => {
  const headers = [
    'id_materi',
    'id_tingkat',
    'pertanyaan',
    'question_type',
    'options_json',
    'correct_option_indices_json',
    'pembahasan',
  ];

  const rows = [
    [
      1,
      1,
      '<p>Contoh <strong>pertanyaan</strong> pilihan ganda</p>',
      'multiple_choice',
      '["<p>Opsi A</p>","<p>Opsi B</p>","<p>Opsi C</p>","<p>Opsi D</p>"]',
      '[1]',
      '<p>Tulis <em>pembahasan</em> di sini</p>',
    ],
    [
      1,
      1,
      '<p>Contoh pertanyaan pilihan ganda kompleks</p>',
      'multiple_choice_complex',
      '["<p>Opsi 1</p>","<p>Opsi 2</p>","<p>Opsi 3</p>","<p>Opsi 4</p>","<p>Opsi 5</p>"]',
      '[1,3,5]',
      '<p>Contoh pembahasan untuk soal kompleks</p>',
    ],
  ];

  return [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => escapeCsvCell(String(cell))).join(',')),
  ].join('\n');
};

// Materi Select tetap memoized
const MateriSelect = memo(({ value, onChange, topics }: {
  value: number | undefined;
  onChange: (topic: Topic | null) => void;
  topics: Topic[];
}) => {
  return (
    <Select
      value={value || ''}
      onChange={(e) => {
        const topic = topics.find((t) => t.id === Number(e.target.value));
        onChange(topic || null);
      }}
    >
      <option value="" disabled hidden>Pilih Materi</option>
      {topics.map((t) => (
        <option key={t.id} value={t.id}>
          {t.mataPelajaran.nama} • {t.tingkat.nama} • {t.nama}
        </option>
      ))}
    </Select>
  );
});

const QuestionFormModal = memo(({
  isOpen,
  onClose,
  question,
  defaultMateri,
  topics,
  onSubmit,
  onDeleteImage
}: {
  isOpen: boolean;
  onClose: () => void;
  question: Question | null;
  defaultMateri: Topic | null;
  topics: Topic[];
  onSubmit: (data: any, files: FileList | null) => Promise<void>;
  onDeleteImage: (imageId: number) => Promise<void>;
}) => {
  const [formValues, setFormValues] = useState({
    pertanyaan: '',
    questionType: QUESTION_TYPE_SINGLE,
    options: ['',''],
    correctOptionIndices: [1],
    pembahasan: '',
    materi: null as Topic | null,
  });
  const [localPertanyaan, setLocalPertanyaan] = useState('');
  const [localPembahasan, setLocalPembahasan] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const hydrateForm = useCallback((source: Question | null) => {
    const sourceOptions = extractQuestionOptions(source);
    const normalizedOptions = sourceOptions.length > 0 ? sourceOptions : ['', ''];
    const normalizedCorrectIndices = normalizeIndices(
      extractQuestionCorrectIndices(source, normalizedOptions.length)
    );
    const questionType = normalizeQuestionType(
      source?.questionType,
      normalizedOptions.length,
      normalizedCorrectIndices.length
    );

    return {
      pertanyaan: source?.pertanyaan || '',
      questionType,
      options: normalizedOptions,
      correctOptionIndices: normalizedCorrectIndices.length > 0 ? normalizedCorrectIndices : [1],
      pembahasan: source?.pembahasan || '',
      materi: source?.materi || defaultMateri || null,
    };
  }, [defaultMateri]);

  useEffect(() => {
    if (isOpen) {
      const hydrated = hydrateForm(question);
      setFormValues(hydrated);
      setLocalPertanyaan(hydrated.pertanyaan);
      setLocalPembahasan(hydrated.pembahasan);
      setSelectedFiles(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [isOpen, question, hydrateForm]);

  const deferredPertanyaan = useDeferredValue(localPertanyaan);
  const deferredPembahasan = useDeferredValue(localPembahasan);

  useEffect(() => {
    setFormValues((prev) => ({ ...prev, pertanyaan: deferredPertanyaan }));
  }, [deferredPertanyaan]);

  useEffect(() => {
    setFormValues((prev) => ({ ...prev, pembahasan: deferredPembahasan }));
  }, [deferredPembahasan]);

  const updateFormField = useCallback((field: string, value: any) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleQuestionTypeChange = useCallback((nextType: string) => {
    setFormValues((prev) => {
      if (nextType === QUESTION_TYPE_SINGLE) {
        const firstCorrect = prev.correctOptionIndices[0] || 1;
        return {
          ...prev,
          questionType: nextType,
          correctOptionIndices: [firstCorrect],
        };
      }

      return {
        ...prev,
        questionType: nextType,
      };
    });
  }, []);

  const handleAddOption = useCallback(() => {
    setFormValues((prev) => ({
      ...prev,
      options: [...prev.options, ''],
    }));
  }, []);

  const handleRemoveOption = useCallback((index: number) => {
    setFormValues((prev) => {
      if (prev.options.length <= 2) {
        return prev;
      }

      const nextOptions = prev.options.filter((_, optionIndex) => optionIndex !== index);
      const removedIndex = index + 1;
      const nextCorrect = normalizeIndices(
        prev.correctOptionIndices
          .filter((value) => value !== removedIndex)
          .map((value) => (value > removedIndex ? value - 1 : value))
      );
      const fallbackCorrect = nextCorrect.length > 0 ? nextCorrect : [1];
      const nextQuestionType = normalizeQuestionType(
        prev.questionType,
        nextOptions.filter((option) => option.trim().length > 0).length,
        fallbackCorrect.length
      );

      return {
        ...prev,
        options: nextOptions,
        correctOptionIndices: nextQuestionType === QUESTION_TYPE_SINGLE ? [fallbackCorrect[0]] : fallbackCorrect,
        questionType: nextQuestionType,
      };
    });
  }, []);

  const handleOptionChange = useCallback((index: number, value: string) => {
    setFormValues((prev) => {
      const nextOptions = [...prev.options];
      nextOptions[index] = value;
      return {
        ...prev,
        options: nextOptions,
      };
    });
  }, []);

  const toggleCorrectOption = useCallback((index: number, checked: boolean) => {
    setFormValues((prev) => {
      const currentlySelected = prev.correctOptionIndices.includes(index);

      if (prev.questionType === QUESTION_TYPE_SINGLE) {
        if (checked) {
          return {
            ...prev,
            correctOptionIndices: [index],
          };
        }

        return {
          ...prev,
          correctOptionIndices: currentlySelected ? [] : prev.correctOptionIndices,
        };
      }

      const nextCorrect = checked
        ? normalizeIndices([...prev.correctOptionIndices, index])
        : normalizeIndices(prev.correctOptionIndices.filter((value) => value !== index));

      return {
        ...prev,
        questionType: normalizeQuestionType(prev.questionType, prev.options.length, nextCorrect.length),
        correctOptionIndices: nextCorrect,
      };
    });
  }, []);

  const handleSubmit = async () => {
    const cleanOptions = formValues.options
      .map((option) => (typeof option === 'string' ? option.trim() : String(option ?? '').trim()));
    const cleanCorrectIndices = normalizeIndices(formValues.correctOptionIndices)
      .filter((index) => index >= 1 && index <= cleanOptions.length);

    if (
      !hasRenderableHtml(formValues.pertanyaan) ||
      cleanOptions.length < 2 ||
      cleanOptions.some((option) => !hasRenderableHtml(option)) ||
      !formValues.materi?.id ||
      cleanCorrectIndices.length === 0
    ) {
      toast({ title: 'Harap isi semua field', status: 'warning' });
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(
        {
          ...formValues,
          questionType: normalizeQuestionType(formValues.questionType, cleanOptions.length, cleanCorrectIndices.length),
          options: cleanOptions,
          correctOptionIndices: cleanCorrectIndices,
        },
        selectedFiles
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteImage = async (imageId: number) => {
    try {
      await onDeleteImage(imageId);
    } catch (error) {
      // Error handled in parent
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      scrollBehavior="inside"
      motionPreset="none"
      trapFocus={false}
      blockScrollOnMount={false}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{question?.id ? 'Edit Soal' : 'Tambah Soal Baru'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody py={6}>
          <VStack spacing={4} align="stretch">
            <FormControl isRequired>
              <FormLabel>Materi</FormLabel>
              <MateriSelect value={formValues.materi?.id} onChange={(topic) => updateFormField('materi', topic)} topics={topics} />
            </FormControl>

            <FormControl isRequired>
              <FormLabel>Jenis Soal</FormLabel>
              <Select value={formValues.questionType} onChange={(e) => handleQuestionTypeChange(e.target.value)}>
                <option value={QUESTION_TYPE_SINGLE}>Pilihan Ganda Satu Jawaban</option>
                <option value={QUESTION_TYPE_COMPLEX}>Pilihan Ganda Kompleks</option>
              </Select>
            </FormControl>

            <FormControl isRequired>
              <FormLabel>Pertanyaan</FormLabel>
              <RichTextEditor
                value={localPertanyaan}
                onChange={setLocalPertanyaan}
                placeholder="Masukkan pertanyaan"
                minHeight={140}
              />
            </FormControl>

            <VStack spacing={3} align="stretch">
              <HStack justify="space-between" align="center">
                <FormLabel m={0}>Opsi Jawaban</FormLabel>
                <Button size="sm" variant="outline" onClick={handleAddOption}>
                  Tambah Opsi
                </Button>
              </HStack>

              {formValues.options.map((option, index) => {
                const optionNumber = index + 1;
                const isCorrect = formValues.correctOptionIndices.includes(optionNumber);

                return (
                  <Box key={`${index}-${optionNumber}`} p={3} borderWidth="1px" borderRadius="md" borderColor="gray.200" bg="gray.50">
                    <HStack align="start" spacing={3}>
                      <FormControl isRequired flex={1}>
                        <FormLabel>Opsi {optionNumber}</FormLabel>
                        <RichTextEditor
                          value={option}
                          onChange={(value) => handleOptionChange(index, value)}
                          placeholder={`Masukkan opsi ${optionNumber}`}
                          minHeight={96}
                        />
                      </FormControl>
                      <Checkbox
                        mt={8}
                        isChecked={isCorrect}
                        onChange={(e) => toggleCorrectOption(optionNumber, e.target.checked)}
                      >
                        Benar
                      </Checkbox>
                      <IconButton
                        aria-label={`Hapus opsi ${optionNumber}`}
                        icon={<DeleteIcon />}
                        size="sm"
                        variant="ghost"
                        colorScheme="red"
                        mt={7}
                        onClick={() => handleRemoveOption(index)}
                        isDisabled={formValues.options.length <= 2}
                      />
                    </HStack>
                  </Box>
                );
              })}
            </VStack>

            <FormControl>
              <FormLabel>Pembahasan (Opsional)</FormLabel>
              <RichTextEditor
                value={localPembahasan}
                onChange={setLocalPembahasan}
                placeholder="Masukkan pembahasan"
                minHeight={120}
              />
            </FormControl>

            <FormControl>
              <FormLabel>Upload Gambar (Opsional)</FormLabel>
              <Input ref={fileInputRef} type="file" multiple accept="image/*" onChange={(e) => setSelectedFiles(e.target.files)} />
              <Text fontSize="xs" color="gray.500" mt={2}>Pilih satu atau lebih file gambar</Text>
            </FormControl>

            {question?.gambar && question.gambar.length > 0 && (
              <>
                <Heading size="sm">Gambar yang Ada</Heading>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                  {question.gambar.map((img: any) => (
                    <Box
                      key={img.id}
                      p={3}
                      border="1px solid"
                      borderColor="gray.200"
                      borderRadius="md"
                      bg="gray.50"
                    >
                      {img.filePath && (
                        <Box mb={2} borderRadius="md" overflow="hidden" bg="white">
                          <img
                            src={img.filePath}
                            alt={img.namaFile || 'Gambar soal'}
                            style={{ width: '100%', maxHeight: '150px', objectFit: 'contain' }}
                          />
                        </Box>
                      )}
                      <HStack justify="space-between">
                        <VStack align="start" spacing={0}>
                          <Text fontWeight="bold" fontSize="sm" noOfLines={1}>{img.namaFile}</Text>
                          <Text fontSize="xs" color="gray.600">{(img.fileSize / 1024).toFixed(2)} KB</Text>
                        </VStack>
                        <IconButton aria-label="Delete image" icon={<DeleteIcon />} size="sm" colorScheme="red" onClick={() => handleDeleteImage(img.id)} />
                      </HStack>
                    </Box>
                  ))}
                </SimpleGrid>
              </>
            )}
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
});

export default function QuestionsTab() {
  const toast = useToast();

  const {
    questions,
    topics,
    createQuestion,
    updateQuestion,
    deleteQuestion,
    uploadImage,
    deleteImage,
    bulkCreateQuestions,
    downloadQuestionTemplate,
  } = useQuestions();

  const { isOpen: isQuestionOpen, onOpen: onQuestionOpen, onClose: onQuestionClose } = useDisclosure();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();

  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [currentDeleteId, setCurrentDeleteId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [isImportingCsv, setIsImportingCsv] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  // State untuk single open level
  const [openLevelName, setOpenLevelName] = useState<string | null>(null);

  // State untuk context tambah soal
  const [addContext, setAddContext] = useState<{ level?: string; subject?: string; topic?: string } | null>(null);

  // State untuk paginasi per topic
  const [currentPages, setCurrentPages] = useState<Record<string, number>>({});

  // State untuk paginasi tingkat
  const [currentLevelPage, setCurrentLevelPage] = useState(1);

  const pageSize = 5; // soal per halaman
  const levelPageSize = 1; // tingkat per halaman

  // State untuk filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLevelFilter, setSelectedLevelFilter] = useState('');

  const deferredSearchTerm = useDeferredValue(searchTerm);

  const getPageKey = (level: string, subject: string, topic: string) => `${level}-${subject}-${topic}`;

  const getCurrentPage = (level: string, subject: string, topic: string) => currentPages[getPageKey(level, subject, topic)] || 1;

  const setPage = (level: string, subject: string, topic: string, page: number) => {
    setCurrentPages(prev => ({ ...prev, [getPageKey(level, subject, topic)]: page }));
  };

  const getPaginatedQuestions = (questions: any[], level: string, subject: string, topic: string) => {
    const page = getCurrentPage(level, subject, topic);
    const start = (page - 1) * pageSize;
    return questions.slice(start, start + pageSize);
  };

  const getTotalPages = (questions: any[]) => Math.ceil(questions.length / pageSize);

  // Grouping full (tapi hanya yang terbuka yang di-render)
  const groupedQuestions = useMemo(() => {
    const groups: Record<string, Record<string, Record<string, any[]>>> = {};

    for (const question of questions) {
      const levelName = question.materi?.tingkat?.nama || 'Unknown';
      const subjectName = question.materi?.mataPelajaran?.nama || 'Unknown';
      const topicName = question.materi?.nama || 'Unknown';

      if (!groups[levelName]) groups[levelName] = {};
      if (!groups[levelName][subjectName]) groups[levelName][subjectName] = {};
      if (!groups[levelName][subjectName][topicName]) groups[levelName][subjectName][topicName] = [];

      groups[levelName][subjectName][topicName].push(question);
    }

    return groups;
  }, [questions]);

  const levelEntries = Object.entries(groupedQuestions);

  // Filtered level entries berdasarkan search dan filter
  const filteredLevelEntries = useMemo(() => {
    return levelEntries.filter(([levelName, subjects]) => {
      if (selectedLevelFilter && levelName !== selectedLevelFilter) return false;
      if (deferredSearchTerm) {
        const lowerSearch = deferredSearchTerm.toLowerCase();
        if (levelName.toLowerCase().includes(lowerSearch)) return true;
        for (const [subjectName, topics] of Object.entries(subjects)) {
          if (subjectName.toLowerCase().includes(lowerSearch)) return true;
          for (const [topicName, topicQuestions] of Object.entries(topics)) {
            if (topicName.toLowerCase().includes(lowerSearch)) return true;
            if (topicQuestions.some((q: any) => plainTextFromHtml(q.pertanyaan || '').toLowerCase().includes(lowerSearch))) return true;
          }
        }
        return false;
      }
      return true;
    });
  }, [levelEntries, deferredSearchTerm, selectedLevelFilter]);

  const getTotalLevelPages = () => Math.ceil(filteredLevelEntries.length / levelPageSize);

  const getPaginatedLevels = () => {
    const start = (currentLevelPage - 1) * levelPageSize;
    return filteredLevelEntries.slice(start, start + levelPageSize);
  };

  // Filtered topics berdasarkan context
  const filteredTopics = useMemo(() => {
    if (!addContext) return topics;
    return topics.filter(t => {
      if (addContext.level && t.tingkat.nama !== addContext.level) return false;
      if (addContext.subject && t.mataPelajaran.nama !== addContext.subject) return false;
      if (addContext.topic && t.nama !== addContext.topic) return false;
      return true;
    });
  }, [topics, addContext]);

  // Preselected materi berdasarkan context
  const preselectedMateri = useMemo(() => {
    if (!addContext?.topic) return null;
    return topics.find(t => t.nama === addContext.topic && t.mataPelajaran.nama === addContext.subject && t.tingkat.nama === addContext.level) || null;
  }, [topics, addContext]);

  useEffect(() => {
    setCurrentLevelPage(1);
  }, [searchTerm, selectedLevelFilter]);

  // Handler buka modal tambah soal dengan context
  const handleOpenNewQuestion = useCallback((context?: { level?: string; subject?: string; topic?: string }) => {
    setAddContext(context || null);
    setCurrentQuestion(null);
    onQuestionOpen();
  }, [onQuestionOpen]);

  const handleEditQuestion = useCallback((question: any) => {
    setCurrentQuestion(question);
    onQuestionOpen();
  }, [onQuestionOpen]);

  const handleDeleteClick = useCallback((id: number) => {
    setCurrentDeleteId(id);
    onDeleteOpen();
  }, [onDeleteOpen]);

  const handleConfirmDelete = useCallback(async () => {
    if (currentDeleteId !== null) {
      setIsSubmitting(true);
      try {
        await deleteQuestion(currentDeleteId);
        toast({ title: 'Soal dihapus', status: 'success' });
        onDeleteClose();
        setCurrentDeleteId(null);
      } catch (error) {
        toast({ title: 'Error menghapus soal', status: 'error' });
      } finally {
        setIsSubmitting(false);
      }
    }
  }, [currentDeleteId, deleteQuestion, toast, onDeleteClose]);

  const handleSubmitQuestion = useCallback(async (formValues: any, selectedFiles: FileList | null) => {
    try {
      let imageBytes: string[] = [];
      if (selectedFiles && selectedFiles.length > 0) {
        imageBytes = await Promise.all(
          Array.from(selectedFiles).map(file =>
            new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                const base64 = reader.result as string;
                resolve(base64.split(',')[1]); // Remove prefix
              };
              reader.onerror = reject;
              reader.readAsDataURL(file);
            })
          )
        );
      }

      const options = Array.isArray(formValues.options)
        ? formValues.options
            .map((option: unknown) => (typeof option === 'string' ? option.trim() : String(option ?? '').trim()))
            .filter((option: string) => option.length > 0)
        : [];
      const correctOptionIndices = normalizeIndices(formValues.correctOptionIndices || [])
        .filter((index) => index >= 1 && index <= options.length);
      const resolvedQuestionType = normalizeQuestionType(
        formValues.questionType,
        options.length,
        correctOptionIndices.length
      );

      const questionData = {
        idMateri: formValues.materi.id,
        idTingkat: formValues.materi.tingkat.id,
        pertanyaan: formValues.pertanyaan,
        questionType: resolvedQuestionType === QUESTION_TYPE_COMPLEX ? 'MULTIPLE_CHOICE_COMPLEX' : 'MULTIPLE_CHOICE',
        options,
        correctOptionIndices,
        pembahasan: formValues.pembahasan,
        imageBytes: imageBytes,
      } as any;

      let result;
      if (currentQuestion?.id) {
        // Update existing question
        result = await updateQuestion(currentQuestion.id, questionData);
        toast({ title: 'Soal berhasil diupdate', status: 'success' });
        setCurrentQuestion(result); // Keep the question in modal for further edits
      } else {
        // Create new question
        result = await createQuestion(questionData);
        toast({ title: 'Soal berhasil dibuat', status: 'success' });
        // Don't set currentQuestion on create - modal will close
      }

      // Auto open the level accordion to show the question
      setOpenLevelName(result.materi?.tingkat?.nama);

      // Close modal after successful operation
      onQuestionClose();
    } catch (error) {
      toast({ title: 'Error menyimpan soal', status: 'error' });
      throw error; // Re-throw so modal knows it failed
    }
  }, [currentQuestion, createQuestion, updateQuestion, toast, onQuestionClose]);

  const handleDeleteImage = useCallback(async (imageId: number) => {
    try {
      if (currentQuestion?.id) {
        await deleteImage(currentQuestion.id, imageId);
        toast({ title: 'Gambar dihapus', status: 'success' });
        // Update current question to reflect image deletion
        setCurrentQuestion((prev) => {
          if (!prev) {
            return prev;
          }
          return {
            ...prev,
            gambar: prev.gambar.filter((img: any) => img.id !== imageId),
          };
        });
      }
    } catch (error) {
      toast({ title: 'Error menghapus gambar', status: 'error' });
      throw error;
    }
  }, [currentQuestion?.id, deleteImage, toast]);

  const handleDownloadTemplate = useCallback(async () => {
    setIsDownloadingTemplate(true);
    try {
      const templateResponse = await downloadQuestionTemplate();
      const responseData = templateResponse && typeof templateResponse === 'object' ? templateResponse : null;
      const backendCsvContent =
        typeof templateResponse === 'string'
          ? templateResponse
          : responseData?.csvContent || responseData?.csv_content || responseData?.content || '';
      const filename = responseData?.filename || responseData?.fileName || 'soal_bulk_import_template.csv';
      const usedFallback = !backendCsvContent;
      const contentType = usedFallback
        ? 'text/csv;charset=utf-8'
        : responseData?.contentType || responseData?.content_type || 'text/csv;charset=utf-8';
      const csvContent = backendCsvContent || buildQuestionTemplateCsv();

      const blob = new Blob([csvContent], { type: contentType });
      const downloadUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(downloadUrl);

      toast({
        title: usedFallback ? 'Template CSV bawaan diunduh' : 'Template CSV diunduh',
        status: 'success',
      });
    } catch {
      toast({ title: 'Gagal mengunduh template CSV', status: 'error' });
    } finally {
      setIsDownloadingTemplate(false);
    }
  }, [downloadQuestionTemplate, toast]);

  const handleImportCsvClick = useCallback(() => {
    importFileInputRef.current?.click();
  }, []);

  const parseArrayCell = (value: string | undefined) => {
    const trimmed = (value || '').trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return trimmed
        .split('|')
        .map((part) => part.trim())
        .filter(Boolean);
    }
  };

  const handleCsvImport = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    setIsImportingCsv(true);
    try {
      const csvText = await file.text();
      const rows = parseCsvText(csvText);

      if (rows.length === 0) {
        toast({ title: 'CSV kosong atau tidak valid', status: 'warning' });
        return;
      }

      const items = rows
        .map((row, index) => {
          const rawOptions = parseArrayCell(row.options_json || row.options || row.optionsJson);
          const legacyOptions = rawOptions.length > 0
            ? rawOptions
            : [
                row.opsi_a || row.opsiA,
                row.opsi_b || row.opsiB,
                row.opsi_c || row.opsiC,
                row.opsi_d || row.opsiD,
              ].filter(Boolean);

          const options = legacyOptions
            .map((option) => (typeof option === 'string' ? option.trim() : String(option ?? '').trim()))
            .filter((option) => option.length > 0);

          const parsedCorrectIndices = parseArrayCell(
            row.correct_option_indices_json || row.correctOptionIndicesJson || row.correctOptionIndices
          )
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value) && value > 0);

          const correctOptionIndices = normalizeIndices(parsedCorrectIndices.length > 0 ? parsedCorrectIndices : [Number(row.jawaban_benar || row.jawabanBenar || 1)]);
          const questionType = normalizeQuestionType(
            row.question_type || row.questionType,
            options.length,
            correctOptionIndices.length
          );

          return {
            idMateri: Number(row.id_materi || row.idMateri || 0),
            idTingkat: Number(row.id_tingkat || row.idTingkat || 0),
            pertanyaan: row.pertanyaan || row.question || '',
            questionType: questionType === QUESTION_TYPE_COMPLEX ? 'MULTIPLE_CHOICE_COMPLEX' : 'MULTIPLE_CHOICE',
            options,
            correctOptionIndices,
            pembahasan: row.pembahasan || '',
            rowNumber: index + 1,
          };
        })
        .filter((item) => item.idMateri > 0 && item.idTingkat > 0 && item.pertanyaan && item.options.length >= 2 && item.correctOptionIndices.length > 0);

      if (items.length === 0) {
        toast({ title: 'Tidak ada baris valid untuk diimport', status: 'warning' });
        return;
      }

      await bulkCreateQuestions(items);
      toast({ title: `${items.length} soal berhasil dikirim untuk bulk import`, status: 'success' });
    } catch {
      toast({ title: 'Gagal import CSV', status: 'error' });
    } finally {
      setIsImportingCsv(false);
    }
  }, [bulkCreateQuestions, toast]);

  const renderQuestionCard = useCallback((question: any) => (
    <Card key={question.id} size="sm" mb={3}>
      <CardBody p={4}>
        <Flex direction={{ base: 'column', md: 'row' }} gap={4}>
          <Box flex={1}>
            <Text fontWeight="medium" mb={2} noOfLines={2}>
              {plainTextFromHtml(question.pertanyaan || '')}
            </Text>
            <HStack spacing={2} mb={2}>
              <Badge colorScheme="green" size="sm">
                Jawaban: {normalizeIndices(extractQuestionCorrectIndices(question, extractQuestionOptions(question).length)).join(', ') || '-'}
              </Badge>
              <Badge colorScheme="blue" size="sm">
                {normalizeQuestionType(question.questionType, extractQuestionOptions(question).length, extractQuestionCorrectIndices(question, extractQuestionOptions(question).length).length) === QUESTION_TYPE_COMPLEX
                  ? 'Pilihan Ganda Kompleks'
                  : 'Pilihan Ganda'}
              </Badge>
              <Badge colorScheme="orange" size="sm">
                {extractQuestionOptions(question).length} opsi
              </Badge>
              {question.gambar && question.gambar.length > 0 && (
                <Badge colorScheme="purple" size="sm">{question.gambar.length} gambar</Badge>
              )}
            </HStack>
            {question.pembahasan && (
              <Text fontSize="sm" color="gray.600" noOfLines={1}>
                Pembahasan: {plainTextFromHtml(question.pembahasan || '')}
              </Text>
            )}
          </Box>
          <HStack spacing={3} alignSelf={{ base: 'flex-end', md: 'center' }}>
            <IconButton 
              aria-label="Edit" 
              icon={<EditIcon />} 
              size="sm" 
              colorScheme="blue" 
              onClick={(e) => {
                e.stopPropagation();
                handleEditQuestion(question);
              }} 
            />
            <IconButton 
              aria-label="Delete" 
              icon={<DeleteIcon />} 
              size="sm" 
              colorScheme="red" 
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteClick(question.id);
              }} 
            />
          </HStack>
        </Flex>
      </CardBody>
    </Card>
  ), [handleEditQuestion, handleDeleteClick]);

  return (
    <Container maxW="container.xl" py={10}>
      <VStack spacing={6} align="stretch">
        <Box bg="blue.50" py={6} px={4} borderRadius="md" textAlign="center">
          <Heading as="h1" size="lg" color="blue.700">MANAJEMEN SOAL</Heading>
        </Box>

        <Box>
          <HStack justify="space-between" align="center" mb={4}>
            <Text fontWeight="bold" color="gray.700">Total Soal: {questions.length}</Text>
            <HStack spacing={2}>
              <Button
                variant="outline"
                colorScheme="blue"
                onClick={handleDownloadTemplate}
                isLoading={isDownloadingTemplate}
              >
                Download Template CSV
              </Button>
              <Button
                variant="outline"
                colorScheme="green"
                onClick={handleImportCsvClick}
                isLoading={isImportingCsv}
              >
                Import CSV
              </Button>
              <Button colorScheme="blue" leftIcon={<AddIcon />} onClick={() => handleOpenNewQuestion()}>
                Tambah Soal
              </Button>
            </HStack>
          </HStack>
        </Box>

        <Input
          ref={importFileInputRef}
          type="file"
          accept=".csv,text/csv"
          display="none"
          onChange={handleCsvImport}
        />

        <HStack spacing={4} mb={4}>
          <FormControl>
            <FormLabel>Search</FormLabel>
            <Input
              placeholder="Cari tingkat, mata pelajaran, materi, atau soal..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </FormControl>
          <FormControl>
            <FormLabel>Filter Tingkat</FormLabel>
            <Select
              placeholder="Semua Tingkat"
              value={selectedLevelFilter}
              onChange={(e) => setSelectedLevelFilter(e.target.value)}
            >
              {levelEntries.map(([levelName]) => (
                <option key={levelName} value={levelName}>
                  {levelName}
                </option>
              ))}
            </Select>
          </FormControl>
        </HStack>

        {questions.length === 0 ? (
          <Box textAlign="center" py={10}>
            <Text color="gray.500" mb={4}>Belum ada soal</Text>
            <Button colorScheme="blue" onClick={() => handleOpenNewQuestion()}>
              Tambah Soal Pertama
            </Button>
          </Box>
        ) : (
          <VStack spacing={4} align="stretch">
            {getPaginatedLevels().map(([levelName, subjects], levelIndex) => (
              <Box key={levelName}>
                <Button
                  bg="blue.50"
                  _hover={{ bg: 'blue.100' }}
                  w="full"
                  justifyContent="space-between"
                  rightIcon={openLevelName === levelName ? <ChevronUpIcon /> : <ChevronDownIcon />}
                  onClick={() => setOpenLevelName(openLevelName === levelName ? null : levelName)}
                  mb={2}
                >
                  <HStack>
                    <Badge colorScheme="blue" fontSize="md" px={3} py={1}>{levelName}</Badge>
                    <Text fontWeight="bold">
                      ({Object.values(subjects).reduce((total, topics) => total + Object.values(topics).reduce((tTotal, q) => tTotal + q.length, 0), 0)} soal)
                    </Text>
                  </HStack>
                </Button>

                {openLevelName === levelName && (
                  <Box pl={4} borderLeft="2px solid" borderColor="blue.200">
                    <Button
                      leftIcon={<AddIcon />}
                      colorScheme="blue"
                      size="sm"
                      mb={4}
                      onClick={() => handleOpenNewQuestion({ level: levelName })}
                    >
                      Tambah Soal di {levelName}
                    </Button>

                    <Accordion allowMultiple>
                      {Object.entries(subjects).map(([subjectName, topics]) => (
                        <AccordionItem key={subjectName}>
                          <AccordionButton bg="green.50" _hover={{ bg: 'green.100' }}>
                            <Box flex="1" textAlign="left">
                              <HStack>
                                <Badge colorScheme="green" fontSize="sm" px={2} py={1}>{subjectName}</Badge>
                                <Text fontWeight="semibold">
                                  ({Object.values(topics).reduce((total, q) => total + q.length, 0)} soal)
                                </Text>
                              </HStack>
                            </Box>
                            <AccordionIcon />
                          </AccordionButton>

                          <AccordionPanel pb={4}>
                            <Button
                              leftIcon={<AddIcon />}
                              colorScheme="green"
                              size="sm"
                              mb={4}
                              onClick={() => handleOpenNewQuestion({ level: levelName, subject: subjectName })}
                            >
                              Tambah Soal di {subjectName}
                            </Button>

                            <Accordion allowMultiple>
                              {Object.entries(topics).map(([topicName, topicQuestions]) => (
                                <AccordionItem key={topicName}>
                                  <AccordionButton bg="purple.50" _hover={{ bg: 'purple.100' }}>
                                    <Box flex="1" textAlign="left">
                                      <HStack>
                                        <Badge colorScheme="purple" fontSize="sm" px={2} py={1}>{topicName}</Badge>
                                        <Text fontWeight="medium">({topicQuestions.length} soal)</Text>
                                      </HStack>
                                    </Box>
                                    <AccordionIcon />
                                  </AccordionButton>

                                  <AccordionPanel pb={4}>
                                    <Button
                                      leftIcon={<AddIcon />}
                                      colorScheme="purple"
                                      size="sm"
                                      mb={4}
                                      onClick={() => handleOpenNewQuestion({ level: levelName, subject: subjectName, topic: topicName })}
                                    >
                                      Tambah Soal di {topicName}
                                    </Button>

                                    <SimpleGrid columns={1} spacing={3}>
                                      {getPaginatedQuestions(topicQuestions, levelName, subjectName, topicName).map(renderQuestionCard)}
                                    </SimpleGrid>

                                    {topicQuestions.length > pageSize && (
                                      <HStack justify="center" mt={4}>
                                        <Button
                                          size="sm"
                                          onClick={() => setPage(levelName, subjectName, topicName, Math.max(1, getCurrentPage(levelName, subjectName, topicName) - 1))}
                                          isDisabled={getCurrentPage(levelName, subjectName, topicName) === 1}
                                        >
                                          Prev
                                        </Button>
                                        <Text fontSize="sm">
                                          Page {getCurrentPage(levelName, subjectName, topicName)} of {getTotalPages(topicQuestions)}
                                        </Text>
                                        <Button
                                          size="sm"
                                          onClick={() => setPage(levelName, subjectName, topicName, Math.min(getTotalPages(topicQuestions), getCurrentPage(levelName, subjectName, topicName) + 1))}
                                          isDisabled={getCurrentPage(levelName, subjectName, topicName) === getTotalPages(topicQuestions)}
                                        >
                                          Next
                                        </Button>
                                      </HStack>
                                    )}
                                  </AccordionPanel>
                                </AccordionItem>
                              ))}
                            </Accordion>
                          </AccordionPanel>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </Box>
                )}
              </Box>
            ))}

            {getTotalLevelPages() > 1 && (
              <HStack justify="center" mt={4}>
                <Button
                  size="sm"
                  onClick={() => setCurrentLevelPage(Math.max(1, currentLevelPage - 1))}
                  isDisabled={currentLevelPage === 1}
                >
                  Prev Levels
                </Button>
                <Text fontSize="sm">
                  Level Page {currentLevelPage} of {getTotalLevelPages()}
                </Text>
                <Button
                  size="sm"
                  onClick={() => setCurrentLevelPage(Math.min(getTotalLevelPages(), currentLevelPage + 1))}
                  isDisabled={currentLevelPage === getTotalLevelPages()}
                >
                  Next Levels
                </Button>
              </HStack>
            )}
          </VStack>
        )}

        {/* Modal dengan semua optimasi anti-lag */}
        <QuestionFormModal
          isOpen={isQuestionOpen}
          onClose={onQuestionClose}
          question={currentQuestion}
          defaultMateri={preselectedMateri}
          topics={filteredTopics}
          onSubmit={handleSubmitQuestion}
          onDeleteImage={handleDeleteImage}
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
              <Button colorScheme="red" onClick={handleConfirmDelete} isLoading={isSubmitting}>Hapus</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </VStack>
    </Container>
  );
}
