'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Container,
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  Spinner,
  Input,
  Select,
  Button,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Badge,
  SimpleGrid,
  Card,
  CardBody,
  Flex,
  IconButton,
} from '@chakra-ui/react';
import { ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons';
import { useSessions } from '../hooks';

export default function HistoryTab() {
  const { sessions, loading, pagination, fetchSessions, getPesertas, getSubjects, getLevels, getFilteredGroups, setPageSize, goToPage } =
    useSessions({ pageSize: 20 });

  const [searchPeserta, setSearchPeserta] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('Semua');
  const [selectedLevel, setSelectedLevel] = useState<string>('Semua');
  const [currentParticipantPage, setCurrentParticipantPage] = useState(1);

  const participantPageSize = 5;

  const pesertas = useMemo(
    () => getPesertas(searchPeserta),
    [searchPeserta, getPesertas]
  );

  const subjects = useMemo(
    () => getSubjects(pesertas),
    [pesertas, getSubjects]
  );

  const levels = useMemo(
    () => getLevels(pesertas, selectedSubject, selectedLevel),
    [pesertas, selectedSubject, selectedLevel, getLevels]
  );

  const filteredGroups = useMemo(
    () => getFilteredGroups(pesertas, selectedSubject, selectedLevel),
    [pesertas, selectedSubject, selectedLevel, getFilteredGroups]
  );

  // Pagination for participants
  const participantKeys = Object.keys(filteredGroups);
  const totalParticipantPages = Math.ceil(participantKeys.length / participantPageSize);
  const paginatedParticipants = participantKeys.slice(
    (currentParticipantPage - 1) * participantPageSize,
    currentParticipantPage * participantPageSize
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentParticipantPage(1);
  }, [searchPeserta, selectedSubject, selectedLevel]);

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return (
      date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }) +
      ' - ' +
      date.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    );
  };

  const formatDuration = (waktuMulai: string, waktuSelesai: string | null) => {
    if (!waktuSelesai) return 'Belum selesai';
    const start = new Date(waktuMulai);
    const end = new Date(waktuSelesai);
    const diffMs = end.getTime() - start.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const hours = Math.floor(diffSec / 3600);
    const minutes = Math.floor((diffSec % 3600) / 60);
    const secs = diffSec % 60;
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  if (loading) {
    return (
      <Container maxW="container.xl" py={10}>
        <Box textAlign="center">
          <Spinner size="xl" color="blue.500" mb={4} />
          <Text>Memuat riwayat sesi...</Text>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxW="container.xl" py={10}>
      <VStack spacing={6} align="stretch">
        <Box bg="blue.50" py={6} px={4} borderRadius="md" textAlign="center">
          <Heading as="h1" size="lg" color="blue.700">
            RIWAYAT SESI SISWA
          </Heading>
        </Box>

        <HStack justify="space-between" align="center" spacing={4} flexWrap="wrap">
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
              {subjects.map((subj) => (
                <option key={subj} value={subj}>
                  {subj === 'Semua' ? 'Semua Mata Pelajaran' : subj}
                </option>
              ))}
            </Select>
            <Select
              size="sm"
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              placeholder="Pilih Tingkat"
            >
              {levels.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl === 'Semua' ? 'Semua Tingkat' : `Tingkat ${lvl}`}
                </option>
              ))}
            </Select>
          </HStack>
        </HStack>

        {Object.keys(filteredGroups).length === 0 ? (
          <Card>
            <CardBody>
              <Text textAlign="center">
                Belum ada riwayat sesi tersedia untuk filter yang dipilih.
              </Text>
            </CardBody>
          </Card>
        ) : (
          <>
            <Accordion allowMultiple>
            {paginatedParticipants.map((peserta) => (
              <AccordionItem key={peserta}>
                <AccordionButton>
                  <Box flex="1" textAlign="left" fontWeight="bold" fontSize="md">
                    Peserta: {peserta}
                  </Box>
                  <AccordionIcon />
                </AccordionButton>
                <AccordionPanel pb={4}>
                  <Accordion allowMultiple>
                    {Object.keys(filteredGroups[peserta]).map((subj) => (
                      <AccordionItem key={subj} ml={4}>
                        <AccordionButton>
                          <Box flex="1" textAlign="left" fontWeight="bold" fontSize="sm">
                            Mata Pelajaran: {subj}
                          </Box>
                          <AccordionIcon />
                        </AccordionButton>
                        <AccordionPanel pb={4}>
                          {Object.keys(filteredGroups[peserta][subj]).map((lvl) => (
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
                                  >
                                    <CardBody>
                                      <VStack spacing={4} align="stretch">
                                        <HStack justify="space-between">
                                          <Badge
                                            colorScheme="orange"
                                            px={3}
                                            py={1}
                                            borderRadius="md"
                                            fontSize="xs"
                                          >
                                            Nilai CBT
                                          </Badge>
                                          <Text fontSize="xs" color="gray.500">
                                            {item.totalSoal
                                              ? `${item.totalSoal} soal`
                                              : 'No Questions'}
                                          </Text>
                                        </HStack>

                                        <Box textAlign="center" py={4}>
                                          <Text
                                            fontSize="5xl"
                                            fontWeight="bold"
                                            color="orange.500"
                                          >
                                            {item.nilaiAkhir
                                              ? item.nilaiAkhir.toFixed(2)
                                              : '0.00'}
                                          </Text>
                                          <Text fontSize="xs" color="gray.600">
                                            {item.jumlahBenar || 0}/{item.totalSoal || 0}{' '}
                                            benar
                                          </Text>
                                        </Box>

                                        <VStack
                                          spacing={2}
                                          align="stretch"
                                          fontSize="xs"
                                          color="gray.600"
                                        >
                                          <HStack>
                                            <Text>Mulai:</Text>
                                            <Text fontSize="xs">
                                              {formatDateTime(item.waktuMulai)}
                                            </Text>
                                          </HStack>
                                          <HStack>
                                            <Text>Selesai:</Text>
                                            <Text fontSize="xs">
                                              {item.waktuSelesai
                                                ? formatDateTime(item.waktuSelesai)
                                                : 'Belum selesai'}
                                            </Text>
                                          </HStack>
                                          <HStack>
                                            <Text>Durasi:</Text>
                                            <Text fontWeight="medium" fontSize="xs">
                                              {formatDuration(
                                                item.waktuMulai,
                                                item.waktuSelesai
                                              )}
                                            </Text>
                                          </HStack>
                                          <HStack>
                                            <Text>Status:</Text>
                                            <Badge
                                              colorScheme={
                                                item.status === 'COMPLETED'
                                                  ? 'green'
                                                  : 'yellow'
                                              }
                                              fontSize="xs"
                                            >
                                              {item.status}
                                            </Badge>
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

          {totalParticipantPages > 1 && (
            <HStack justify="center" mt={4}>
              <Button
                size="sm"
                onClick={() => setCurrentParticipantPage(Math.max(1, currentParticipantPage - 1))}
                isDisabled={currentParticipantPage === 1}
              >
                Prev
              </Button>
              <Text fontSize="sm">
                Page {currentParticipantPage} of {totalParticipantPages}
              </Text>
              <Button
                size="sm"
                onClick={() => setCurrentParticipantPage(Math.min(totalParticipantPages, currentParticipantPage + 1))}
                isDisabled={currentParticipantPage === totalParticipantPages}
              >
                Next
              </Button>
            </HStack>
          )}
          </>
        )}

        {/* Pagination for Sessions */}
        <Flex justify="space-between" align="center" mt={6}>
          <Text fontSize="sm" color="gray.600">
            {loading ? 'Memuat...' : `Halaman ${pagination.currentPage} dari ${pagination.totalPages} (${pagination.totalCount} sesi)`}
          </Text>
          <HStack spacing={2}>
            <Select
              size="sm"
              w="fit-content"
              value={pagination.pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              isDisabled={loading}
            >
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
            </Select>
            <IconButton
              aria-label="Previous"
              icon={<ChevronLeftIcon />}
              isDisabled={pagination.currentPage === 1 || loading}
              onClick={() => goToPage(pagination.currentPage - 1)}
            />
            <IconButton
              aria-label="Next"
              icon={<ChevronRightIcon />}
              isDisabled={pagination.currentPage >= pagination.totalPages || loading}
              onClick={() => goToPage(pagination.currentPage + 1)}
            />
          </HStack>
        </Flex>
      </VStack>
    </Container>
  );
}
