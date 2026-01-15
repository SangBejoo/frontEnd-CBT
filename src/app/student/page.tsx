'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Box, Button, VStack, Heading, Container, Text, HStack } from '@chakra-ui/react';
import { useAuth } from '../auth-context';

export default function StudentHome() {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'SISWA')) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (isLoading) {
    return (
      <Box
        minH="100vh"
        bgGradient="linear(135deg, #FFF5EB 0%, #FFE8D6 100%)"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Text color="#FF6B35" fontSize="lg">Loading...</Text>
      </Box>
    );
  }

  if (!user || user.role !== 'SISWA') {
    return null; // Will redirect
  }

  return (
    <Box
      minH="100vh"
      bgGradient="linear(135deg, #FFF5EB 0%, #FFE8D6 100%)"
      py={16}
    >
      <Container maxW="container.lg">
        <HStack justify="space-between" mb={12} align="flex-start">
          <Box />
          <Button
            bg="#FF6B35"
            color="white"
            onClick={handleLogout}
            _hover={{
              bg: '#E55A24',
              transform: 'translateY(-2px)',
              boxShadow: '0 8px 16px rgba(255, 107, 53, 0.3)',
            }}
            _active={{
              bg: '#D94817',
            }}
            fontWeight="bold"
            transition="all 0.3s ease"
            borderRadius="lg"
          >
            Logout
          </Button>
        </HStack>

        <VStack spacing={12}>
          <Box textAlign="center">
            <Heading
              as="h1"
              size="3xl"
              color="#FF6B35"
              mb={4}
              fontWeight="800"
            >
              Portal Siswa CBT
            </Heading>
            <Text fontSize="xl" color="gray.700" maxW="2xl" mx="auto" mb={2} fontWeight="500">
              Selamat datang, <span style={{ color: '#FF6B35', fontWeight: 'bold' }}>{user.nama}</span>!
            </Text>
            <Text fontSize="lg" color="gray.600">
              Sistem Computer-Based Test - Pilih menu di bawah untuk memulai pembelajaran Anda.
            </Text>
          </Box>

          <Box
            bg="white"
            p={8}
            borderRadius="2xl"
            shadow="0 4px 20px rgba(255, 107, 53, 0.1)"
            border="2px solid"
            borderColor="#FFD4B8"
            w="full"
            maxW="md"
          >
            <VStack spacing={6}>
              <Link href="/student/sessions" style={{ width: '100%' }}>
                <Button
                  bg="#FF6B35"
                  color="white"
                  size="lg"
                  width="full"
                  height="16"
                  fontSize="lg"
                  borderRadius="xl"
                  fontWeight="bold"
                  _hover={{
                    bg: '#E55A24',
                    shadow: 'lg',
                    transform: 'translateY(-2px)',
                  }}
                  _active={{
                    bg: '#D94817',
                  }}
                  transition="all 0.3s ease"
                >
                  Ikuti Tes
                </Button>
              </Link>

              <Link href="/student/history" style={{ width: '100%' }}>
                <Button
                  bg="white"
                  color="#FF6B35"
                  border="2px solid"
                  borderColor="#FF6B35"
                  size="lg"
                  width="full"
                  height="16"
                  fontSize="lg"
                  borderRadius="xl"
                  fontWeight="bold"
                  _hover={{
                    bg: '#FFF5EB',
                    shadow: 'lg',
                    transform: 'translateY(-2px)',
                  }}
                  _active={{
                    bg: '#FFE8D6',
                  }}
                  transition="all 0.3s ease"
                >
                  Lihat Riwayat
                </Button>
              </Link>
            </VStack>
          </Box>
        </VStack>
      </Container>
    </Box>
  );
}