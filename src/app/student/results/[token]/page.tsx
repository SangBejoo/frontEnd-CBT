'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Box,
  Button,
  VStack,
  Heading,
  Container,
  useToast,
  Card,
  CardBody,
  Text,
  Stat,
  StatLabel,
  StatNumber,
  StatGroup,
  Badge,
  SimpleGrid,
  HStack,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  RadioGroup,
  Radio,
  Image,
  FormControl,
  FormLabel,
  Input,
  Spinner,
} from '@chakra-ui/react';
import axios from 'axios';
import { useAuth } from '../../../auth-context';

interface DragItem {
  id: number;
  label: string;
  imageUrl?: string;
  urutan: number;
}

interface DragSlot {
  id: number;
  label: string;
  imageUrl?: string;
  urutan: number;
}

interface TestResultResponse {
  sessionInfo: {
    id: number;
    sessionToken: string;
    namaPeserta: string;
    tingkat: {
      id: number;
      nama: string;
    };
    mataPelajaran: {
      id: number;
      nama: string;
    };
    waktuMulai: string;
    waktuSelesai: string;
    batasWaktu: string;
    durasiMenit: number;
    nilaiAkhir: number;
    jumlahBenar: number;
    totalSoal: number;
    status: string;
  };
  detailJawaban: Array<{
    nomorUrut: number;
    pertanyaan: string;
    opsiA: string;
    opsiB: string;
    opsiC: string;
    opsiD: string;
    jawabanDipilih: string | null;
    jawabanBenar: string;
    isCorrect: boolean;
    isAnswered: boolean;
    pembahasan?: string;
    gambar?: Array<{
      id: number;
      namaFile: string;
      filePath: string;
      fileSize: number;
      mimeType: string;
      urutan: number;
      keterangan?: string;
      createdAt: string;
    }>;
    // New Fields for Drag Drop
    questionType?: 'MULTIPLE_CHOICE' | 'DRAG_DROP';
    dragType?: 'ORDERING' | 'MATCHING';
    items?: DragItem[];
    slots?: DragSlot[];
    userDragAnswer?: Record<number, number>;
    correctDragAnswer?: Record<number, number>;
  }>;
  tingkat: Array<{
    id: number;
    nama: string;
  }>;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE + '/v1/test-sessions';

export default function ResultsPage() {
  const params = useParams();
  const token = params.token as string;
  const router = useRouter();
  const toast = useToast();
  const { isLoading: isAuthLoading } = useAuth();

  const [result, setResult] = useState<TestResultResponse | null>(null);
  const [materi, setMateri] = useState<{id: number; nama: string} | null>(null);
  const [loading, setLoading] = useState(true);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isShareOpen, onOpen: onShareOpen, onClose: onShareClose } = useDisclosure();
  const [selectedQuestion, setSelectedQuestion] = useState<any>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showReview, setShowReview] = useState(false);

  // Share form state
  const [shareForm, setShareForm] = useState({
    namaSekolah: '',
    kelas: '',
    email: '',
  });
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    if (!isAuthLoading) {
      fetchResult();
    }
  }, [token, isAuthLoading]);

  const fetchResult = async () => {
    try {
      const response = await axios.get(`${API_BASE}/${token}/result`);
      const resultData = response.data as TestResultResponse;
      setResult(resultData);
      
      // Fetch materi data
      await fetchMateri(resultData.sessionInfo.mataPelajaran.id, resultData.sessionInfo.tingkat.id);
    } catch (error) {
      console.error('Error fetching result:', error);
      toast({ title: 'Error loading results', status: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchMateri = async (mataPelajaranId: number, tingkatId: number) => {
    try {
      const response = await axios.get(process.env.NEXT_PUBLIC_API_BASE + '/v1/materi');
      const materiList = response.data.materi || [];
      
      // Find materi that matches the session's mataPelajaran and tingkat
      const matchingMateri = materiList.find((m: any) => 
        m.mataPelajaran.id === mataPelajaranId && m.tingkat.id === tingkatId
      );
      
      if (matchingMateri) {
        setMateri({ id: matchingMateri.id, nama: matchingMateri.nama });
      }
    } catch (error) {
      console.error('Error fetching materi:', error);
      // Don't show error toast for materi fetch failure
    }
  };

  const openQuestionDetail = (question: any) => {
    setSelectedQuestion(question);
    onOpen();
  };

  const goToQuestion = (index: number) => {
    setCurrentQuestionIndex(index);
  };

  const handleShareClick = () => {
    onShareOpen();
  };

  const resultCardRef = useRef<HTMLDivElement>(null);

  const downloadResultAsPDF = async () => {
    if (!resultCardRef.current) return;

    try {
      setIsSharing(true);
      const element = resultCardRef.current;
      
      // Import libraries
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).jsPDF;

      // Create canvas from HTML element
      const canvas = await html2canvas(element, {
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });

      // Create PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const imgWidth = 190; // A4 width - margins
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      // Add image to PDF (handle multiple pages if needed)
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pdf.internal.pageSize.getHeight();

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= pdf.internal.pageSize.getHeight();
      }

      // Save PDF
      const filename = `Hasil-Tes-${result?.sessionInfo.namaPeserta}-${new Date().toLocaleDateString('id-ID').replace(/\//g, '-')}.pdf`;
      pdf.save(filename);

      toast({
        title: '✅ PDF berhasil diunduh',
        status: 'success',
        duration: 3000,
      });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({
        title: '❌ Gagal mengunduh PDF',
        description: 'Silakan coba lagi atau hubungi administrator',
        status: 'error',
        duration: 4000,
      });
    } finally {
      setIsSharing(false);
    }
  };

  const shareViaEmail = async () => {
    // Validate form
    if (!shareForm.namaSekolah.trim() || !shareForm.kelas.trim() || !shareForm.email.trim()) {
      toast({ 
        title: '⚠️ Validasi Gagal', 
        description: 'Semua field harus diisi',
        status: 'warning',
        duration: 3000,
      });
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(shareForm.email)) {
      toast({ 
        title: '⚠️ Email Tidak Valid', 
        description: 'Format email tidak sesuai',
        status: 'warning',
        duration: 3000,
      });
      return;
    }

    setIsSharing(true);
    try {
      // Prepare email payload
      const emailPayload = {
        to: shareForm.email,
        subject: `Hasil Tes CBT - ${result?.sessionInfo.namaPeserta}`,
        namaSekolah: shareForm.namaSekolah,
        kelas: shareForm.kelas,
        studentName: result?.sessionInfo.namaPeserta,
        subject_name: result?.sessionInfo.mataPelajaran.nama,
        level_name: result?.sessionInfo.tingkat.nama,
        score: result?.sessionInfo.nilaiAkhir,
        correctAnswers: result?.sessionInfo.jumlahBenar,
        totalQuestions: result?.sessionInfo.totalSoal,
        startTime: result?.sessionInfo.waktuMulai,
        endTime: result?.sessionInfo.waktuSelesai,
        duration: actualDurationMinutes,
        status: result?.sessionInfo.status,
        sessionToken: token,
      };

      // Send to backend
      const response = await axios.post(
        process.env.NEXT_PUBLIC_API_BASE + '/v1/test-sessions/share-email',
        emailPayload,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.status === 200 || response.status === 201) {
        toast({
          title: '✅ Email Berhasil Dikirim',
          description: `Hasil tes telah dikirim ke ${shareForm.email}`,
          status: 'success',
          duration: 4000,
        });

        // Reset form and close after a delay
        setTimeout(() => {
          setShareForm({ namaSekolah: '', kelas: '', email: '' });
          onShareClose();
        }, 2000);
      }
    } catch (error: any) {
      console.error('Error sharing via email:', error);
      
      const errorMessage = error?.response?.data?.message || 
                          'Silakan coba lagi atau hubungi administrator';
      
      toast({
        title: '❌ Gagal Mengirim Email',
        description: errorMessage,
        status: 'error',
        duration: 4000,
      });
    } finally {
      setIsSharing(false);
    }
  };

  const goToNextQuestion = () => {
    if (currentQuestionIndex < result!.detailJawaban.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  if (loading || isAuthLoading) {
    return (
      <Container maxW="container.lg" py={10}>
        <VStack spacing={6}>
          <Heading size="lg">Loading Test Results...</Heading>
          <Box p={8} bg="blue.50" borderRadius="lg" w="full" textAlign="center">
            <Text fontSize="lg" color="blue.600">Please wait while we fetch your results</Text>
            <Text fontSize="sm" color="gray.600" mt={2}>This may take a few moments...</Text>
          </Box>
        </VStack>
      </Container>
    );
  }

  if (!result?.sessionInfo) {
    return (
      <Container maxW="container.lg" py={10}>
        <VStack spacing={6}>
          <Heading size="lg" color="red.500">Results Not Available</Heading>
          <Box p={8} bg="red.50" borderRadius="lg" w="full" textAlign="center">
            <Text fontSize="lg" color="red.600">Unable to load test results</Text>
            <Text fontSize="sm" color="gray.600" mt={2}>Please check your session token or try again later</Text>
            <Link href="/student">
              <Button mt={4} colorScheme="blue">Back to Home</Button>
            </Link>
          </Box>
        </VStack>
      </Container>
    );
  }

  const sessionInfo = result.sessionInfo;
  const scorePercentage = sessionInfo.nilaiAkhir || 0;
  const isPassed = scorePercentage >= 70; // Assuming 70% pass mark

  // Calculate actual duration from start and end time
  const startTime = new Date(sessionInfo.waktuMulai);
  const endTime = new Date(sessionInfo.waktuSelesai);
  const actualDurationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));

  return (
    <Container maxW="container.lg" py={10}>
      <VStack spacing={8}>
        {/* Header Box - Orange Design */}
        <Card width="full" bg="orange.50" borderWidth="2px" borderColor="orange.200" borderRadius="xl">
          <CardBody>
            <VStack spacing={6}>
              <HStack justify="center" spacing={4}>
                <Box bg="orange.500" p={4} borderRadius="md" color="white" fontWeight="bold" fontSize="lg">
                  CBT
                </Box>
                <VStack align="start" spacing={0}>
                  <Text fontWeight="bold" fontSize="xl" color="orange.700">
                    {sessionInfo.mataPelajaran.nama.toUpperCase()} {sessionInfo.tingkat.nama} SD KELAS {sessionInfo.tingkat.nama === '1' ? 'I' : sessionInfo.tingkat.nama === '2' ? 'II' : sessionInfo.tingkat.nama === '3' ? 'III' : 'IV'}{materi ? ` - ${materi.nama.toUpperCase()}` : ''}
                  </Text>
                  <Text fontSize="sm" color="gray.600">
                    {sessionInfo.namaPeserta || 'Hasil Tes Anda'}
                  </Text>
                </VStack>
              </HStack>
            </VStack>
          </CardBody>
        </Card>

        {/* Score Card - Big Number */}
        <Card width="full" borderWidth="2px" borderColor="gray.200" borderRadius="xl">
          <CardBody py={8}>
            <VStack spacing={6}>
              <Box textAlign="center">
                <Badge colorScheme="orange" fontSize="md" px={4} py={2} borderRadius="md" mb={4}>
                  Nilai CBT
                </Badge>
                <Text fontSize="sm" color="gray.600" mb={2}>
                  Total nilai kamu adalah
                </Text>
                <Text fontSize="8xl" fontWeight="bold" color="orange.500" lineHeight="1">
                  {scorePercentage.toFixed(2)}
                </Text>
                <Text fontSize="md" color="gray.600" mt={4}>
                  Selamat kamu mendapatkan nilai yang bagus! Tingkatkan terus belajar kamu, agar meraih angka yang lebih baik lagi!
                </Text>
              </Box>

              {/* Buttons */}
              <HStack spacing={4} width="full" justify="center" mt={4}>
                <Button
                  variant="outline"
                  colorScheme="orange"
                  size="md"
                  onClick={handleShareClick}
                >
                  Bagikan Nilai
                </Button>
                <Button
                  colorScheme="orange"
                  size="md"
                  onClick={() => setShowReview(!showReview)}
                >
                  Pembahasan Kunci
                </Button>
              </HStack>
            </VStack>
          </CardBody>
        </Card>

        {/* Review Section - Collapsible */}
        {showReview && (
          <Card width="full" borderWidth="2px" borderColor="blue.200" borderRadius="xl" bg="blue.50">
            <CardBody>
              <VStack spacing={6} align="stretch">
                <Box textAlign="center">
                  <Heading size="md" color="blue.700">Pembahasan Soal</Heading>
                </Box>

                {/* Stats */}
                <Box bg="white" p={4} borderRadius="md">
                  <VStack spacing={4}>
                    <SimpleGrid columns={materi ? 4 : 3} spacing={4} w="full">
                      <Stat textAlign="center">
                        <StatLabel fontSize="sm" color="gray.600">Nama Siswa</StatLabel>
                        <StatNumber fontSize="md" color="gray.800">{sessionInfo.namaPeserta}</StatNumber>
                      </Stat>
                      <Stat textAlign="center">
                        <StatLabel fontSize="sm" color="gray.600">Mata Pelajaran</StatLabel>
                        <StatNumber fontSize="md" color="gray.800">{sessionInfo.mataPelajaran.nama}</StatNumber>
                      </Stat>
                      <Stat textAlign="center">
                        <StatLabel fontSize="sm" color="gray.600">Kelas</StatLabel>
                        <StatNumber fontSize="md" color="gray.800">{sessionInfo.tingkat.nama}</StatNumber>
                      </Stat>
                      {materi && (
                        <Stat textAlign="center">
                          <StatLabel fontSize="sm" color="gray.600">Materi</StatLabel>
                          <StatNumber fontSize="md" color="gray.800">{materi.nama}</StatNumber>
                        </Stat>
                      )}
                    </SimpleGrid>
                    <Button colorScheme="orange" size="sm" width="fit-content">
                      Bagikan
                    </Button>
                  </VStack>
                </Box>

                {/* Two Column Layout: Daftar Soal + Question Detail */}
                <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6} alignItems="start">
                  {/* Left Column: Daftar Soal */}
                  <Box bg="white" p={6} borderRadius="md" height="fit-content" position="sticky" top="20px">
                    <Heading size="sm" mb={4}>Daftar Soal</Heading>
                    {result.detailJawaban && result.detailJawaban.length > 0 ? (
                      <>
                        <SimpleGrid columns={5} spacing={2}>
                          {result.detailJawaban.map((jawaban) => {
                            let colorScheme = 'gray'; // Default: tidak dijawab
                            
                            if (jawaban.isAnswered) {
                              // Question was answered
                              if (jawaban.isCorrect) {
                                colorScheme = 'green';
                              } else {
                                colorScheme = 'red';
                              }
                            }

                            const isSelected = currentQuestionIndex === result.detailJawaban.findIndex(j => j.nomorUrut === jawaban.nomorUrut);

                        return (
                          <Button
                            key={jawaban.nomorUrut}
                            onClick={() => {
                              setCurrentQuestionIndex(result.detailJawaban.findIndex(j => j.nomorUrut === jawaban.nomorUrut));
                            }}
                            size="md"
                            colorScheme={colorScheme}
                            variant="solid"
                            borderRadius="md"
                            borderWidth={isSelected ? '3px' : '0px'}
                            borderColor={isSelected ? 'blue.500' : 'transparent'}
                            _hover={{ transform: 'scale(1.05)' }}
                            transition="all 0.2s"
                          >
                            {jawaban.nomorUrut}
                          </Button>
                        );
                      })}
                    </SimpleGrid>
                    <VStack spacing={2} fontSize="xs" align="start" mt={4} px={2}>
                      <HStack>
                        <Box w="12px" h="12px" bg="green.500" borderRadius="sm" />
                        <Text>Benar</Text>
                      </HStack>
                      <HStack>
                        <Box w="12px" h="12px" bg="red.500" borderRadius="sm" />
                        <Text>Salah</Text>
                      </HStack>
                      <HStack>
                        <Box w="12px" h="12px" bg="gray.500" borderRadius="sm" />
                        <Text>Tidak Menjawab</Text>
                      </HStack>
                    </VStack>
                      </>
                    ) : (
                      <Text fontSize="sm" color="gray.500" textAlign="center" py={4}>
                        Tidak ada soal untuk ditampilkan
                      </Text>
                    )}
                  </Box>

                  {/* Right Column: Question Detail */}
                  {result.detailJawaban && result.detailJawaban.length > 0 ? (() => {
                    const currentJawaban = result.detailJawaban[currentQuestionIndex];
                    if (!currentJawaban) {
                      return (
                        <Card bg="white" borderRadius="md">
                          <CardBody>
                            <VStack spacing={6} align="stretch" py={8}>
                              <Text fontSize="lg" color="gray.600" textAlign="center">
                                Tidak ada data soal untuk ditampilkan
                              </Text>
                            </VStack>
                          </CardBody>
                        </Card>
                      );
                    }
                    return (
                      <Card bg="white" borderRadius="md">
                        <CardBody>
                          <VStack spacing={6} align="stretch">
                            <HStack justify="space-between">
                              <Badge colorScheme="blue" fontSize="md" px={3} py={1}>
                                Soal No. {currentJawaban.nomorUrut}
                              </Badge>
                              <Badge
                                colorScheme={
                                  !currentJawaban.isAnswered
                                    ? 'gray'
                                    : currentJawaban.isCorrect
                                    ? 'green'
                                    : 'red'
                                }
                                fontSize="md"
                                px={3}
                                py={1}
                              >
                                {!currentJawaban.isAnswered
                                  ? 'Tidak Menjawab'
                                  : currentJawaban.isCorrect
                                  ? 'Benar'
                                  : 'Salah'}
                              </Badge>
                            </HStack>

                            <Text fontSize="lg" fontWeight="medium">
                              {currentJawaban.pertanyaan}
                            </Text>

                            {/* Images */}
                            {currentJawaban.gambar && Array.isArray(currentJawaban.gambar) && currentJawaban.gambar.length > 0 && (
                              <Box>
                                <Text fontSize="sm" color="gray.600" mb={2}>
                                  Perhatikan gambar dibawah ini
                                </Text>
                                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                                  {currentJawaban.gambar
                                    .sort((a, b) => a.urutan - b.urutan)
                                    .map((img) => (
                                      <Box key={img.id} borderWidth="1px" borderRadius="md" p={2} bg="gray.50">
                                        <Image
                                          src={img.filePath || ''}
                                          alt={img.keterangan || 'Gambar soal'}
                                          maxH="300px"
                                          objectFit="contain"
                                          mx="auto"
                                        />
                                        {img.keterangan && (
                                          <Text fontSize="sm" color="gray.600" mt={2} textAlign="center">
                                            {img.keterangan}
                                          </Text>
                                        )}
                                      </Box>
                                    ))}
                                </SimpleGrid>
                              </Box>
                            )}

                            {/* Options / Answers Display */}
                            <VStack spacing={3} align="stretch">
                              <Text fontSize="sm" color="gray.600" mb={-2}>
                                {currentJawaban.pertanyaan}
                              </Text>

                              {currentJawaban.questionType === 'DRAG_DROP' ? (
                                <Box mt={4}>
                                  {currentJawaban.dragType === 'MATCHING' ? (
                                    <VStack spacing={4} align="stretch">
                                      <Text fontWeight="bold" color="gray.700">Hasil Pencocokan:</Text>
                                      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                                        {currentJawaban.slots?.map((slot) => {
                                          const userItems = currentJawaban.items?.filter(item => currentJawaban.userDragAnswer?.[item.id] === slot.id) || [];
                                          const correctItems = currentJawaban.items?.filter(item => currentJawaban.correctDragAnswer?.[item.id] === slot.id) || [];
                                          
                                          // Sort correct items by label for consistency
                                          correctItems.sort((a, b) => a.label.localeCompare(b.label));
                                          
                                          return (
                                            <Card key={slot.id} variant="outline" bg="gray.50">
                                              <CardBody p={3}>
                                                <VStack align="stretch" spacing={3}>
                                                  <Box borderBottom="1px" borderColor="gray.200" pb={2}>
                                                    <HStack spacing={2}>
                                                      {slot.imageUrl && (
                                                        <Image 
                                                          src={slot.imageUrl} 
                                                          alt={slot.label} 
                                                          boxSize="40px" 
                                                          objectFit="cover" 
                                                          borderRadius="md"
                                                        />
                                                      )}
                                                      <Text fontWeight="bold" color="purple.600">{slot.label}</Text>
                                                    </HStack>
                                                  </Box>
                                                  
                                                  <VStack align="stretch" spacing={2}>
                                                    <Text fontSize="xs" fontWeight="bold" color="gray.500">Jawaban Anda:</Text>
                                                    {userItems.length > 0 ? (
                                                      userItems.map(item => {
                                                        const isCorrect = currentJawaban.correctDragAnswer?.[item.id] === slot.id;
                                                        return (
                                                          <HStack key={item.id} p={2} bg={isCorrect ? "green.100" : "red.100"} borderRadius="md" justify="space-between">
                                                            <HStack spacing={2}>
                                                              {item.imageUrl && (
                                                                <Image 
                                                                  src={item.imageUrl} 
                                                                  alt={item.label} 
                                                                  boxSize="32px" 
                                                                  objectFit="cover" 
                                                                  borderRadius="sm"
                                                                />
                                                              )}
                                                              <Text fontSize="sm">{item.label}</Text>
                                                            </HStack>
                                                            {isCorrect ? (
                                                              <Badge colorScheme="green">✓</Badge>
                                                            ) : (
                                                              <Badge colorScheme="red">✗</Badge>
                                                            )}
                                                          </HStack>
                                                        );
                                                      })
                                                    ) : (
                                                      <Text fontSize="xs" color="gray.400" fontStyle="italic">Kosong</Text>
                                                    )}
                                                  </VStack>

                                                  <VStack align="stretch" spacing={2} pt={2} borderTop="1px dashed" borderColor="gray.300">
                                                    <Text fontSize="xs" fontWeight="bold" color="green.600">Kunci Jawaban:</Text>
                                                    {correctItems.map(item => (
                                                      <HStack key={item.id} p={1} pl={2}>
                                                        <Box w="6px" h="6px" borderRadius="full" bg="green.400" />
                                                        {item.imageUrl && (
                                                          <Image 
                                                            src={item.imageUrl} 
                                                            alt={item.label} 
                                                            boxSize="28px" 
                                                            objectFit="cover" 
                                                            borderRadius="sm"
                                                          />
                                                        )}
                                                        <Text fontSize="sm" color="gray.700">{item.label}</Text>
                                                      </HStack>
                                                    ))}
                                                  </VStack>
                                                </VStack>
                                              </CardBody>
                                            </Card>
                                          );
                                        })}
                                      </SimpleGrid>
                                    </VStack>
                                  ) : (
                                    <VStack spacing={4} align="stretch">
                                      <Text fontWeight="bold" color="gray.700">Urutan Benar vs Jawaban Anda:</Text>
                                      
                                      {/* Correct Order */}
                                      <Box p={4} bg="green.50" borderRadius="lg" border="1px" borderColor="green.200">
                                        <Text fontWeight="bold" color="green.700" mb={3}>Kunci Urutan Benar:</Text>
                                        <VStack align="stretch" spacing={2}>
                                          {(() => {
                                            // Build correct order from correctDragAnswer
                                            // correctDragAnswer: { itemId: slotId } - we need to find which item goes to each slot position
                                            const slots = [...(currentJawaban.slots || [])].sort((a, b) => a.urutan - b.urutan);
                                            
                                            return slots.map((slot, index) => {
                                              // Find which item should be in this slot
                                              let correctItem = null;
                                              
                                              if (currentJawaban.correctDragAnswer) {
                                                // Find itemId where correctDragAnswer[itemId] === slot.id
                                                const itemIdStr = Object.keys(currentJawaban.correctDragAnswer).find(
                                                  key => currentJawaban.correctDragAnswer![Number(key)] === slot.id
                                                );
                                                if (itemIdStr) {
                                                  correctItem = currentJawaban.items?.find(i => i.id === Number(itemIdStr));
                                                }
                                              }
                                              
                                              // Fallback: if no correctDragAnswer, use old logic (item.urutan === slot.urutan)
                                              if (!correctItem && !currentJawaban.correctDragAnswer) {
                                                correctItem = currentJawaban.items?.find(i => i.urutan === slot.urutan);
                                              }
                                              
                                              return (
                                                <HStack key={slot.id} spacing={3} p={2} bg="white" borderRadius="md" shadow="sm">
                                                  <Box 
                                                    w="24px" h="24px" bg="green.500" color="white" 
                                                    borderRadius="full" fontSize="xs" display="flex" 
                                                    alignItems="center" justifyContent="center" fontWeight="bold"
                                                  >
                                                    {index + 1}
                                                  </Box>
                                                  {correctItem?.imageUrl && (
                                                    <Image 
                                                      src={correctItem.imageUrl} 
                                                      alt={correctItem.label} 
                                                      boxSize="36px" 
                                                      objectFit="cover" 
                                                      borderRadius="sm"
                                                    />
                                                  )}
                                                  <Text fontSize="sm">{correctItem?.label || '?'}</Text>
                                                </HStack>
                                              );
                                            });
                                          })()}
                                        </VStack>
                                      </Box>

                                      {/* User Order */}
                                      <Box p={4} bg={currentJawaban.isCorrect ? "blue.50" : "red.50"} borderRadius="lg" border="1px" borderColor={currentJawaban.isCorrect ? "blue.200" : "red.200"}>
                                        <Text fontWeight="bold" color={currentJawaban.isCorrect ? "blue.700" : "red.700"} mb={3}>
                                          Jawaban Anda ({currentJawaban.isCorrect ? "Benar" : "Salah"}):
                                        </Text>
                                        <VStack align="stretch" spacing={2}>
                                          {(() => {
                                            if (!currentJawaban.userDragAnswer || Object.keys(currentJawaban.userDragAnswer).length === 0) {
                                                return <Text fontSize="sm" fontStyle="italic" color="gray.500">Tidak ada jawaban</Text>;
                                            }
 
                                            // Detect format: Check if first Key is an ItemID
                                            const firstKey = Number(Object.keys(currentJawaban.userDragAnswer)[0]);
                                            const isNewFormat = currentJawaban.items?.some(i => i.id === firstKey);
                                            
                                            let displayItems: { pos: number, label: string, imageUrl?: string, isCorrect: boolean, key: string }[] = [];
                                            
                                            if (isNewFormat) {
                                                // New Format: Key=ItemID, Value=SlotID
                                                const sortedSlots = [...(currentJawaban.slots || [])].sort((a, b) => a.urutan - b.urutan);
                                                
                                                displayItems = sortedSlots.map((slot, idx) => {
                                                    const itemIdStr = Object.keys(currentJawaban.userDragAnswer!).find(
                                                        key => currentJawaban.userDragAnswer![Number(key)] === slot.id
                                                    );
                                                    const item = itemIdStr ? currentJawaban.items?.find(i => i.id === Number(itemIdStr)) : null;
                                                    
                                                    let isCorrect = false;
                                                    if (item) {
                                                        if (currentJawaban.correctDragAnswer) {
                                                            isCorrect = currentJawaban.correctDragAnswer[item.id] === slot.id;
                                                        } else {
                                                            isCorrect = item.urutan === slot.urutan;
                                                        }
                                                    }
                                                    
                                                    return {
                                                        pos: idx + 1,
                                                        label: item ? item.label : "Kosong",
                                                        imageUrl: item?.imageUrl,
                                                        isCorrect: isCorrect,
                                                        key: `slot-${slot.id}`
                                                    };
                                                });
                                            } else {
                                                // Old Format: Key=Pos, Value=ItemID
                                                displayItems = Object.entries(currentJawaban.userDragAnswer)
                                                    .sort((a, b) => Number(a[0]) - Number(b[0]))
                                                    .map(([posStr, itemId]) => {
                                                        const item = currentJawaban.items?.find(i => i.id === itemId);
                                                        const pos = Number(posStr) + 1;
                                                        const isCorrect = item ? item.urutan === pos : false;
                                                        return {
                                                            pos,
                                                            label: item ? item.label : "Unknown Item",
                                                            imageUrl: item?.imageUrl,
                                                            isCorrect,
                                                            key: `pos-${posStr}`
                                                        };
                                                    });
                                            }

                                            return displayItems.map(d => (
                                                <HStack key={d.key} spacing={3} p={2} bg="white" borderRadius="md" shadow="sm">
                                                   <Box 
                                                    w="24px" h="24px" 
                                                    bg={d.isCorrect ? "blue.500" : "red.500"} 
                                                    color="white" 
                                                    borderRadius="full" fontSize="xs" display="flex" 
                                                    alignItems="center" justifyContent="center" fontWeight="bold"
                                                  >
                                                    {d.pos}
                                                  </Box>
                                                  {d.imageUrl && (
                                                    <Image 
                                                      src={d.imageUrl} 
                                                      alt={d.label} 
                                                      boxSize="36px" 
                                                      objectFit="cover" 
                                                      borderRadius="sm"
                                                    />
                                                  )}
                                                  <Text fontSize="sm">{d.label}</Text>
                                                  {d.isCorrect ? <Badge colorScheme="green" ml="auto">✓</Badge> : <Badge colorScheme="red" ml="auto">✗</Badge>}
                                                </HStack>
                                            ));
                                          })()}
                                        </VStack>
                                      </Box>
                                    </VStack>
                                  )}
                                </Box>
                              ) : (
                                  // MULTIPLE CHOICE RENDERER
                                  ['A', 'B', 'C', 'D'].map((option) => {
                                  const isCorrectAnswer = currentJawaban.jawabanBenar === option;
                                  const isUserAnswer = currentJawaban.jawabanDipilih === option;
                                  const isAnswered = currentJawaban.isAnswered;
                                  const optionText = currentJawaban[`opsi${option}` as keyof typeof currentJawaban];

                                  let bgColor = 'white';
                                  let borderColor = 'gray.200';
                                  let borderWidth = '1px';

                                  // If question was not answered at all
                                  if (!isAnswered) {
                                    if (isCorrectAnswer) {
                                      bgColor = 'green.50';
                                      borderColor = 'green.400';
                                      borderWidth = '2px';
                                    } else {
                                      bgColor = 'gray.50';
                                      borderColor = 'gray.300';
                                    }
                                  } else {
                                    // Question was answered
                                    if (isCorrectAnswer) {
                                      bgColor = 'green.50';
                                      borderColor = 'green.400';
                                      borderWidth = '2px';
                                    } else if (isUserAnswer && !isCorrectAnswer) {
                                      bgColor = 'red.50';
                                      borderColor = 'red.400';
                                      borderWidth = '2px';
                                    }
                                  }

                                  return (
                                    <Box
                                      key={option}
                                      p={3}
                                      borderWidth={borderWidth}
                                      borderColor={borderColor}
                                      borderRadius="md"
                                      bg={bgColor}
                                    >
                                      <HStack justify="space-between" align="start">
                                        <Box flex="1">
                                          <Text fontWeight={isCorrectAnswer || isUserAnswer ? 'semibold' : 'normal'}>
                                            {option}.
                                          </Text>
                                          {Array.isArray(optionText) ? (
                                            <VStack spacing={2} mt={2}>
                                              {optionText.map((img: any) => (
                                                <Image
                                                  key={img.id}
                                                  src={img.filePath || ''}
                                                  alt={img.keterangan || 'Gambar opsi'}
                                                  maxH="200px"
                                                  objectFit="contain"
                                                  mx="auto"
                                                />
                                              ))}
                                            </VStack>
                                          ) : (
                                            <Text fontWeight={isCorrectAnswer || isUserAnswer ? 'semibold' : 'normal'} mt={1}>
                                              {String(optionText)}
                                            </Text>
                                          )}
                                        </Box>
                                        {isCorrectAnswer && (
                                          <Badge colorScheme="green" ml={2}>Jawaban Benar</Badge>
                                        )}
                                        {isUserAnswer && !isCorrectAnswer && (
                                          <Badge colorScheme="red" ml={2}>Jawaban Anda</Badge>
                                        )}
                                      </HStack>
                                    </Box>
                                  );
                                })
                              )}
                            </VStack>

                            {/* Kunci Jawaban Label */}
                            {currentJawaban.questionType !== 'DRAG_DROP' && (
                              <Box p={3} bg="green.50" borderRadius="md" borderLeft="4px solid" borderLeftColor="green.500">
                                <Text fontSize="sm" fontWeight="bold" color="green.700">
                                  Kunci Jawaban: {currentJawaban.jawabanBenar}
                                </Text>
                              </Box>
                            )}

                            {/* Pembahasan */}
                            {currentJawaban.isAnswered ? (
                              ((currentJawaban.pembahasan && currentJawaban.pembahasan.trim()) || (currentJawaban.questionType === 'DRAG_DROP' && currentJawaban.gambar && currentJawaban.gambar.length > 0)) ? (
                                <Box p={4} bg="blue.50" borderRadius="md" borderLeft="4px solid" borderLeftColor="blue.400">
                                  <Text fontWeight="bold" mb={2} color="blue.700">Pembahasan :</Text>
                                  {currentJawaban.pembahasan && (
                                    <Text color="blue.800" whiteSpace="pre-wrap" lineHeight="1.6" mb={(currentJawaban.questionType === 'DRAG_DROP' && currentJawaban.gambar && currentJawaban.gambar.length > 0) ? 3 : 0}>
                                      {currentJawaban.pembahasan}
                                    </Text>
                                  )}
                                  
                                  {/* Drag & Drop Explanation Images */}
                                  {currentJawaban.questionType === 'DRAG_DROP' && currentJawaban.gambar && currentJawaban.gambar.length > 0 && (
                                    <Box mt={2}>
                                      <Text fontSize="xs" color="blue.600" mb={2} fontWeight="medium">Ilustrasi / Gambar:</Text>
                                      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                                        {currentJawaban.gambar.map((img: any) => (
                                          <Box key={img.id} borderWidth="1px" borderRadius="md" p={2} bg="white">
                                            <Image
                                              src={img.filePath || ''}
                                              alt={img.keterangan || 'Gambar pembahasan'}
                                              maxH="200px"
                                              objectFit="contain"
                                              mx="auto"
                                            />
                                            {img.keterangan && (
                                              <Text fontSize="xs" color="gray.500" mt={1} textAlign="center">
                                                {img.keterangan}
                                              </Text>
                                            )}
                                          </Box>
                                        ))}
                                      </SimpleGrid>
                                    </Box>
                                  )}
                                </Box>
                              ) : (
                                <Box p={4} bg="gray.50" borderRadius="md" borderLeft="4px solid" borderLeftColor="gray.400">
                                  <Text fontWeight="bold" mb={2} color="gray.600">Pembahasan :</Text>
                                  <Text color="gray.500" fontStyle="italic">
                                    Pembahasan tidak tersedia untuk soal ini.
                                  </Text>
                                </Box>
                              )
                            ) : (
                              <Box p={4} bg="orange.50" borderRadius="md" borderLeft="4px solid" borderLeftColor="orange.400">
                                <Text fontWeight="bold" mb={2} color="orange.700">Soal Tidak Dijawab</Text>
                                <Text color="orange.800" fontSize="sm">
                                  Anda tidak menjawab soal ini.{" "}
                                  {currentJawaban.questionType !== 'DRAG_DROP' && (
                                    <>Kunci jawaban yang benar adalah {currentJawaban.jawabanBenar}.</>
                                  )}
                                </Text>
                              </Box>
                            )}
                          </VStack>
                        </CardBody>
                      </Card>
                    );
                  })() : (
                    <Card bg="white" borderRadius="md">
                      <CardBody>
                        <VStack spacing={6} align="stretch" py={8}>
                          <Text fontSize="lg" color="gray.600" textAlign="center">
                            Tidak ada soal yang tersedia untuk ditampilkan
                          </Text>
                          <Text fontSize="sm" color="gray.500" textAlign="center">
                            Sepertinya tidak ada data jawaban untuk sesi tes ini
                          </Text>
                        </VStack>
                      </CardBody>
                    </Card>
                  )}
                </SimpleGrid>
              </VStack>
            </CardBody>
          </Card>
        )}

        <VStack spacing={4}>
          <Link href="/student/history">
            <Button colorScheme="orange" size="lg" variant="outline">
              Lihat Riwayat Tes
            </Button>
          </Link>
          <Link href="/student">
            <Button variant="outline" size="lg">
              Kembali ke Beranda
            </Button>
          </Link>
        </VStack>
      </VStack>

      {/* Share Modal - Preview & Download */}
      <Modal isOpen={isShareOpen} onClose={onShareClose} size="xl" closeOnEsc={false} closeOnOverlayClick={false}>
        <ModalOverlay />
        <ModalContent borderRadius="xl" boxShadow="xl" maxH="90vh" overflowY="auto">
          <ModalHeader textAlign="center" fontSize="xl" fontWeight="bold" color="orange.600" pb={2}>
            Bagikan Hasil Tes
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={6}>
              {/* Result Card Preview */}
              <Box
                ref={resultCardRef}
                w="full"
                bg="white"
                p={6}
                borderRadius="lg"
                border="2px"
                borderColor="orange.200"
                boxShadow="md"
              >
                <VStack spacing={4} align="stretch">
                  {/* Header */}
                  <Box textAlign="center" pb={4} borderBottom="2px" borderColor="orange.100">
                    <Heading size="lg" color="orange.600" mb={2}>
                      Hasil Tes CBT
                    </Heading>
                    <Text fontSize="sm" color="gray.500">
                      {new Date().toLocaleDateString('id-ID', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </Text>
                  </Box>

                  {/* Student Info */}
                  <VStack spacing={2} align="stretch" bg="gray.50" p={4} borderRadius="md">
                    <HStack justify="space-between">
                      <Text fontWeight="semibold" color="gray.700">Nama Siswa:</Text>
                      <Text color="gray.800" fontWeight="bold">{result?.sessionInfo.namaPeserta}</Text>
                    </HStack>
                    <HStack justify="space-between">
                      <Text fontWeight="semibold" color="gray.700">Sekolah:</Text>
                      <Text color="gray.800">{shareForm.namaSekolah || '-'}</Text>
                    </HStack>
                    <HStack justify="space-between">
                      <Text fontWeight="semibold" color="gray.700">Kelas:</Text>
                      <Text color="gray.800">{shareForm.kelas || '-'}</Text>
                    </HStack>
                  </VStack>

                  {/* Subject Info */}
                  <VStack spacing={2} align="stretch" bg="blue.50" p={4} borderRadius="md">
                    <HStack justify="space-between">
                      <Text fontWeight="semibold" color="blue.700">Mata Pelajaran:</Text>
                      <Text color="blue.800" fontWeight="bold">{result?.sessionInfo.mataPelajaran.nama}</Text>
                    </HStack>
                    <HStack justify="space-between">
                      <Text fontWeight="semibold" color="blue.700">Kelas/Tingkat:</Text>
                      <Text color="blue.800">{result?.sessionInfo.tingkat.nama}</Text>
                    </HStack>
                  </VStack>

                  {/* Score */}
                  <VStack spacing={2} align="stretch" bg="orange.50" p={4} borderRadius="md">
                    <HStack justify="space-between">
                      <Text fontWeight="semibold" color="orange.700">Nilai Akhir:</Text>
                      <Text fontSize="xl" color="orange.600" fontWeight="bold">{result?.sessionInfo.nilaiAkhir}%</Text>
                    </HStack>
                    <HStack justify="space-between">
                      <Text fontWeight="semibold" color="orange.700">Jumlah Benar:</Text>
                      <Text color="orange.800" fontWeight="bold">{result?.sessionInfo.jumlahBenar}/{result?.sessionInfo.totalSoal}</Text>
                    </HStack>
                    <HStack justify="space-between">
                      <Text fontWeight="semibold" color="orange.700">Durasi:</Text>
                      <Text color="orange.800">{actualDurationMinutes} menit</Text>
                    </HStack>
                  </VStack>

                  {/* Test Time */}
                  <VStack spacing={2} align="stretch" bg="green.50" p={4} borderRadius="md">
                    <HStack justify="space-between">
                      <Text fontWeight="semibold" color="green.700">Waktu Mulai:</Text>
                      <Text color="green.800" fontSize="sm">{result?.sessionInfo.waktuMulai}</Text>
                    </HStack>
                    <HStack justify="space-between">
                      <Text fontWeight="semibold" color="green.700">Waktu Selesai:</Text>
                      <Text color="green.800" fontSize="sm">{result?.sessionInfo.waktuSelesai}</Text>
                    </HStack>
                  </VStack>

                  {/* Status */}
                  <HStack justify="center" pt={2}>
                    <Badge
                      colorScheme={result?.sessionInfo.status === 'selesai' ? 'green' : 'yellow'}
                      fontSize="md"
                      px={3}
                      py={1}
                    >
                      {result?.sessionInfo.status?.toUpperCase()}
                    </Badge>
                  </HStack>
                </VStack>
              </Box>

              {/* Form Fields */}
              <FormControl>
                <FormLabel fontSize="sm" fontWeight="semibold" color="gray.700">
                  Nama Sekolah
                </FormLabel>
                <Input
                  placeholder="Masukkan nama sekolah"
                  value={shareForm.namaSekolah}
                  onChange={(e) => setShareForm({ ...shareForm, namaSekolah: e.target.value })}
                  borderRadius="md"
                  borderColor="gray.300"
                  _focus={{ borderColor: 'orange.500', boxShadow: '0 0 0 1px orange.500' }}
                />
              </FormControl>

              <FormControl>
                <FormLabel fontSize="sm" fontWeight="semibold" color="gray.700">
                  Kelas
                </FormLabel>
                <Input
                  placeholder="Masukkan kelas"
                  value={shareForm.kelas}
                  onChange={(e) => setShareForm({ ...shareForm, kelas: e.target.value })}
                  borderRadius="md"
                  borderColor="gray.300"
                  _focus={{ borderColor: 'orange.500', boxShadow: '0 0 0 1px orange.500' }}
                />
              </FormControl>

              <FormControl>
                <FormLabel fontSize="sm" fontWeight="semibold" color="gray.700">
                  Email
                </FormLabel>
                <Input
                  type="email"
                  placeholder="Masukkan email"
                  value={shareForm.email}
                  onChange={(e) => setShareForm({ ...shareForm, email: e.target.value })}
                  borderRadius="md"
                  borderColor="gray.300"
                  _focus={{ borderColor: 'orange.500', boxShadow: '0 0 0 1px orange.500' }}
                />
              </FormControl>
            </VStack>
          </ModalBody>

          <ModalFooter gap={3} pt={4} borderTop="1px" borderColor="gray.200" flexWrap="wrap" justifyContent="flex-end">
            <Button
              variant="outline"
              colorScheme="gray"
              onClick={onShareClose}
              isDisabled={isSharing}
              borderRadius="md"
            >
              Batal
            </Button>
            <Button
              colorScheme="blue"
              onClick={downloadResultAsPDF}
              isLoading={isSharing}
              loadingText="Mengunduh..."
              borderRadius="md"
            >
              Unduh PDF
            </Button>
            <Button
              colorScheme="orange"
              onClick={shareViaEmail}
              isLoading={isSharing}
              loadingText="Membuka Email..."
              borderRadius="md"
            >
              Kirim Email
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Container>
  );
}