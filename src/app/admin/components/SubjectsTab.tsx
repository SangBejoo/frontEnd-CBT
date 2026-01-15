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
  Text,
  Spinner,
  VStack,
  Center,
} from '@chakra-ui/react';
import { useCRUD, useForm, usePagination } from '../hooks';
import { Subject } from '../types';

export default React.memo(function SubjectsTab() {
  const { data: subjects, loading, create, update, remove } = useCRUD<Subject>('subjects');
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all'); // 'all', 'active', 'inactive'
  const { isOpen, onOpen, onClose } = useDisclosure();

  const form = useForm({
    initialValues: { nama: '' },
    onSubmit: async (values) => {
      if (editingSubject) {
        await update(editingSubject.id, values);
      } else {
        await create(values);
      }
      onClose();
      form.reset();
      setEditingSubject(null);
    },
  });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredSubjects = useMemo(() => {
    return subjects
      .filter(subject => subject && subject.nama)
      .filter((subject) => {
        // Search filter
        const matchesSearch = subject.nama.toLowerCase().includes(debouncedSearchQuery.toLowerCase());

        // Status filter
        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'active' && (subject.is_active ?? true)) ||
          (statusFilter === 'inactive' && !(subject.is_active ?? true));

        return matchesSearch && matchesStatus;
      });
  }, [subjects, debouncedSearchQuery, statusFilter]);

  const { paginatedItems, currentPage, totalPages, nextPage, prevPage } =
    usePagination(filteredSubjects, { itemsPerPage: 10 });

  const handleCreate = useCallback(() => {
    setEditingSubject(null);
    form.reset();
    onOpen();
  }, [form, onOpen]);

  const handleEdit = useCallback(
    (subject: Subject) => {
      setEditingSubject(subject);
      form.setFieldValue('nama', subject.nama);
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
            <Spinner size="xl" color="green.500" thickness="4px" />
            <Text color="gray.500">Memuat data mata pelajaran...</Text>
          </VStack>
        </Center>
      )}
      {!loading && (
        <>
      <Button colorScheme="green" onClick={handleCreate} mb={4}>
        Tambah Mata Pelajaran
      </Button>
      <Input
        placeholder="Cari mata pelajaran..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        mb={4}
      />
      <FormControl maxW="200px" mb={4}>
        <FormLabel fontSize="sm">Filter Status</FormLabel>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">Semua Status</option>
          <option value="active">Aktif</option>
          <option value="inactive">Tidak Aktif</option>
        </Select>
      </FormControl>
      <Table variant="simple">
        <Thead>
          <Tr>
            <Th>Nama Mata Pelajaran</Th>
            <Th>Status</Th>
            <Th>Aksi</Th>
          </Tr>
        </Thead>
        <Tbody>
          {paginatedItems.map((subject) => (
            <Tr key={subject.id}>
              <Td>{subject.nama}</Td>
              <Td>{(subject.is_active ?? true) ? '✓ Aktif' : '✗ Tidak Aktif'}</Td>
              <Td>
                <Button size="sm" mr={2} onClick={() => handleEdit(subject)}>
                  Edit
                </Button>
                <Button size="sm" colorScheme="red" onClick={() => handleDelete(subject.id)}>
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
          <ModalHeader>
            {editingSubject ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran'}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl>
              <FormLabel>Nama</FormLabel>
              <Input
                name="nama"
                value={form.values.nama}
                onChange={form.handleChange}
                placeholder="Masukkan nama mata pelajaran"
              />
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button
              colorScheme="green"
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
                setEditingSubject(null);
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