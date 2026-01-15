'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Spinner, Text } from '@chakra-ui/react';
import { useAuth } from './auth-context';

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        // User is authenticated, redirect based on role
        if (user.role === 'ADMIN') {
          router.push('/admin');
        } else {
          router.push('/student');
        }
      } else {
        // User is not authenticated, redirect to login
        router.push('/login');
      }
    }
  }, [user, isLoading, router]);

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      flexDirection="column"
    >
      <Spinner size="xl" color="blue.500" mb={4} />
      <Text>Loading CBT System...</Text>
    </Box>
  );
}
