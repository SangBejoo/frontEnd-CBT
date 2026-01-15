'use client';

import { useState, useCallback } from 'react';
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
  FormErrorMessage,
  Input,
  Select,
  HStack,
  VStack,
  Text,
  Badge,
  Heading,
  Switch,
  Flex,
  Spacer,
} from '@chakra-ui/react';
import { EditIcon, DeleteIcon, AddIcon, ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons';
import { useUsers, useForm } from '../hooks';
import type { UpdateUserData, CreateUserData } from '../hooks/useUsers';

export default React.memo(function UsersTab() {
  const {
    users,
    loading,
    pagination,
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
  } = useUsers();

  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [currentDeleteId, setCurrentDeleteId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Modal states
  const { isOpen: isCreateOpen, onOpen: onCreateOpen, onClose: onCreateClose } =
    useDisclosure();
  const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } =
    useDisclosure();
  const {
    isOpen: isDeleteOpen,
    onOpen: onDeleteOpen,
    onClose: onDeleteClose,
  } = useDisclosure();

  // Create form
  const createForm = useForm({
    initialValues: { email: '', password: '', nama: '', role: 'SISWA' },
    onSubmit: async (values) => {
      await createUser(values as CreateUserData);
      onCreateClose();
      createForm.reset();
    },
  });

  // Edit form
  const editForm = useForm({
    initialValues: {
      id: 0,
      email: '',
      nama: '',
      role: 'SISWA',
      isActive: true,
    },
    onSubmit: async (values) => {
      const { id, ...updateData } = values;
      await updateUser(id, updateData as UpdateUserData);
      onEditClose();
      editForm.reset();
    },
  });

  const handleCreateOpen = useCallback(() => {
    createForm.reset();
    onCreateOpen();
  }, [createForm, onCreateOpen]);

  const handleEditOpen = useCallback(
    (user: any) => {
      editForm.setFieldValue('id', user.id);
      editForm.setFieldValue('email', user.email);
      editForm.setFieldValue('nama', user.nama);
      editForm.setFieldValue('role', user.role);
      editForm.setFieldValue('isActive', user.isActive);
      onEditOpen();
    },
    [editForm, onEditOpen]
  );

  const handleDeleteOpen = useCallback((userId: number) => {
    setCurrentDeleteId(userId);
    onDeleteOpen();
  }, [onDeleteOpen]);

  const handleDelete = useCallback(async () => {
    if (!currentDeleteId || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteUser(currentDeleteId);
      onDeleteClose();
      setCurrentDeleteId(null);
    } finally {
      setIsDeleting(false);
    }
  }, [currentDeleteId, isDeleting, deleteUser, onDeleteClose]);

  const handlePageChange = useCallback(
    (newPage: number) => {
      if (newPage >= 1 && newPage <= pagination.totalPages) {
        fetchUsers(newPage, selectedRole, selectedStatus);
      }
    },
    [fetchUsers, pagination.totalPages, selectedRole, selectedStatus]
  );

  const handleRoleFilterChange = useCallback(
    (value: string) => {
      setSelectedRole(value);
      fetchUsers(1, value, selectedStatus);
    },
    [fetchUsers, selectedStatus]
  );

  const handleStatusFilterChange = useCallback(
    (value: string) => {
      setSelectedStatus(value);
      fetchUsers(1, selectedRole, value);
    },
    [fetchUsers, selectedRole]
  );

  const getRoleColor = (role: string) => {
    return role === 'SISWA' ? 'blue' : role === 'ADMIN' ? 'red' : 'gray';
  };

  const getRoleLabel = (role: string) => {
    return role;
  };

  if (loading && users.length === 0) {
    return (
      <Box textAlign="center" py={8}>
        <Text>Loading users...</Text>
      </Box>
    );
  }

  return (
    <Box>
      <HStack justify="space-between" mb={6}>
        <Heading as="h2" size="md">
          Manajemen User
        </Heading>
        <Button
          leftIcon={<AddIcon />}
          colorScheme="blue"
          onClick={handleCreateOpen}
        >
          Tambah User
        </Button>
      </HStack>

      {/* Filters */}
      <HStack spacing={4} mb={6}>
        <FormControl maxW="200px">
          <FormLabel fontSize="sm">Filter Role</FormLabel>
          <Select
            size="sm"
            value={selectedRole}
            onChange={(e) => handleRoleFilterChange(e.target.value)}
          >
            <option value="all">Semua Role</option>
            <option value="ADMIN">Admin</option>
            <option value="SISWA">Siswa</option>
          </Select>
        </FormControl>

        <FormControl maxW="200px">
          <FormLabel fontSize="sm">Filter Status</FormLabel>
          <Select
            size="sm"
            value={selectedStatus}
            onChange={(e) => handleStatusFilterChange(e.target.value)}
          >
            <option value="all">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Non-aktif</option>
          </Select>
        </FormControl>
      </HStack>

      {/* Users Table */}
      <Box overflowX="auto">
        <Table variant="striped" colorScheme="gray">
          <Thead bg="gray.100">
            <Tr>
              <Th>Email</Th>
              <Th>Nama</Th>
              <Th>Role</Th>
              <Th>Status</Th>
              <Th>Aksi</Th>
            </Tr>
          </Thead>
          <Tbody>
            {users.length === 0 ? (
              <Tr>
                <Td colSpan={5} textAlign="center" py={8}>
                  <Text color="gray.500">Tidak ada user</Text>
                </Td>
              </Tr>
            ) : (
              users.map((user) => (
                <Tr key={user.id}>
                  <Td fontSize="sm">{user.email}</Td>
                  <Td fontSize="sm">{user.nama}</Td>
                  <Td>
                    <Badge colorScheme={getRoleColor(user.role)}>
                      {getRoleLabel(user.role)}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge colorScheme={user.isActive ? 'green' : 'red'}>
                      {user.isActive ? 'Aktif' : 'Non-aktif'}
                    </Badge>
                  </Td>
                  <Td>
                    <HStack spacing={2}>
                      <IconButton
                        aria-label="Edit"
                        icon={<EditIcon />}
                        size="sm"
                        onClick={() => handleEditOpen(user)}
                      />
                      <IconButton
                        aria-label="Delete"
                        icon={<DeleteIcon />}
                        size="sm"
                        colorScheme="red"
                        onClick={() => handleDeleteOpen(user.id)}
                      />
                    </HStack>
                  </Td>
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
      </Box>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <Flex justify="space-between" align="center" mt={6}>
          <Text fontSize="sm" color="gray.600">
            Halaman {pagination.currentPage} dari {pagination.totalPages} ({pagination.totalCount} users)
          </Text>
          <HStack spacing={2}>
            <IconButton
              aria-label="Previous"
              icon={<ChevronLeftIcon />}
              isDisabled={pagination.currentPage === 1}
              onClick={() => handlePageChange(pagination.currentPage - 1)}
            />
            <IconButton
              aria-label="Next"
              icon={<ChevronRightIcon />}
              isDisabled={pagination.currentPage === pagination.totalPages}
              onClick={() => handlePageChange(pagination.currentPage + 1)}
            />
          </HStack>
        </Flex>
      )}

      {/* Create User Modal */}
      <Modal isOpen={isCreateOpen} onClose={onCreateClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Tambah User</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isInvalid={!!createForm.errors.email}>
                <FormLabel>Email</FormLabel>
                <Input
                  name="email"
                  type="email"
                  value={createForm.values.email}
                  onChange={createForm.handleChange}
                  placeholder="user@example.com"
                />
                {createForm.errors.email && (
                  <FormErrorMessage>{createForm.errors.email}</FormErrorMessage>
                )}
              </FormControl>

              <FormControl isInvalid={!!createForm.errors.password}>
                <FormLabel>Password</FormLabel>
                <Input
                  name="password"
                  type="password"
                  value={createForm.values.password}
                  onChange={createForm.handleChange}
                  placeholder="••••••••"
                />
                {createForm.errors.password && (
                  <FormErrorMessage>{createForm.errors.password}</FormErrorMessage>
                )}
              </FormControl>

              <FormControl isInvalid={!!createForm.errors.nama}>
                <FormLabel>Nama</FormLabel>
                <Input
                  name="nama"
                  value={createForm.values.nama}
                  onChange={createForm.handleChange}
                  placeholder="Nama Lengkap"
                />
                {createForm.errors.nama && (
                  <FormErrorMessage>{createForm.errors.nama}</FormErrorMessage>
                )}
              </FormControl>

              <FormControl>
                <FormLabel>Role</FormLabel>
                <Select
                  name="role"
                  value={createForm.values.role}
                  onChange={createForm.handleChange}
                >
                  <option value="SISWA">Siswa</option>
                  <option value="ADMIN">Admin</option>
                </Select>
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button
              colorScheme="blue"
              mr={3}
              onClick={() => createForm.handleSubmit()}
              isLoading={createForm.isSubmitting}
            >
              Simpan
            </Button>
            <Button variant="ghost" onClick={onCreateClose}>
              Batal
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit User Modal */}
      <Modal isOpen={isEditOpen} onClose={onEditClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit User</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isInvalid={!!editForm.errors.email}>
                <FormLabel>Email</FormLabel>
                <Input
                  name="email"
                  type="email"
                  value={editForm.values.email}
                  onChange={editForm.handleChange}
                />
                {editForm.errors.email && (
                  <FormErrorMessage>{editForm.errors.email}</FormErrorMessage>
                )}
              </FormControl>

              <FormControl isInvalid={!!editForm.errors.nama}>
                <FormLabel>Nama</FormLabel>
                <Input
                  name="nama"
                  value={editForm.values.nama}
                  onChange={editForm.handleChange}
                />
                {editForm.errors.nama && (
                  <FormErrorMessage>{editForm.errors.nama}</FormErrorMessage>
                )}
              </FormControl>

              <FormControl>
                <FormLabel>Role</FormLabel>
                <Select
                  name="role"
                  value={editForm.values.role}
                  onChange={editForm.handleChange}
                >
                  <option value="SISWA">Siswa</option>
                  <option value="ADMIN">Admin</option>
                </Select>
              </FormControl>

              <FormControl display="flex" alignItems="center">
                <FormLabel htmlFor="isActive" mb="0">
                  Aktif
                </FormLabel>
                <Spacer />
                <Switch
                  id="isActive"
                  isChecked={editForm.values.isActive}
                  onChange={(e) =>
                    editForm.setFieldValue('isActive', e.target.checked)
                  }
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button
              colorScheme="blue"
              mr={3}
              onClick={() => editForm.handleSubmit()}
              isLoading={editForm.isSubmitting}
            >
              Simpan
            </Button>
            <Button variant="ghost" onClick={onEditClose}>
              Batal
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteOpen} onClose={onDeleteClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Hapus User?</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            Apakah Anda yakin ingin menghapus user ini? Tindakan ini tidak dapat
            dibatalkan.
          </ModalBody>
          <ModalFooter>
            <Button
              colorScheme="red"
              mr={3}
              onClick={handleDelete}
              isLoading={isDeleting}
            >
              Hapus
            </Button>
            <Button variant="ghost" onClick={onDeleteClose}>
              Batal
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
})
