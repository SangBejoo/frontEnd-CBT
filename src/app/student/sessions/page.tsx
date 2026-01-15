'use client';

import Link from 'next/link';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  VStack,
  Heading,
  Container,
  useToast,
  Card,
  CardBody,
  Text,
  SimpleGrid,
  HStack,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Select,
  Flex,
  Center,
  Spinner,
} from '@chakra-ui/react';
import { ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons';
import axios from 'axios';
import { useAuth } from '../../auth-context';

interface Topic {
  id: number;
  mataPelajaran: { id: number; nama: string };
  tingkat: { id: number; nama: string };
  nama: string;
  isActive?: boolean;
  defaultDurasiMenit?: number;
  defaultJumlahSoal?: number;
  jumlahSoalReal?: number;
}

const TOPICS_API = process.env.NEXT_PUBLIC_API_BASE + '/v1/materi';
const CREATE_SESSION_API = process.env.NEXT_PUBLIC_API_BASE + '/v1/test-sessions';
const ITEMS_PER_PAGE = 8; // Maximum 10 items per page

export default function SessionsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isLoadingTopics, setIsLoadingTopics] = useState(true);
  const isCreatingSessionRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastSubmitTimeRef = useRef<number>(0);

  // Pagination and filter states
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTingkat, setSelectedTingkat] = useState<string>('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  const router = useRouter();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { user, isLoading: isAuthLoading } = useAuth();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setCurrentPage(1); // Reset to page 1 on search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (mounted && !isAuthLoading) {
      fetchTopics();
    }
  }, [mounted, isAuthLoading]);

  const fetchTopics = async () => {
    try {
      setIsLoadingTopics(true);
      // Request all topics at once (backend now supports large page sizes)
      const response = await axios.get(TOPICS_API, {
        params: {
          page: 1,
          pageSize: 1000, // Get all topics in one request
        },
      });
      const data = response.data;
      setTopics(Array.isArray(data) ? data : Array.isArray(data.materi) ? data.materi : []);
    } catch (error) {
      console.error('Error fetching topics:', error);
      toast({ title: 'Error mengambil data materi', status: 'error' });
    } finally {
      setIsLoadingTopics(false);
    }
  };

  // Get unique tingkat levels
  const tingkatOptions = useMemo(() => {
    const unique = Array.from(
      new Map(
        topics.map((t) => [t.tingkat.id, { id: t.tingkat.id, nama: t.tingkat.nama }])
      ).values()
    ).sort((a, b) => a.id - b.id);
    return unique;
  }, [topics]);

  // Filter and search logic - memoized to prevent unnecessary recalculations
  const filteredTopics = useMemo(() => {
    return topics
      .filter((topic) => topic.isActive !== false) // Only show active topics
      .filter((topic) => {
        const matchesSearch =
          debouncedSearchQuery === '' ||
          topic.nama.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
          topic.mataPelajaran.nama.toLowerCase().includes(debouncedSearchQuery.toLowerCase());

        const matchesTingkat = selectedTingkat === '' || topic.tingkat.id.toString() === selectedTingkat;

        return matchesSearch && matchesTingkat;
      });
  }, [topics, debouncedSearchQuery, selectedTingkat]);

  // Pagination
  const totalPages = Math.ceil(filteredTopics.length / ITEMS_PER_PAGE);
  const paginatedTopics = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTopics.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredTopics, currentPage]);

  const handleTopicClick = useCallback((topic: Topic) => {
    setSelectedTopic(topic);
    onOpen();
  }, [onOpen]);

  const handleStartTest = useCallback(
    async () => {
      if (!user || !selectedTopic) {
        toast({ title: 'User tidak ditemukan atau materi tidak dipilih', status: 'error' });
        return;
      }

      const now = Date.now();
      const timeSinceLastSubmit = now - lastSubmitTimeRef.current;
      
      if (loading || isCreatingSessionRef.current || timeSinceLastSubmit < 500) {
        return; // Prevent multiple submissions
      }

      lastSubmitTimeRef.current = now;
      setLoading(true);
      isCreatingSessionRef.current = true;
      
      // Cancel any previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      try {
        // Use defaults from materi, or fallback to hardcoded defaults
        const durasiMenit = selectedTopic.defaultDurasiMenit || 60;
        const jumlahSoal = selectedTopic.jumlahSoalReal || selectedTopic.defaultJumlahSoal || 20;

        const payload = {
          nama_peserta: user.nama,
          id_tingkat: selectedTopic.tingkat.id,
          id_mata_pelajaran: selectedTopic.mataPelajaran.id,
          durasi_menit: durasiMenit,
          jumlah_soal: jumlahSoal,
        };

        const response = await axios.post(CREATE_SESSION_API, payload, {
          signal: abortControllerRef.current?.signal,
        });
        const sessionToken =
          response.data?.testSession?.sessionToken ||
          response.data?.test_session?.session_token ||
          response.data?.session_token ||
          response.data?.token;

        if (!sessionToken) {
          toast({ title: 'Token sesi tidak ditemukan', status: 'error' });
          return;
        }

        toast({ title: 'Sesi tes berhasil dibuat!', status: 'success' });
        router.push(`/student/test/${sessionToken}`);
      } catch (error: any) {
        console.error('Error creating session:', error);
        const errorMessage = error.response?.data?.message || error.message || 'Error membuat sesi tes';
        toast({ title: errorMessage, status: 'error', duration: 5000 });
      } finally {
        setLoading(false);
        isCreatingSessionRef.current = false;
        onClose();
      }
    },
    [selectedTopic, toast, router, onClose]
  );

  // Render a single topic card
  const TopicCard = React.memo(({ topic }: { topic: Topic }) => (
    <Card
      cursor="pointer"
      onClick={() => handleTopicClick(topic)}
      _hover={{ transform: 'translateY(-4px)', shadow: 'xl' }}
      transition="all 0.3s"
      bg="orange.50"
      borderWidth="2px"
      borderColor="orange.200"
      h="full"
    >
      <CardBody>
        <VStack spacing={4} align="center" h="full" justify="space-between">
          <Box
            bg="orange.500"
            p={4}
            borderRadius="md"
            color="white"
            fontWeight="bold"
            fontSize="xl"
            minW="60px"
            textAlign="center"
          >
            CBT
          </Box>
          <VStack spacing={2} flex={1} justify="center">
            <Text fontWeight="bold" fontSize="md" textAlign="center" color="orange.700" noOfLines={2}>
              {topic.mataPelajaran.nama.toUpperCase()} {topic.tingkat.nama}
            </Text>
            <Text fontSize="sm" color="gray.600" textAlign="center" noOfLines={2}>
              {topic.nama}
            </Text>
            <Text fontSize="xs" color="gray.500">
              📚 {topic.jumlahSoalReal || 0} soal tersedia
            </Text>
          </VStack>
          <HStack spacing={2} width="full" justify="center">
            <Button
              size="xs"
              colorScheme="orange"
              onClick={(e) => {
                e.stopPropagation();
                handleTopicClick(topic);
              }}
            >
              Mulai
            </Button>
          </HStack>
        </VStack>
      </CardBody>
    </Card>
  ));

  // Memoized modal component for starting test
  const TestStartModal = React.memo(
    ({
      isOpen,
      onClose,
      selectedTopic,
      loading,
      onStartTest,
    }: {
      isOpen: boolean;
      onClose: () => void;
      selectedTopic: Topic | null;
      loading: boolean;
      onStartTest: () => void;
    }) => {
      const [isSubmitting, setIsSubmitting] = useState(false);

      useEffect(() => {
        if (!loading) {
          setIsSubmitting(false);
        }
      }, [loading]);

      const handleSubmit = () => {
        if (loading || isSubmitting) return; // Prevent multiple clicks
        setIsSubmitting(true);
        onStartTest();
      };

      return (
        <Modal isOpen={isOpen} onClose={onClose}>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Konfirmasi Mulai Tes</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <VStack spacing={4}>
                {selectedTopic && (
                  <>
                    <Box bg="orange.50" p={4} borderRadius="md" w="full">
                      <Text fontSize="sm" fontWeight="bold" color="gray.600" mb={2}>
                        Materi
                      </Text>
                      <Text fontSize="lg" fontWeight="bold" color="orange.600">
                        {selectedTopic.mataPelajaran.nama}
                      </Text>
                      <Text fontSize="md" color="gray.700" mt={1}>
                        {selectedTopic.nama}
                      </Text>
                    </Box>
                    <Box bg="blue.50" p={4} borderRadius="md" w="full">
                      <Text fontSize="sm" fontWeight="bold" color="gray.600" mb={2}>
                        Nama Peserta
                      </Text>
                      <Text fontSize="lg" fontWeight="bold" color="blue.600">
                        {user?.nama}
                      </Text>
                    </Box>
                    <Box bg="green.50" p={4} borderRadius="md" w="full">
                      <VStack spacing={2} align="flex-start">
                        <Box>
                          <Text fontSize="sm" fontWeight="bold" color="gray.600">
                            ⏱️ Waktu Pengerjaan
                          </Text>
                          <Text fontSize="lg" fontWeight="bold" color="green.600">
                            {selectedTopic.defaultDurasiMenit || 60} Menit
                          </Text>
                        </Box>
                        <Box>
                          <Text fontSize="sm" fontWeight="bold" color="gray.600">
                            📝 Jumlah Soal
                          </Text>
                          <Text fontSize="lg" fontWeight="bold" color="green.600">
                            {selectedTopic.jumlahSoalReal || 0} Soal
                          </Text>
                        </Box>
                      </VStack>
                    </Box>
                  </>
                )}
              </VStack>
            </ModalBody>
            <ModalFooter>
              <Button colorScheme="orange" mr={3} onClick={handleSubmit} isLoading={loading} isDisabled={isSubmitting}>
                Mulai Tes
              </Button>
              <Button variant="ghost" onClick={onClose}>
                Batal
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      );
    }
  );

  if (!mounted) return null;

  return (
    <Container maxW="container.xl" py={10}>
      <VStack spacing={8}>
        <Heading as="h1" size="xl" textAlign="center" mb={4} color="orange.600">
          Pilih Materi Tes
        </Heading>

        {/* Filter and Search Section */}
        <Box bg="white" p={6} borderRadius="lg" shadow="md" w="full">
          <VStack spacing={4} align="stretch">
            <Heading size="sm" color="gray.700">
              Cari & Filter Materi
            </Heading>

            <HStack spacing={4} align="flex-end" flexWrap={{ base: 'wrap', md: 'nowrap' }}>
              <FormControl flex={1} minW={{ base: '100%', md: 'auto' }}>
                <FormLabel fontSize="sm">Cari Materi atau Mata Pelajaran</FormLabel>
                <Input
                  placeholder="Ketik nama materi atau mata pelajaran..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  size="md"
                />
              </FormControl>

              <FormControl w={{ base: '100%', md: 'auto' }} minW={{ base: '100%', md: '200px' }}>
                <FormLabel fontSize="sm">Filter Tingkat</FormLabel>
                <Select
                  placeholder="Semua Tingkat"
                  value={selectedTingkat}
                  onChange={(e) => {
                    setSelectedTingkat(e.target.value);
                    setCurrentPage(1);
                  }}
                  size="md"
                >
                  {tingkatOptions.map((tingkat) => (
                    <option key={tingkat.id} value={tingkat.id.toString()}>
                      Tingkat {tingkat.nama}
                    </option>
                  ))}
                </Select>
              </FormControl>
            </HStack>

            {isLoadingTopics ? (
              <HStack justify="center" py={4}>
                <Spinner color="orange.500" />
                <Text color="gray.500">Memuat materi...</Text>
              </HStack>
            ) : filteredTopics.length > 0 ? (
              <Text fontSize="sm" color="gray.500" fontWeight="500">
                Menampilkan {paginatedTopics.length} dari {filteredTopics.length} materi{' '}
                {totalPages > 1 && `(Halaman ${currentPage} dari ${totalPages})`}
              </Text>
            ) : (
              <Text fontSize="sm" color="gray.500">
                Tidak ada materi ditemukan
              </Text>
            )}
          </VStack>
        </Box>

        {/* Topics Grid with Dynamic Rendering */}
        {isLoadingTopics ? (
          <Center w="full" py={12}>
            <Spinner size="lg" color="orange.500" />
          </Center>
        ) : filteredTopics.length > 0 ? (
          <>
            <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing={4} width="full" autoRows="minmax(240px, auto)">
              {paginatedTopics.map((topic) => (
                <TopicCard key={topic.id} topic={topic} />
              ))}
            </SimpleGrid>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <Box w="full" mt={8}>
                <Flex justify="center" align="center" gap={3} flexWrap="wrap" mb={4}>
                  <Button
                    leftIcon={<ChevronLeftIcon />}
                    onClick={() => {
                      setCurrentPage(Math.max(1, currentPage - 1));
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    isDisabled={currentPage === 1}
                    colorScheme="orange"
                    variant="outline"
                    size="sm"
                  >
                    Sebelumnya
                  </Button>

                  <HStack spacing={1} justify="center" flexWrap="wrap">
                    {totalPages <= 7
                      ? Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                          <Button
                            key={page}
                            onClick={() => {
                              setCurrentPage(page);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            variant={currentPage === page ? 'solid' : 'outline'}
                            colorScheme="orange"
                            size="sm"
                            minW="40px"
                          >
                            {page}
                          </Button>
                        ))
                      : [
                          1,
                          ...(currentPage > 3 ? [0] : []),
                          ...(currentPage > 2 ? [currentPage - 1] : []),
                          currentPage,
                          ...(currentPage < totalPages - 1 ? [currentPage + 1] : []),
                          ...(currentPage < totalPages - 2 ? [0] : []),
                          totalPages,
                        ]
                          .filter((p, i, arr) => p !== 0 || i === 0 || i === arr.length - 1)
                          .map((page, i) =>
                            page === 0 ? (
                              <Text key={`dots-${i}`} px={2}>
                                ...
                              </Text>
                            ) : (
                              <Button
                                key={page}
                                onClick={() => {
                                  setCurrentPage(page);
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                variant={currentPage === page ? 'solid' : 'outline'}
                                colorScheme="orange"
                                size="sm"
                                minW="40px"
                              >
                                {page}
                              </Button>
                            )
                          )}
                  </HStack>

                  <Button
                    rightIcon={<ChevronRightIcon />}
                    onClick={() => {
                      setCurrentPage(Math.min(totalPages, currentPage + 1));
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    isDisabled={currentPage === totalPages}
                    colorScheme="orange"
                    variant="outline"
                    size="sm"
                  >
                    Selanjutnya
                  </Button>
                </Flex>
                <Center>
                  <Text fontSize="sm" color="gray.600" fontWeight="500">
                    Halaman {currentPage} dari {totalPages}
                  </Text>
                </Center>
              </Box>
            )}
          </>
        ) : (
          <Box w="full" py={12}>
            <Center>
              <VStack spacing={4}>
                <Text fontSize="lg" fontWeight="bold" color="gray.600">
                  Tidak ada materi yang sesuai
                </Text>
                <Button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedTingkat('');
                    setCurrentPage(1);
                  }}
                  variant="outline"
                  colorScheme="orange"
                >
                  Reset Filter
                </Button>
              </VStack>
            </Center>
          </Box>
        )}

        <Link href="/student">
          <Button variant="outline" mt={4}>
            Kembali
          </Button>
        </Link>
      </VStack>

      {/* Test Start Modal */}
      <TestStartModal
        isOpen={isOpen}
        onClose={onClose}
        selectedTopic={selectedTopic}
        loading={loading}
        onStartTest={handleStartTest}
      />
    </Container>
  );
}