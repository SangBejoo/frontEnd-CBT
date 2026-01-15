'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  Container,
  FormControl,
  FormLabel,
  Input,
  VStack,
  Heading,
  Text,
  Alert,
  AlertIcon,
  Card,
  CardBody,
} from '@chakra-ui/react';
import { useAuth } from '../auth-context';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const userData = await login(email, password);

      // Redirect based on role
      if (userData.role === 'ADMIN') {
        router.push('/admin');
      } else if (userData.role === 'SISWA') {
        router.push('/student');
      } else {
        router.push('/student'); // Default fallback
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box
      minH="100vh"
      bgGradient="linear(135deg, #FFF5EB 0%, #FFE8D6 100%)"
      display="flex"
      alignItems="center"
      justifyContent="center"
      py={8}
    >
      <Container maxW="sm">
        <Card
          borderRadius="2xl"
          borderWidth="3px"
          borderColor="#FF6B35"
          bg="white"
          boxShadow="0 4px 20px rgba(255, 107, 53, 0.15)"
        >
          <CardBody p={8}>
            <VStack spacing={6}>
              <Box textAlign="center">
                <Heading
                  as="h1"
                  size="xl"
                  mb={2}
                  color="#FF6B35"
                >
                  CBT System
                </Heading>
                <Text color="gray.600" fontSize="sm">
                  Computer-Based Test Management System
                </Text>
              </Box>

              <Box w="full">
                <form onSubmit={handleSubmit}>
                  <VStack spacing={4}>
                    <FormControl isRequired>
                      <FormLabel color="gray.700" fontWeight="600">
                        Email
                      </FormLabel>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Masukkan email anda"
                        borderColor="#FFD4B8"
                        _focus={{
                          borderColor: '#FF6B35',
                          boxShadow: '0 0 0 1px #FF6B35',
                        }}
                        size="lg"
                      />
                    </FormControl>

                    <FormControl isRequired>
                      <FormLabel color="gray.700" fontWeight="600">
                        Password
                      </FormLabel>
                      <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Masukkan password anda"
                        borderColor="#FFD4B8"
                        _focus={{
                          borderColor: '#FF6B35',
                          boxShadow: '0 0 0 1px #FF6B35',
                        }}
                        size="lg"
                      />
                    </FormControl>

                    {error && (
                      <Alert status="error" borderRadius="lg" bg="#FFE8D6">
                        <AlertIcon color="#FF6B35" />
                        <Box color="#FF6B35" fontSize="sm">
                          {error}
                        </Box>
                      </Alert>
                    )}

                    <Button
                      type="submit"
                      bg="#FF6B35"
                      color="white"
                      size="lg"
                      width="full"
                      isLoading={isLoading}
                      loadingText="Masuk..."
                      _hover={{
                        bg: '#E55A24',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 8px 16px rgba(255, 107, 53, 0.3)',
                      }}
                      _active={{
                        bg: '#D94817',
                      }}
                      fontWeight="bold"
                      fontSize="md"
                      transition="all 0.3s ease"
                      borderRadius="lg"
                    >
                      Masuk
                    </Button>
                  </VStack>
                </form>
              </Box>
            </VStack>
          </CardBody>
        </Card>
      </Container>
    </Box>
  );
}