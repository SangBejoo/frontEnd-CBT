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
  useToast,
  VStack,
  Text,
  HStack,
  Spinner,
  Center,
} from '@chakra-ui/react';
import { useCRUD, useForm, usePagination } from '../hooks';
import { Topic } from '../types';
import useSWR from 'swr';
import apiClient from '../services/api';
import { useSharedData } from '../context';

type TopicCountEntry = {
  topic_id: number;
  count: number;
};

type TopicCountResponse = {
  counts?: TopicCountEntry[];
};

type TopicApiPayload = {
  idMataPelajaran: number;
  idTingkat: number;
  nama: string;
  parentId: number;
  sequenceOrder: number;
  isActive: boolean;
  defaultDurasiMenit: number;
  defaultJumlahSoal: number;
};

type TopicFormMode = 'parent' | 'sub';

const sortTopics = (items: Topic[]) => [...items].sort((a, b) => {
  if (a.isActive && !b.isActive) return -1;
  if (!a.isActive && b.isActive) return 1;

  const parentA = a.parentId ?? 0;
  const parentB = b.parentId ?? 0;
  if (parentA !== parentB) return parentA - parentB;

  const orderA = a.sequenceOrder ?? 1;
  const orderB = b.sequenceOrder ?? 1;
  if (orderA !== orderB) return orderA - orderB;

  return a.nama.localeCompare(b.nama);
});

