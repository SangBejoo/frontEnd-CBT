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
import { Level } from '../types';

export default React.memo(function LevelsTab() {
  const { data: levels, loading, create, update, remove } = useCRUD<Level>('levels');
  const [editingLevel, setEditingLevel] = useState<Level | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all'); // 'all', 'active', 'inactive'
  const { isOpen, onOpen, onClose } = useDisclosure();

  const form = useForm({
    initialValues: { nama: '' },
    onSubmit: async (values) => {
      if (editingLevel) {
        await update(editingLevel.id, values);
      } else {
        await create(values);
      }
      onClose();
      form.reset();
      setEditingLevel(null);
    },
  });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredLevels = useMemo(() => {
    return levels
      .filter(level => level && level.nama)
      .filter((level) => {
        // Search filter
        const matchesSearch = level.nama.toLowerCase().includes(debouncedSearchQuery.toLowerCase());

        // Status filter
        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'active' && (level.is_active ?? true)) ||
          (statusFilter === 'inactive' && !(level.is_active ?? true));

        return matchesSearch && matchesStatus;
      });
  }, [levels, debouncedSearchQuery, statusFilter]);

  const { paginatedItems, currentPage, totalPages, goToPage, nextPage, prevPage } =
    usePagination(filteredLevels, { itemsPerPage: 10 });

  const handleCreate = useCallback(() => {
    setEditingLevel(null);
    form.reset();
    onOpen();
  }, [form, onOpen]);

  const handleEdit = useCallback(
    (level: Level) => {
      setEditingLevel(level);
      form.setFieldValue('nama', level.nama);
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
            <Spinner size="xl" color="blue.500" thickness="4px" />
            <Text color="gray.500">Memuat data tingkat...</Text>
          </VStack>
        </Center>
      )}
      {!loading && (
        <>
      <Button colorScheme="blue" onClick={handleCreate} mb={4}>
        Tambah Tingkat
      </Button>
      <Input
        placeholder="Cari tingkat..."
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
            <Th>Tingkat</Th>
            <Th>Status</Th>
            <Th>Aksi</Th>
          </Tr>
        </Thead>
        <Tbody>
          {paginatedItems.map((level) => (
            <Tr key={level.id}>
              <Td>{level.nama}</Td>
              <Td>{(level.is_active ?? true) ? '✓ Aktif' : '✗ Tidak Aktif'}</Td>
              <Td>
                <Button size="sm" mr={2} onClick={() => handleEdit(level)}>
                  Edit
                </Button>
                <Button size="sm" colorScheme="red" onClick={() => handleDelete(level.id)}>
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
          <ModalHeader>{editingLevel ? 'Edit Tingkat' : 'Tambah Tingkat'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl>
              <FormLabel>Nama Tingkatan</FormLabel>
              <Input
                name="nama"
                value={form.values.nama}
                onChange={form.handleChange}
                placeholder="Masukkan nama tingkatan"
              />
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button
              colorScheme="blue"
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
                setEditingLevel(null);
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