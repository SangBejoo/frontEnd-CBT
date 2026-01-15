"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Button, VStack, Heading, Container, Tabs, TabList, Tab, TabPanels, TabPanel, HStack, Text } from '@chakra-ui/react';
import { useAuth } from '../auth-context';
import { DataProvider } from './context';
import LevelsTab from './components/LevelsTab';
const SubjectsTab = dynamic(() => import('./components/SubjectsTab'), { ssr: false });
import TopicsTab from './components/TopicsTab';
import dynamic from 'next/dynamic';

const QuestionsTab = dynamic(() => import('./components/QuestionsTab'), { ssr: false });
const DragDropQuestionsTab = dynamic(() => import('./components/DragDropQuestionsTab'), { ssr: false });
import UsersTab from './components/UsersTab';
import HistoryTab from './components/HistoryTab';
import { useSharedData } from './context';

export default function AdminHome() {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'ADMIN')) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    // Load active tab from localStorage
    const savedTab = localStorage.getItem('adminActiveTab');
    if (savedTab) {
      setActiveTab(parseInt(savedTab, 10));
    }
  }, []);

  const handleTabChange = (index: number) => {
    setActiveTab(index);
    localStorage.setItem('adminActiveTab', index.toString());
  };

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

  if (!user || user.role !== 'ADMIN') {
    return null; // Will redirect
  }

  // Wrapper to pass topics from context to DragDropQuestionsTab
  const DragDropQuestionsWrapper = () => {
    const { topics } = useSharedData();
    return <DragDropQuestionsTab topics={topics} />;
  };

  return (
    <DataProvider>
      <Box
        minH="100vh"
        bgGradient="linear(135deg, #FFF5EB 0%, #FFE8D6 100%)"
        py={10}
      >
        <Container maxW="container.xl">
          <HStack justify="space-between" mb={8}>
          <Box>
            <Heading
              as="h1"
              size="xl"
              color="#FF6B35"
              mb={2}
            >
              Panel Admin CBT
            </Heading>
            <Text color="gray.600" fontSize="sm">
              Selamat datang, <span style={{ fontWeight: 'bold', color: '#FF6B35' }}>{user.nama}</span>
            </Text>
          </Box>
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

        <Box
          bg="white"
          borderRadius="2xl"
          borderWidth="2px"
          borderColor="#FFD4B8"
          boxShadow="0 4px 20px rgba(255, 107, 53, 0.1)"
          p={6}
        >
          <Tabs
            variant="enclosed"
            colorScheme="orange"
            isLazy
            index={activeTab}
            onChange={handleTabChange}
          >
            <TabList
              borderBottomColor="#FFD4B8"
              borderBottomWidth="2px"
            >
              <Tab
                _selected={{
                  color: 'white',
                  bg: '#FF6B35',
                  borderColor: '#FF6B35',
                }}
                color="gray.600"
                fontWeight="600"
                _hover={{
                  color: '#FF6B35',
                }}
              >
                Tingkat
              </Tab>
              <Tab
                _selected={{
                  color: 'white',
                  bg: '#FF6B35',
                  borderColor: '#FF6B35',
                }}
                color="gray.600"
                fontWeight="600"
                _hover={{
                  color: '#FF6B35',
                }}
              >
                Mata Pelajaran
              </Tab>
              <Tab
                _selected={{
                  color: 'white',
                  bg: '#FF6B35',
                  borderColor: '#FF6B35',
                }}
                color="gray.600"
                fontWeight="600"
                _hover={{
                  color: '#FF6B35',
                }}
              >
                Materi
              </Tab>
              <Tab
                _selected={{
                  color: 'white',
                  bg: '#FF6B35',
                  borderColor: '#FF6B35',
                }}
                color="gray.600"
                fontWeight="600"
                _hover={{
                  color: '#FF6B35',
                }}
              >
                Soal
              </Tab>
              <Tab
                _selected={{
                  color: 'white',
                  bg: '#9F7AEA',
                  borderColor: '#9F7AEA',
                }}
                color="gray.600"
                fontWeight="600"
                _hover={{
                  color: '#9F7AEA',
                }}
              >
                🎯 Soal D&D
              </Tab>
              <Tab
                _selected={{
                  color: 'white',
                  bg: '#FF6B35',
                  borderColor: '#FF6B35',
                }}
                color="gray.600"
                fontWeight="600"
                _hover={{
                  color: '#FF6B35',
                }}
              >
                Users
              </Tab>
              <Tab
                _selected={{
                  color: 'white',
                  bg: '#FF6B35',
                  borderColor: '#FF6B35',
                }}
                color="gray.600"
                fontWeight="600"
                _hover={{
                  color: '#FF6B35',
                }}
              >
                History
              </Tab>
            </TabList>
            <TabPanels pt={6}>
              <TabPanel>
                <LevelsTab />
              </TabPanel>
              <TabPanel>
                <SubjectsTab />
              </TabPanel>
              <TabPanel>
                <TopicsTab />
              </TabPanel>
              <TabPanel>
                <QuestionsTab />
              </TabPanel>
              <TabPanel>
                <DragDropQuestionsWrapper />
              </TabPanel>
              <TabPanel>
                <UsersTab />
              </TabPanel>
              <TabPanel>
                <HistoryTab />
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Box>
      </Container>
    </Box>
    </DataProvider>
  );
}