export default React.memo(function TopicsTab() {
  const { data: topics, loading, create, update, remove } = useCRUD<Topic>('topics');
  const { levels, subjects, refreshTopics } = useSharedData();
  const toast = useToast();
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all'); // 'all', 'active', 'inactive'
  const [levelFilter, setLevelFilter] = useState<string>('all'); // 'all' or level id
  const [formMode, setFormMode] = useState<TopicFormMode>('parent');
  const { isOpen, onOpen, onClose } = useDisclosure();

  const fetcher = useCallback(async (url: string) => {
    const response = await apiClient.get<TopicCountResponse>(url);
    return response.data?.counts || [];
  }, []);

  const { data: questionCounts } = useSWR<TopicCountEntry[]>('/question-counts', fetcher, { 
    revalidateOnFocus: false, 
    revalidateOnReconnect: false,
    dedupingInterval: 60000, // 1 minute cache
  });

  const form = useForm({
    initialValues: { 
      idMataPelajaran: '', 
      idTingkat: '', 
      nama: '',
      parentId: '',
      sequenceOrder: '1',
      isActive: true,
      defaultDurasiMenit: '60',
      defaultJumlahSoal: '20',
    },
    onSubmit: async (values) => {
      if (formMode === 'sub' && !values.parentId) {
        toast({
          title: 'Parent materi wajib dipilih untuk sub materi',
          status: 'warning',
        });
        return;
      }

      const data: TopicApiPayload = {
        idMataPelajaran: parseInt(values.idMataPelajaran),
        idTingkat: parseInt(values.idTingkat),
        nama: values.nama,
        parentId: formMode === 'sub' && values.parentId ? parseInt(values.parentId) : 0,
        sequenceOrder: parseInt(values.sequenceOrder) || 1,
        isActive: values.isActive,
        defaultDurasiMenit: parseInt(values.defaultDurasiMenit),
        defaultJumlahSoal: parseInt(values.defaultJumlahSoal),
      };
      if (editingTopic) {
        await update(editingTopic.id, data as unknown as Partial<Omit<Topic, 'id'>>);
      } else {
        await create(data as unknown as Omit<Topic, 'id'>);
      }
      await refreshTopics();
      handleClose();
    },
  });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const questionCountByTopic = useMemo(() => {
    const countMap: Record<number, number> = {};
    if (questionCounts) {
      questionCounts.forEach((count) => {
        countMap[count.topic_id] = count.count;
      });
    }
    return countMap;
  }, [questionCounts]);

  const parentOptions = useMemo(
    () => topics.filter((topic) => {
      // Exclude self when editing
      if (editingTopic && topic.id === editingTopic.id) return false;
      if (topic.parentId) return false;
      // Only show materials from the same subject + level as potential parent
      const selectedSubject = parseInt(form.values.idMataPelajaran);
      const selectedLevel = parseInt(form.values.idTingkat);
      if (selectedSubject && selectedLevel) {
        return topic.mataPelajaran.id === selectedSubject && topic.tingkat.id === selectedLevel;
      }
      return true;
    }),
    [topics, editingTopic, form.values.idMataPelajaran, form.values.idTingkat]
  );

  const filteredTopics = useMemo(() => {
    const filtered = topics.filter((topic) => {
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

    return sortTopics(filtered);
  }, [topics, debouncedSearchQuery, statusFilter, levelFilter]);

  const parentTopics = useMemo(() => filteredTopics.filter((topic) => !topic.parentId), [filteredTopics]);
  const subTopics = useMemo(() => filteredTopics.filter((topic) => Boolean(topic.parentId)), [filteredTopics]);

  const {
    paginatedItems: paginatedParentTopics,
    currentPage: parentCurrentPage,
    totalPages: parentTotalPages,
    nextPage: nextParentPage,
    prevPage: prevParentPage,
  } = usePagination(parentTopics, { itemsPerPage: 10 });

  const {
    paginatedItems: paginatedSubTopics,
    currentPage: subCurrentPage,
    totalPages: subTotalPages,
    nextPage: nextSubPage,
    prevPage: prevSubPage,
  } = usePagination(subTopics, { itemsPerPage: 10 });

  const handleCreate = useCallback((mode: TopicFormMode) => {
    setFormMode(mode);
    setEditingTopic(null);
    form.reset();
    onOpen();
  }, [form, onOpen]);

  const handleEdit = useCallback(
    (topic: Topic) => {
      setEditingTopic(topic);
      setFormMode(topic.parentId ? 'sub' : 'parent');
      form.setFieldValue('idMataPelajaran', topic.mataPelajaran.id.toString());
      form.setFieldValue('idTingkat', topic.tingkat.id.toString());
      form.setFieldValue('nama', topic.nama);
      form.setFieldValue('parentId', topic.parentId ? topic.parentId.toString() : '');
      form.setFieldValue('sequenceOrder', (topic.sequenceOrder ?? 1).toString());
      form.setFieldValue('isActive', topic.isActive ?? true);
      form.setFieldValue('defaultDurasiMenit', (topic.defaultDurasiMenit ?? 60).toString());
      form.setFieldValue('defaultJumlahSoal', (topic.defaultJumlahSoal ?? 20).toString());
      onOpen();
    },
    [form, onOpen]
  );

  const handleClose = useCallback(() => {
    onClose();
    setEditingTopic(null);
    setFormMode('parent');
    form.reset();
  }, [form, onClose]);

  const handleDelete = useCallback(
    async (id: number) => {
      await remove(id);
      await refreshTopics();
    },
    [refreshTopics, remove]
  );

  const renderTopicSection = ({
    title,
    description,
    createLabel,
    onCreateClick,
    sectionTopics,
    pagination,
    showParentColumn,
  }: {
    title: string;
    description: string;
    createLabel: string;
    onCreateClick: () => void;
    sectionTopics: Topic[];
    pagination: {
      paginatedItems: Topic[];
      currentPage: number;
      totalPages: number;
      nextPage: () => void;
      prevPage: () => void;
    };
    showParentColumn: boolean;
  }) => {
    const { paginatedItems, currentPage, totalPages, nextPage, prevPage } = pagination;

    return (
      <Box mb={10}>
        <HStack justify="space-between" align="start" mb={4}>
          <Box>
            <Text fontSize="2xl" fontWeight="bold" color="gray.800">
              {title}
            </Text>
            <Text fontSize="sm" color="gray.600">
              {description}
            </Text>
          </Box>
          <Button colorScheme="purple" onClick={onCreateClick}>
            {createLabel}
          </Button>
        </HStack>

        {sectionTopics.length === 0 ? (
          <Box
            bg="gray.50"
            borderWidth="1px"
            borderColor="gray.200"
            borderRadius="md"
            p={6}
            textAlign="center"
          >
            <Text color="gray.500" mb={3}>
              Belum ada {title.toLowerCase()}
            </Text>
            <Button colorScheme="purple" onClick={onCreateClick}>
              {createLabel}
            </Button>
          </Box>
        ) : (
          <>
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>Mata Pelajaran</Th>
                  <Th>Tingkat</Th>
                  <Th>Nama Materi</Th>
                  {showParentColumn && <Th>Parent</Th>}
                  <Th>Urutan</Th>
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
                    {showParentColumn && (
                      <Td>
                        {topic.parentId
                          ? topics.find((parent) => parent.id === topic.parentId)?.nama || `Parent #${topic.parentId}`
                          : '-'}
                      </Td>
                    )}
                    <Td>{topic.sequenceOrder ?? 1}</Td>
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
              <Button isDisabled={totalPages <= 1 || currentPage === 1} onClick={prevPage}>
                Prev
              </Button>
              <Text>
                Halaman {currentPage} dari {totalPages || 1}
              </Text>
              <Button isDisabled={totalPages <= 1 || currentPage === totalPages} onClick={nextPage}>
                Next
              </Button>
            </Box>
          </>
        )}
      </Box>
    );
  };

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
      {renderTopicSection({
        title: 'Parent Materi',
        description: 'Materi utama yang akan tampil ke user.',
        createLabel: 'Tambah Parent Materi',
        onCreateClick: () => handleCreate('parent'),
        sectionTopics: parentTopics,
        pagination: {
          paginatedItems: paginatedParentTopics,
          currentPage: parentCurrentPage,
          totalPages: parentTotalPages,
          nextPage: nextParentPage,
          prevPage: prevParentPage,
        },
        showParentColumn: false,
      })}

      {renderTopicSection({
        title: 'Sub Materi',
        description: 'Sub materi tempat input soal dilakukan.',
        createLabel: 'Tambah Sub Materi',
        onCreateClick: () => handleCreate('sub'),
        sectionTopics: subTopics,
        pagination: {
          paginatedItems: paginatedSubTopics,
          currentPage: subCurrentPage,
          totalPages: subTotalPages,
          nextPage: nextSubPage,
          prevPage: prevSubPage,
        },
        showParentColumn: true,
      })}

      <Modal isOpen={isOpen} onClose={handleClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {editingTopic
              ? formMode === 'sub'
                ? 'Edit Sub Materi'
                : 'Edit Parent Materi'
              : formMode === 'sub'
                ? 'Tambah Sub Materi'
                : 'Tambah Parent Materi'}
          </ModalHeader>
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
              {formMode === 'sub' && (
                <FormControl isRequired>
                  <FormLabel>Parent Materi</FormLabel>
                  <Select
                    name="parentId"
                    value={form.values.parentId}
                    onChange={form.handleChange}
                    placeholder="Pilih parent materi"
                  >
                    {parentOptions.map((topic) => (
                      <option key={topic.id} value={topic.id.toString()}>
                        {topic.mataPelajaran.nama} - {topic.tingkat.nama} - {topic.nama}
                      </option>
                    ))}
                  </Select>
                </FormControl>
              )}
              <FormControl>
                <FormLabel>{formMode === 'sub' ? 'Urutan Dalam Parent' : 'Urutan Parent'}</FormLabel>
                <Input
                  name="sequenceOrder"
                  type="number"
                  value={form.values.sequenceOrder}
                  onChange={form.handleChange}
                  placeholder="1"
                  min="1"
                />
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
              onClick={handleClose}
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
