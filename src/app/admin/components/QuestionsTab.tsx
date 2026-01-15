'use client';

import { useState, useRef, useCallback, useMemo, useEffect, useDeferredValue, memo } from 'react';
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
import { Topic } from '../types';
import { useQuestions } from '../hooks';

const mapLetterToEnum = (val: string) => {
  switch ((val || '').trim().toUpperCase()) {
    case 'A': return 'A';
    case 'B': return 'B';
    case 'C': return 'C';
    case 'D': return 'D';
    default: return 'JAWABAN_INVALID';
  }
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
  question: any;
  defaultMateri: Topic | null;
  topics: Topic[];
  onSubmit: (data: any, files: FileList | null) => Promise<void>;
  onDeleteImage: (imageId: number) => Promise<void>;
}) => {
  const [formValues, setFormValues] = useState({
    pertanyaan: '',
    opsiA: '',
    opsiB: '',
    opsiC: '',
    opsiD: '',
    jawabanBenar: 'A',
    pembahasan: '',
    materi: null as Topic | null,
  });
  const [localPertanyaan, setLocalPertanyaan] = useState('');
  const [localPembahasan, setLocalPembahasan] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  useEffect(() => {
    if (isOpen) {
      setFormValues({
        pertanyaan: question?.pertanyaan || '',
        opsiA: question?.opsiA || '',
        opsiB: question?.opsiB || '',
        opsiC: question?.opsiC || '',
        opsiD: question?.opsiD || '',
        jawabanBenar: question?.jawabanBenar || 'A',
        pembahasan: question?.pembahasan || '',
        materi: question?.materi || defaultMateri || null,
      });
      setLocalPertanyaan(question?.pertanyaan || '');
      setLocalPembahasan(question?.pembahasan || '');
      setSelectedFiles(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [isOpen, question, defaultMateri]);

  const deferredPertanyaan = useDeferredValue(localPertanyaan);
  const deferredPembahasan = useDeferredValue(localPembahasan);

  useEffect(() => {
    setFormValues(prev => ({ ...prev, pertanyaan: deferredPertanyaan }));
  }, [deferredPertanyaan]);

  useEffect(() => {
    setFormValues(prev => ({ ...prev, pembahasan: deferredPembahasan }));
  }, [deferredPembahasan]);

  const updateFormField = useCallback((field: string, value: any) => {
    setFormValues(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmit = async () => {
    if (!formValues.pertanyaan || !formValues.opsiA || !formValues.opsiB || !formValues.opsiC || !formValues.opsiD || !formValues.materi?.id) {
      toast({ title: 'Harap isi semua field', status: 'warning' });
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formValues, selectedFiles);
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
              <FormLabel>Pertanyaan</FormLabel>
              <Textarea
                value={localPertanyaan}
                onChange={(e) => setLocalPertanyaan(e.target.value)}
                placeholder="Masukkan pertanyaan"
                rows={3}
              />
            </FormControl>

            <FormControl isRequired><FormLabel>Opsi A</FormLabel><Input value={formValues.opsiA} onChange={(e) => updateFormField('opsiA', e.target.value)} /></FormControl>
            <FormControl isRequired><FormLabel>Opsi B</FormLabel><Input value={formValues.opsiB} onChange={(e) => updateFormField('opsiB', e.target.value)} /></FormControl>
            <FormControl isRequired><FormLabel>Opsi C</FormLabel><Input value={formValues.opsiC} onChange={(e) => updateFormField('opsiC', e.target.value)} /></FormControl>
            <FormControl isRequired><FormLabel>Opsi D</FormLabel><Input value={formValues.opsiD} onChange={(e) => updateFormField('opsiD', e.target.value)} /></FormControl>

            <FormControl isRequired>
              <FormLabel>Jawaban Benar</FormLabel>
              <Select value={formValues.jawabanBenar} onChange={(e) => updateFormField('jawabanBenar', e.target.value)}>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
              </Select>
            </FormControl>

            <FormControl>
              <FormLabel>Pembahasan (Opsional)</FormLabel>
              <Textarea
                value={localPembahasan}
                onChange={(e) => setLocalPembahasan(e.target.value)}
                placeholder="Masukkan pembahasan"
                rows={3}
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
                      {/* Image Preview */}
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
  } = useQuestions();

  const { isOpen: isQuestionOpen, onOpen: onQuestionOpen, onClose: onQuestionClose } = useDisclosure();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();

  const [currentQuestion, setCurrentQuestion] = useState<any>({});
  const [currentDeleteId, setCurrentDeleteId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
            if (topicQuestions.some((q: any) => q.pertanyaan?.toLowerCase().includes(lowerSearch))) return true;
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
    setCurrentQuestion({});
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

      const questionData = {
        idMateri: formValues.materi.id,
        idTingkat: formValues.materi.tingkat.id,
        pertanyaan: formValues.pertanyaan,
        opsiA: formValues.opsiA,
        opsiB: formValues.opsiB,
        opsiC: formValues.opsiC,
        opsiD: formValues.opsiD,
        jawabanBenar: formValues.jawabanBenar === 'A' ? 1 : formValues.jawabanBenar === 'B' ? 2 : formValues.jawabanBenar === 'C' ? 3 : 4,
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
        setCurrentQuestion((prev: any) => ({
          ...prev,
          gambar: prev.gambar.filter((img: any) => img.id !== imageId)
        }));
      }
    } catch (error) {
      toast({ title: 'Error menghapus gambar', status: 'error' });
      throw error;
    }
  }, [currentQuestion?.id, deleteImage, toast]);

  const renderQuestionCard = useCallback((question: any) => (
    <Card key={question.id} size="sm" mb={3}>
      <CardBody p={4}>
        <Flex direction={{ base: 'column', md: 'row' }} gap={4}>
          <Box flex={1}>
            <Text fontWeight="medium" mb={2} noOfLines={2}>
              {question.pertanyaan}
            </Text>
            <HStack spacing={2} mb={2}>
              <Badge colorScheme="green" size="sm">Jawaban: {question.jawabanBenar}</Badge>
              {question.gambar && question.gambar.length > 0 && (
                <Badge colorScheme="purple" size="sm">{question.gambar.length} gambar</Badge>
              )}
            </HStack>
            {question.pembahasan && (
              <Text fontSize="sm" color="gray.600" noOfLines={1}>
                Pembahasan: {question.pembahasan}
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
            <Button colorScheme="blue" leftIcon={<AddIcon />} onClick={() => handleOpenNewQuestion()}>
              Tambah Soal
            </Button>
          </HStack>
        </Box>

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