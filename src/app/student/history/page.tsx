'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  VStack,
  Heading,
  Container,
  useToast,
  Card,
  CardBody,
  Text,
  Badge,
  HStack,
  SimpleGrid,
  Select,
  Input,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Spinner,
  IconButton,
} from '@chakra-ui/react';
import { ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons';
import axios from 'axios';
import { useAuth } from '../../auth-context';

interface HistoryItem {
  id: number;
  sessionToken: string;
  namaPeserta: string;
  mataPelajaran: {
    id: number;
    nama: string;
  };
  tingkat: {
    id: number;
    nama: string;
  };
  waktuMulai: string;
  waktuSelesai: string;
  durasiPengerjaanDetik: number;
  nilaiAkhir: number;
  jumlahBenar: number;
  totalSoal: number;
  status: string;
  namaMateri?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE + '/v1/history/student';

export default function HistoryPage() {
  const toast = useToast();
  const router = useRouter();
  const { isLoading: isAuthLoading } = useAuth();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchPeserta, setSearchPeserta] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('Semua');
  const [selectedLevel, setSelectedLevel] = useState<string>('Semua');

  useEffect(() => {
    if (!isAuthLoading) {
      fetchHistory(currentPage, pageSize);
    }
  }, [isAuthLoading, currentPage, pageSize]);

  const fetchHistory = async (page: number, size: number) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}?pagination.page=${page}&pagination.page_size=${size}`);
      setHistory(response.data.history || []);
      if (response.data.pagination) {
        setTotalPages(response.data.pagination.totalPages || 1);
        setTotalCount(response.data.pagination.totalCount || 0);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
      toast({ title: 'Error loading history', status: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const groupedHistory = useMemo(() => {
    const groups: Record<string, Record<string, Record<string, HistoryItem[]>>> = {};
    history.forEach(item => {
      const peserta = item.namaPeserta || 'Unknown';
      const subj = item.mataPelajaran.nama;
      const lvl = item.tingkat.nama;
      if (!groups[peserta]) groups[peserta] = {};
      if (!groups[peserta][subj]) groups[peserta][subj] = {};
      if (!groups[peserta][subj][lvl]) groups[peserta][subj][lvl] = [];
      groups[peserta][subj][lvl].push(item);
    });
    return groups;
  }, [history]);

  const pesertas = useMemo(() => {
    const allPesertas = Object.keys(groupedHistory);
    if (searchPeserta.trim() === '') return allPesertas;
    return allPesertas.filter(p => p.toLowerCase().includes(searchPeserta.toLowerCase()));
  }, [groupedHistory, searchPeserta]);

  const subjects = useMemo(() => {
    if (searchPeserta.trim() === '') {
      const allSubjects = new Set<string>();
      Object.values(groupedHistory).forEach(peserta => Object.keys(peserta).forEach(subj => allSubjects.add(subj)));
      return ['Semua', ...Array.from(allSubjects)];
    } else {
      const matchedPesertas = pesertas;
      const allSubjects = new Set<string>();
      matchedPesertas.forEach(p => {
        Object.keys(groupedHistory[p] || {}).forEach(subj => allSubjects.add(subj));
      });
      return ['Semua', ...Array.from(allSubjects)];
    }
  }, [groupedHistory, searchPeserta, pesertas]);

  const levels = useMemo(() => {
    if (selectedSubject === 'Semua') {
      const allLevels = new Set<string>();
      pesertas.forEach(p => {
        Object.values(groupedHistory[p] || {}).forEach(subj => 
          Object.keys(subj).forEach(lvl => allLevels.add(lvl))
        );
      });
      return ['Semua', ...Array.from(allLevels)];
    } else {
      const allLevels = new Set<string>();
      pesertas.forEach(p => {
        Object.keys(groupedHistory[p]?.[selectedSubject] || {}).forEach(lvl => allLevels.add(lvl));
      });
      return ['Semua', ...Array.from(allLevels)];
    }
  }, [groupedHistory, selectedSubject, pesertas]);

  const filteredGroups = useMemo(() => {
    const filtered: Record<string, Record<string, Record<string, HistoryItem[]>>> = {};
    pesertas.forEach(peserta => {
      filtered[peserta] = {};
      Object.keys(groupedHistory[peserta]).forEach(subj => {
        if (selectedSubject !== 'Semua' && subj !== selectedSubject) return;
        filtered[peserta][subj] = {};
        Object.keys(groupedHistory[peserta][subj]).forEach(lvl => {
          if (selectedLevel !== 'Semua' && lvl !== selectedLevel) return;
          filtered[peserta][subj][lvl] = groupedHistory[peserta][subj][lvl];
        });
        if (Object.keys(filtered[peserta][subj]).length === 0) delete filtered[peserta][subj];
      });
      if (Object.keys(filtered[peserta]).length === 0) delete filtered[peserta];
    });
    return filtered;
  }, [groupedHistory, pesertas, selectedSubject, selectedLevel]);

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) + ' - ' + date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  if (isAuthLoading) {
    return (
      <Container maxW="container.xl" py={10}>
        <Box textAlign="center">
          <Spinner size="xl" color="blue.500" mb={4} />
          <Text>Memuat riwayat...</Text>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxW="container.xl" py={10}>
      <VStack spacing={6} align="stretch">
        <Box bg="blue.50" py={6} px={4} borderRadius="md" textAlign="center">
          <Heading as="h1" size="lg" color="blue.700">
            HISTORI NILAI SISWA
          </Heading>
        </Box>

        <HStack justify="space-between" align="center" spacing={4} flexWrap="wrap">
          <Button
            variant="link"
            color="gray.600"
            leftIcon={<Text>←</Text>}
            onClick={() => router.push('/student')}
          >
            Kembali
          </Button>
          <HStack spacing={3} flex={1} maxW="600px">
            <Input
              size="sm"
              placeholder="Cari nama peserta..."
              value={searchPeserta}
              onChange={(e) => setSearchPeserta(e.target.value)}
              borderColor="gray.300"
              _focus={{ borderColor: 'blue.500', boxShadow: '0 0 0 1px #3182ce' }}
            />
            <Select
              size="sm"
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              placeholder="Pilih Mata Pelajaran"
            >
              {subjects.map(subj => (
                <option key={subj} value={subj}>{subj === 'Semua' ? 'Semua Mata Pelajaran' : subj}</option>
              ))}
            </Select>
            <Select
              size="sm"
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              placeholder="Pilih Tingkat"
            >
              {levels.map(lvl => (
                <option key={lvl} value={lvl}>{lvl === 'Semua' ? 'Semua Tingkat' : `Tingkat ${lvl}`}</option>
              ))}
            </Select>
          </HStack>
        </HStack>

        {Object.keys(filteredGroups).length === 0 ? (
          <Card>
            <CardBody>
              <Text textAlign="center">Belum ada riwayat tes tersedia untuk filter yang dipilih.</Text>
            </CardBody>
          </Card>
        ) : (
          <Accordion allowMultiple>
            {Object.keys(filteredGroups).map(peserta => (
              <AccordionItem key={peserta}>
                <AccordionButton>
                  <Box flex="1" textAlign="left" fontWeight="bold" fontSize="md">
                    Peserta: {peserta}
                  </Box>
                  <AccordionIcon />
                </AccordionButton>
                <AccordionPanel pb={4}>
                  <Accordion allowMultiple>
                    {Object.keys(filteredGroups[peserta]).map(subj => (
                      <AccordionItem key={subj} ml={4}>
                        <AccordionButton>
                          <Box flex="1" textAlign="left" fontWeight="bold" fontSize="sm">
                            Mata Pelajaran: {subj}
                          </Box>
                          <AccordionIcon />
                        </AccordionButton>
                        <AccordionPanel pb={4}>
                          {Object.keys(filteredGroups[peserta][subj]).map(lvl => (
                            <Box key={lvl} mb={6}>
                              <Heading size="sm" mb={4} color="gray.700">
                                Tingkat {lvl}
                              </Heading>
                              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                                {filteredGroups[peserta][subj][lvl].map((item) => (
                                  <Card
                                    key={item.sessionToken}
                                    bg="orange.50"
                                    borderWidth="2px"
                                    borderColor="orange.200"
                                    borderRadius="xl"
                                    overflow="hidden"
                                    _hover={{ shadow: 'lg' }}
                                    cursor="pointer"
                                    onClick={() => router.push(`/student/results/${item.sessionToken}`)}
                                  >
                                    <CardBody>
                                      <VStack spacing={4} align="stretch">
                                        <HStack justify="space-between">
                                          <Badge colorScheme="orange" px={3} py={1} borderRadius="md" fontSize="xs">
                                            Nilai CBT
                                          </Badge>
                                          <Text fontSize="xs" color="gray.500">
                                            {item.totalSoal === 0 ? 'No Questions' : `${item.totalSoal} soal`}
                                          </Text>
                                        </HStack>

                                        <Box textAlign="center" py={4}>
                                          <Text fontSize="5xl" fontWeight="bold" color="orange.500">
                                            {item.nilaiAkhir.toFixed(2)}
                                          </Text>
                                          <Text fontSize="xs" color="gray.600">
                                            {item.jumlahBenar}/{item.totalSoal} benar
                                          </Text>
                                        </Box>

                                        <VStack spacing={2} align="stretch" fontSize="xs" color="gray.600">
                                          <HStack>
                                            <Text>Mulai:</Text>
                                            <Text fontSize="xs">{formatDateTime(item.waktuMulai)}</Text>
                                          </HStack>
                                          <HStack>
                                            <Text>Selesai:</Text>
                                            <Text fontSize="xs">{formatDateTime(item.waktuSelesai)}</Text>
                                          </HStack>
                                          <HStack>
                                            <Text>Durasi:</Text>
                                            <Text fontWeight="medium" fontSize="xs">{formatDuration(item.durasiPengerjaanDetik)}</Text>
                                          </HStack>
                                        </VStack>
                                      </VStack>
                                    </CardBody>
                                  </Card>
                                ))}
                              </SimpleGrid>
                            </Box>
                          ))}
                        </AccordionPanel>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </AccordionPanel>
              </AccordionItem>
            ))}
          </Accordion>
        )}

        {/* Pagination Controls */}
        <HStack justify="space-between" align="center" mt={4} w="full">
          <Text fontSize="sm" color="gray.600">
            {loading ? 'Memuat...' : `Halaman ${currentPage} dari ${totalPages} (${totalCount} sesi)`}
          </Text>
          <HStack spacing={2}>
            <Select
              size="sm"
              w="fit-content"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              isDisabled={loading}
            >
              <option value={10}>10 / halaman</option>
              <option value={20}>20 / halaman</option>
              <option value={50}>50 / halaman</option>
              <option value={100}>100 / halaman</option>
            </Select>
            <IconButton
              aria-label="Previous"
              icon={<ChevronLeftIcon />}
              isDisabled={currentPage === 1 || loading}
              onClick={() => setCurrentPage(prev => prev - 1)}
            />
            <IconButton
              aria-label="Next"
              icon={<ChevronRightIcon />}
              isDisabled={currentPage >= totalPages || loading}
              onClick={() => setCurrentPage(prev => prev + 1)}
            />
          </HStack>
        </HStack>

        <Link href="/student">
          <Button variant="outline" size="lg" width="full" mt={4}>
            Kembali ke Beranda
          </Button>
        </Link>
      </VStack>
    </Container>
  );
}