'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import React from 'react';
import {
  Box,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
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
  useDisclosure,
  VStack,
  Text,
  HStack,
  Skeleton,
  Spinner,
  Center,
} from '@chakra-ui/react';
import { useCRUD, useForm, usePagination } from '../hooks';
import { Topic } from '../types';
import useSWR from 'swr';
import apiClient from '../services/api';
import { useSharedData } from '../context';

export default React.memo(function TopicsTab() {
  const { data: topics, loading, create, update, remove } = useCRUD<Topic>('topics');
  const { levels, subjects } = useSharedData();
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all'); // 'all', 'active', 'inactive'
  const [levelFilter, setLevelFilter] = useState<string>('all'); // 'all' or level id
  const { isOpen, onOpen, onClose } = useDisclosure();

  const fetcher = useCallback(async (url: string) => {
    const response = await apiClient.get<any>(url);
    return response.data?.counts || [];
  }, []);

  const { data: questionCounts } = useSWR('/question-counts', fetcher, { 
    revalidateOnFocus: false, 
    revalidateOnReconnect: false,
    dedupingInterval: 60000, // 1 minute cache
  });

  const form = useForm({
    initialValues: { 
      idMataPelajaran: '', 
      idTingkat: '', 
      nama: '',
      isActive: true,
      defaultDurasiMenit: '60',
      defaultJumlahSoal: '20',
    },
    onSubmit: async (values) => {
      const data = {
        idMataPelajaran: parseInt(values.idMataPelajaran),
        idTingkat: parseInt(values.idTingkat),
        nama: values.nama,
        isActive: values.isActive,
        defaultDurasiMenit: parseInt(values.defaultDurasiMenit),
        defaultJumlahSoal: parseInt(values.defaultJumlahSoal),
      } as any;
      if (editingTopic) {
        await update(editingTopic.id, data);
      } else {
        await create(data);
      }
      onClose();
      form.reset();
      setEditingTopic(null);
    },
  });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const questionCountByTopic = useMemo(() => {
    const countMap: Record<number, number> = {};
    if (questionCounts) {
      questionCounts.forEach((count: any) => {
        countMap[count.topic_id] = count.count;
      });
    }
    return countMap;
  }, [questionCounts]);

  const filteredTopics = useMemo(() => {
    let filtered = topics.filter((topic) => {
      // Search filter
      const matchesSearch =
        topic.nama.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        topic.mataPelajaran.nama
          .toLowerCase()
          .includes(debouncedSearchQuery.toLowerCase()) ||
        topic.tingkat.nama.toLowerCase().includes(debouncedSearchQuery.toLowerCase());

      // Status filter
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && topic.isActive) ||
        (statusFilter === 'inactive' && !topic.isActive);

      // Level filter
      const matchesLevel =
        levelFilter === 'all' ||
        topic.tingkat.id.toString() === levelFilter;

      return matchesSearch && matchesStatus && matchesLevel;
    });

    // Sort: active items first, then inactive, both groups sorted by name ascending
    filtered.sort((a, b) => {
      // First sort by active status (active first)
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;

      // Then sort by name within each group
      return a.nama.localeCompare(b.nama);
    });

    return filtered;
  }, [topics, debouncedSearchQuery, statusFilter, levelFilter]);

  const { paginatedItems, currentPage, totalPages, nextPage, prevPage } =
    usePagination(filteredTopics, { itemsPerPage: 10 });

  const handleCreate = useCallback(() => {
    setEditingTopic(null);
    form.reset();
    onOpen();
  }, [form, onOpen]);

  const handleEdit = useCallback(
    (topic: Topic) => {
      setEditingTopic(topic);
      form.setFieldValue('idMataPelajaran', topic.mataPelajaran.id.toString());
      form.setFieldValue('idTingkat', topic.tingkat.id.toString());
      form.setFieldValue('nama', topic.nama);
      form.setFieldValue('isActive', topic.isActive ?? true);
      form.setFieldValue('defaultDurasiMenit', (topic.defaultDurasiMenit ?? 60).toString());
      form.setFieldValue('defaultJumlahSoal', (topic.defaultJumlahSoal ?? 20).toString());
      onOpen();
    },
    [form, onOpen]
  );

  const handleDelete = useCallback(
    async (id: number) => {
      await remove(id);
    },
    [remove]
  );

  return (
    <Box>
      {loading && (
        <Center py={8}>
          <VStack spacing={4}>
            <Spinner size="xl" color="purple.500" thickness="4px" />
            <Text color="gray.500">Memuat data materi...</Text>
          </VStack>
        </Center>
      )}
      {!loading && (
        <>
      <Button colorScheme="purple" onClick={handleCreate} mb={4}>
        Tambah Materi
      </Button>
      <Input
        placeholder="Cari materi, mata pelajaran, atau tingkat..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        mb={4}
      />
      <HStack spacing={4} mb={4}>
        <FormControl maxW="200px">
          <FormLabel fontSize="sm">Filter Status</FormLabel>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Tidak Aktif</option>
          </Select>
        </FormControl>
        <FormControl maxW="200px">
          <FormLabel fontSize="sm">Filter Tingkat</FormLabel>
          <Select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
            <option value="all">Semua Tingkat</option>
            {levels.map((level) => (
              <option key={level.id} value={level.id.toString()}>
                {level.nama}
              </option>
            ))}
          </Select>
        </FormControl>
      </HStack>
      <Table variant="simple">
        <Thead>
          <Tr>
            <Th>Mata Pelajaran</Th>
            <Th>Tingkat</Th>
            <Th>Nama Materi</Th>
            <Th>Status</Th>
            <Th>Durasi (menit)</Th>
            <Th>Jumlah Soal</Th>
            <Th>Aksi</Th>
          </Tr>
        </Thead>
        <Tbody>
          {paginatedItems.map((topic) => (
            <Tr key={topic.id}>
              <Td>{topic.mataPelajaran.nama}</Td>
              <Td>{topic.tingkat.nama}</Td>
              <Td>{topic.nama}</Td>
              <Td>{topic.isActive ? '✓ Aktif' : '✗ Tidak Aktif'}</Td>
              <Td>{topic.defaultDurasiMenit ?? 60}</Td>
              <Td>
                <Text color={(topic.jumlahSoalReal || 0) < (topic.defaultJumlahSoal ?? 20) ? 'red.500' : 'green.500'}>
                  {topic.jumlahSoalReal || 0} / {topic.defaultJumlahSoal ?? 20}
                </Text>
              </Td>
              <Td>
                <Button size="sm" mr={2} onClick={() => handleEdit(topic)}>
                  Edit
                </Button>
                <Button size="sm" colorScheme="red" onClick={() => handleDelete(topic.id)}>
                  Hapus
                </Button>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
      <Box mt={4} display="flex" justifyContent="space-between" alignItems="center">
        <Button isDisabled={currentPage === 1} onClick={prevPage}>
          Prev
        </Button>
        <Text>
          Halaman {currentPage} dari {totalPages}
        </Text>
        <Button isDisabled={currentPage === totalPages} onClick={nextPage}>
          Next
        </Button>
      </Box>

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{editingTopic ? 'Edit Materi' : 'Tambah Materi'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl>
                <FormLabel>Mata Pelajaran</FormLabel>
                <Select
                  name="idMataPelajaran"
                  value={form.values.idMataPelajaran}
                  onChange={form.handleChange}
                  placeholder="Pilih mata pelajaran"
                >
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id.toString()}>
                      {subject.nama}
                    </option>
                  ))}
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Tingkat</FormLabel>
                <Select
                  name="idTingkat"
                  value={form.values.idTingkat}
                  onChange={form.handleChange}
                  placeholder="Pilih tingkat"
                >
                  {levels.map((level) => (
                    <option key={level.id} value={level.id.toString()}>
                      {level.nama}
                    </option>
                  ))}
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Nama Materi</FormLabel>
                <Input
                  name="nama"
                  value={form.values.nama}
                  onChange={form.handleChange}
                  placeholder="Masukkan nama materi"
                />
              </FormControl>
              <FormControl>
                <FormLabel>Status</FormLabel>
                <Select
                  name="isActive"
                  value={form.values.isActive ? 'true' : 'false'}
                  onChange={(e) => form.setFieldValue('isActive', e.target.value === 'true')}
                >
                  <option value="true">✓ Aktif (Tampilkan ke Siswa)</option>
                  <option value="false">✗ Tidak Aktif (Sembunyikan dari Siswa)</option>
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Durasi Pengerjaan (menit)</FormLabel>
                <Input
                  name="defaultDurasiMenit"
                  type="number"
                  value={form.values.defaultDurasiMenit}
                  onChange={form.handleChange}
                  placeholder="60"
                  min="1"
                />
              </FormControl>
              <FormControl>
                <FormLabel>Jumlah Soal</FormLabel>
                <Input
                  name="defaultJumlahSoal"
                  type="number"
                  value={form.values.defaultJumlahSoal}
                  onChange={form.handleChange}
                  placeholder="20"
                  min="1"
                />
                {editingTopic && (
                  <Text fontSize="sm" color="gray.600" mt={1}>
                    Soal saat ini: {questionCountByTopic[editingTopic.id] || 0}
                  </Text>
                )}
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button
              colorScheme="purple"
              mr={3}
              onClick={() => form.handleSubmit()}
              isLoading={form.isSubmitting}
            >
              Simpan
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                onClose();
                setEditingTopic(null);
                form.reset();
              }}
            >
              Batal
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      </>
      )}
    </Box>
  );
})