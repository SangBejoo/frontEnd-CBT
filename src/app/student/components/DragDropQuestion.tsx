'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  useDroppable,
  useDraggable,
  rectIntersection, // More reliable for overlapping elements
} from '@dnd-kit/core';
import {
  Box,
  Text,
  VStack,
  HStack,
  Badge,
  Image,
  Grid,
  GridItem,
  Center,
  useBreakpointValue,
  Wrap,
  WrapItem,
  Icon,
} from '@chakra-ui/react';
import { DragHandleIcon, CheckCircleIcon, ChevronDownIcon } from '@chakra-ui/icons';

// Types
interface DragItem {
  id: number;
  label: string;
  imageUrl?: string;
  urutan: number;
}

interface DragSlot {
  id: number;
  label: string;
  urutan: number;
}

interface DragDropQuestionProps {
  question: {
    id: number;
    pertanyaan: string;
    dragType: 'ordering' | 'matching';
    items: DragItem[];
    slots: DragSlot[];
  };
  userAnswer: Record<number, number>; // itemId -> slotId
  onAnswerChange: (answer: Record<number, number>) => void;
  onRemoveItem?: (itemId: number) => void; // NEW: Direct removal callback
}

// Draggable Item Component - Premium Card Design like Brilliant
function DraggableItem({
  item,
  isInSlot = false,
  isMobile = false,
}: {
  item: DragItem;
  isInSlot?: boolean;
  isMobile?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `item-${item.id}`,
  });

  const hasImage = !!item.imageUrl;

  return (
    <Box
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      bg={isDragging ? 'blue.50' : 'white'}
      p={hasImage ? (isMobile ? 2 : 3) : (isMobile ? 3 : 4)}
      borderRadius="xl"
      border="2px solid"
      borderColor={isDragging ? 'blue.500' : 'gray.200'}
      cursor="grab"
      _active={{ 
        cursor: 'grabbing', 
        transform: 'scale(1.08)',
        boxShadow: '2xl'
      }}
      _hover={{ 
        borderColor: 'blue.400', 
        boxShadow: 'lg',
        transform: 'translateY(-2px)'
      }}
      transition="all 0.2s ease"
      boxShadow={isDragging ? 'xl' : 'md'}
      opacity={isDragging ? 0.7 : 1}
      display="flex"
      flexDirection={hasImage ? 'column' : 'row'}
      alignItems="center"
      justifyContent="center"
      gap={hasImage ? 2 : 3}
      minW={isInSlot ? 'auto' : isMobile ? '100px' : hasImage ? '110px' : '130px'}
      minH={isMobile ? (hasImage ? '80px' : '50px') : (hasImage ? '100px' : '60px')}
      position="relative"
      overflow="hidden"
      sx={{
        touchAction: 'none', // Critical for mobile drag to work
        userSelect: 'none',
        WebkitUserSelect: 'none',
        // Better touch targets for mobile
        '@media (hover: none)': {
          minH: hasImage ? '90px' : '56px',
          p: 3,
        },
      }}
    >
      {/* Grab indicator */}
      {!isInSlot && (
        <HStack 
          position="absolute" 
          top={1} 
          right={2} 
          color="gray.300"
          spacing={0}
        >
          <DragHandleIcon boxSize={isMobile ? 3 : 3} />
        </HStack>
      )}

      {/* Image with premium styling */}
      {item.imageUrl && (
        <Box
          borderRadius="lg"
          overflow="hidden"
          boxShadow="sm"
          border="1px solid"
          borderColor="gray.100"
        >
          <Image
            src={item.imageUrl}
            alt={item.label}
            boxSize={isInSlot ? '30px' : isMobile ? '45px' : '60px'}
            objectFit="cover"
            draggable="false"
          />
        </Box>
      )}

      {/* Label */}
      <Text 
        fontWeight="semibold" 
        fontSize={isInSlot ? 'xs' : isMobile ? 'sm' : 'md'} 
        textAlign="center"
        noOfLines={2}
        color="gray.700"
      >
        {item.label}
      </Text>
    </Box>
  );
}

// Drop Zone Component (Matching style) - Mobile Optimized
function MatchingDropZone({
  slot,
  assignedItems = [],
  index,
  onRemove,
  isMobile = false,
}: {
  slot: DragSlot;
  assignedItems: DragItem[];
  index: number;
  onRemove: (itemId: number) => void;
  isMobile?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `slot-${slot.id}`,
  });
  const hasItems = assignedItems.length > 0;

  return (
    <Box 
      w="full"
      flexDir={isMobile ? 'column' : 'row'}
      display="flex"
      gap={isMobile ? 2 : 4}
      alignItems={isMobile ? 'stretch' : 'flex-start'}
    >
      {/* Slot label on mobile shows on top */}
      {isMobile && (
        <HStack justify="space-between" px={2}>
          <Badge colorScheme="green" fontSize="xs">Slot {index + 1}</Badge>
          <Text fontWeight="semibold" color="gray.700" fontSize="sm">
            {slot.label}
          </Text>
        </HStack>
      )}
      
      {/* Item drop area */}
      <Box flex={1}>
        <Box
          ref={setNodeRef}
          bg={isOver ? 'blue.50' : hasItems ? 'green.50' : 'white'}
          p={isMobile ? 3 : 4}
          borderRadius="lg"
          border="2px dashed"
          borderColor={isOver ? 'blue.500' : hasItems ? 'green.400' : 'orange.300'}
          minH={isMobile ? '56px' : '60px'}
          display="flex"
          alignItems="center"
          justifyContent={hasItems ? 'flex-start' : 'center'}
          flexWrap="wrap"
          gap={2}
          transition="all 0.2s"
        >
          {hasItems ? (
            assignedItems.map((item) => (
              <Box
                key={item.id}
                bg="white"
                p={2}
                borderRadius="md"
                border="1px solid"
                borderColor="green.200"
                cursor="pointer"
                _hover={{ bg: 'red.50', borderColor: 'red.300', transform: 'scale(1.02)' }}
                _active={{ bg: 'red.100' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(item.id);
                }}
                transition="all 0.2s"
                boxShadow="sm"
              >
                <HStack spacing={2}>
                  {item.imageUrl && (
                    <Image
                      src={item.imageUrl}
                      alt={item.label}
                      boxSize={isMobile ? '24px' : '32px'}
                      objectFit="cover"
                      borderRadius="sm"
                    />
                  )}
                  <Text fontWeight="bold" color="green.700" fontSize={isMobile ? 'xs' : 'sm'} noOfLines={1} maxW="150px">
                    {item.label}
                  </Text>
                  <Icon as={CheckCircleIcon} color="green.500" boxSize={isMobile ? 3 : 3} />
                </HStack>
              </Box>
            ))
          ) : (
            <VStack spacing={0}>
              <Icon as={ChevronDownIcon} color="orange.400" boxSize={4} />
              <Text color="orange.400" fontSize={isMobile ? 'xs' : 'sm'}>
                {isMobile ? 'Letakkan' : 'Letakkan Disini'}
              </Text>
            </VStack>
          )}
        </Box>
      </Box>
      
      {/* Slot label (desktop - on right side) */}
      {!isMobile && (
        <Box minW="120px" pt={3}>
          <Text fontWeight="semibold" color="gray.700" textAlign="right">
            {slot.label}
          </Text>
        </Box>
      )}
    </Box>
  );
}


// Ordering Drop Zone - Brilliant-style Premium Design
function OrderingDropZone({
  slot,
  assignedItem,
  onRemove,
  isMobile = false,
}: {
  slot: DragSlot;
  assignedItem: DragItem | null;
  onRemove: () => void;
  isMobile?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `slot-${slot.id}`,
  });

  return (
    <VStack spacing={0}>
      {/* Position Number Badge - Prominent like Brilliant */}
      <Center
        bg={assignedItem ? 'purple.500' : isOver ? 'blue.500' : 'gray.400'}
        color="white"
        fontWeight="bold"
        fontSize={isMobile ? 'md' : 'lg'}
        w={isMobile ? '32px' : '40px'}
        h={isMobile ? '32px' : '40px'}
        borderRadius="full"
        mb={-4}
        zIndex={2}
        boxShadow="md"
        transition="all 0.2s"
      >
        {slot.urutan}
      </Center>
      
      {/* Drop Zone Card - Premium design */}
      <Box
        ref={setNodeRef}
        bg={isOver ? 'blue.50' : assignedItem ? 'white' : 'gray.50'}
        pt={isMobile ? 6 : 8}
        pb={isMobile ? 3 : 4}
        px={isMobile ? 3 : 4}
        borderRadius="2xl"
        border={assignedItem ? '2px solid' : '3px dashed'}
        borderColor={
          isOver ? 'blue.400' 
          : assignedItem ? 'purple.400' 
          : 'gray.300'
        }
        minH={isMobile ? '100px' : '130px'}
        minW={isMobile ? '90px' : '120px'}
        maxW={isMobile ? '120px' : '150px'}
        display="flex"
        alignItems="center"
        justifyContent="center"
        transition="all 0.3s ease"
        cursor={assignedItem ? 'pointer' : 'default'}
        onClick={assignedItem ? onRemove : undefined}
        onTouchEnd={assignedItem ? onRemove : undefined}
        boxShadow={assignedItem ? 'lg' : isOver ? 'md' : 'sm'}
        transform={isOver ? 'scale(1.05)' : 'scale(1)'}
        _hover={assignedItem ? { 
          bg: 'red.50', 
          borderColor: 'red.400',
          boxShadow: 'xl',
          transform: 'scale(1.02)'
        } : {
          borderColor: 'blue.300',
          bg: 'blue.50'
        }}
        _active={assignedItem ? { bg: 'red.100', transform: 'scale(0.98)' } : {}}
        position="relative"
        overflow="hidden"
      >
        {/* Subtle gradient overlay for empty state */}
        {!assignedItem && (
          <Box
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            bgGradient="linear(to-b, transparent, gray.100)"
            opacity={0.5}
            pointerEvents="none"
          />
        )}

        {assignedItem ? (
          <VStack spacing={2}>
            {assignedItem.imageUrl && (
              <Box
                borderRadius="lg"
                overflow="hidden"
                boxShadow="md"
                border="2px solid"
                borderColor="purple.200"
              >
                <Image
                  src={assignedItem.imageUrl}
                  alt={assignedItem.label}
                  boxSize={isMobile ? '50px' : '70px'}
                  objectFit="cover"
                />
              </Box>
            )}
            <Text 
              fontWeight="bold" 
              fontSize={isMobile ? 'sm' : 'md'} 
              color="purple.700"
              textAlign="center"
              noOfLines={2}
              px={1}
            >
              {assignedItem.label}
            </Text>
            {/* Remove hint */}
            <Text fontSize="xs" color="gray.400" mt={-1}>
              Klik untuk hapus
            </Text>
          </VStack>
        ) : (
          <VStack spacing={1} color="gray.400">
            <Box
              w={isMobile ? '40px' : '50px'}
              h={isMobile ? '40px' : '50px'}
              borderRadius="lg"
              border="2px dashed"
              borderColor="gray.300"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Icon as={ChevronDownIcon} boxSize={6} />
            </Box>
            <Text fontSize="xs" fontWeight="medium">
              Letakkan disini
            </Text>
          </VStack>
        )}
      </Box>
    </VStack>
  );
}

// Safe haptic feedback helper
const safeVibrate = (pattern: number | number[]) => {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      // Chrome-specific check to avoid "Blocked call to navigator.vibrate" intervention
      // @ts-ignore - navigator.userActivation might not be in all TS definitions yet
      if (navigator.userActivation && !navigator.userActivation.hasBeenActive) {
        return;
      }
      navigator.vibrate(pattern);
    }
  } catch (e) {
    // Ignore errors on devices that don't support it
  }
};

// Main Component
export default function DragDropQuestion({
  question,
  userAnswer,
  onAnswerChange,
  onRemoveItem,
}: DragDropQuestionProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  
  // Responsive breakpoint detection
  const isMobile = useBreakpointValue({ base: true, md: false }) ?? false;

  // Configure sensors for both mouse and touch
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Slightly higher for better touch experience
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150, // Small delay to differentiate from scroll
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor) // Accessibility support
  );

  // Get unassigned items
  const unassignedItems = useMemo(() => {
    const assignedItemIds = new Set(Object.keys(userAnswer).map(Number));
    return question.items.filter((item) => !assignedItemIds.has(item.id));
  }, [question.items, userAnswer]);

  // Get item by ID
  const getItemById = useCallback(
    (id: number) => question.items.find((item) => item.id === id),
    [question.items]
  );

  // Get assigned item for slot
  const getAssignedItem = useCallback(
    (slotId: number) => {
      const entry = Object.entries(userAnswer).find(([, sId]) => sId === slotId);
      if (entry) {
        return getItemById(Number(entry[0]));
      }
      return null;
    },
    [userAnswer, getItemById]
  );
  
  // Get all assigned items for slot (for Matching)
  const getAssignedItems = useCallback(
    (slotId: number) => {
      const itemIds = Object.entries(userAnswer)
        .filter(([, sId]) => sId === slotId)
        .map(([itemId]) => Number(itemId));
      
      return itemIds
        .map(id => getItemById(id))
        .filter((item): item is DragItem => item !== undefined);
    },
    [userAnswer, getItemById]
  );

  // Remove assignment for slot
  const removeFromSlot = useCallback(
    (slotId: number) => {
      const itemEntry = Object.entries(userAnswer).find(([, sId]) => sId === slotId);
      
      if (itemEntry) {
        const itemId = Number(itemEntry[0]);
        
        if (onRemoveItem) {
          onRemoveItem(itemId);
        } else {
          const newAnswer = { ...userAnswer };
          delete newAnswer[itemId];
          onAnswerChange(newAnswer);
        }
      }
    },
    [userAnswer, onAnswerChange, onRemoveItem]
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    // Haptic feedback on mobile if available
    safeVibrate(10);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;

    if (activeIdStr.startsWith('item-') && overIdStr.startsWith('slot-')) {
      const itemId = parseInt(activeIdStr.replace('item-', ''), 10);
      const slotId = parseInt(overIdStr.replace('slot-', ''), 10);

      const newAnswer = { ...userAnswer };
      
      // Remove any existing assignment to this slot ONLY IF ORDERING
      if (question.dragType === 'ordering') {
        Object.entries(newAnswer).forEach(([key, value]) => {
          if (value === slotId) {
            delete newAnswer[parseInt(key, 10)];
          }
        });
      }
      
      // Assign item to slot
      newAnswer[itemId] = slotId;
      onAnswerChange(newAnswer);
      
      // Success haptic feedback
      safeVibrate([10, 50, 10]);
    }
  };

  const activeItem = useMemo(() => {
    if (!activeId) return null;
    const itemId = parseInt(activeId.replace('item-', ''), 10);
    return getItemById(itemId);
  }, [activeId, getItemById]);

  const isOrdering = question.dragType === 'ordering';

  return (
    <Box>
      {/* Question Text */}
      <Box 
        mb={isMobile ? 4 : 6} 
        p={isMobile ? 3 : 4} 
        bg="white" 
        borderRadius="lg" 
        borderLeft="4px solid" 
        borderColor="orange.400"
      >
        <Badge colorScheme={isOrdering ? 'purple' : 'orange'} mb={2} fontSize={isMobile ? 'xs' : 'sm'}>
          {isOrdering ? 'URUTKAN' : 'PASANGKAN'}
        </Badge>
        <Text fontSize={isMobile ? 'md' : 'lg'} fontWeight="medium">
          {question.pertanyaan}
        </Text>
      </Box>

      {/* Mobile instruction hint */}
      {isMobile && (
        <Box 
          mb={3} 
          p={2} 
          bg="blue.50" 
          borderRadius="md" 
          textAlign="center"
        >
          <Text fontSize="xs" color="blue.600">
            Tekan dan tahan item, lalu geser ke tempat yang benar
          </Text>
        </Box>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {isOrdering ? (
          // ORDERING LAYOUT - Brilliant-style Premium Design
          <VStack spacing={isMobile ? 5 : 8} w="full">
            {/* Drop Zones Area - Premium container */}
            <Box 
              w="full" 
              bg="linear-gradient(180deg, #f8f9ff 0%, #f0f2ff 100%)"
              bgGradient="linear(to-b, purple.50, white)"
              p={isMobile ? 4 : 6}
              borderRadius="2xl"
              boxShadow="sm"
              border="1px solid"
              borderColor="purple.100"
            >
              <Text 
                fontSize={isMobile ? 'xs' : 'sm'} 
                fontWeight="bold" 
                color="purple.600" 
                mb={isMobile ? 3 : 4}
                textAlign="center"
                textTransform="uppercase"
                letterSpacing="wide"
              >
                📍 Letakkan item ke posisi yang benar
              </Text>
              
              {/* Horizontal scroll container for slots */}
              <Box overflowX="auto" pb={2}>
                <HStack 
                  spacing={isMobile ? 3 : 5} 
                  justify="center"
                  minW="min-content"
                  px={2}
                >
                  {[...question.slots].sort((a, b) => a.urutan - b.urutan).map((slot) => (
                    <OrderingDropZone
                      key={slot.id}
                      slot={slot}
                      assignedItem={getAssignedItem(slot.id) || null}
                      onRemove={() => removeFromSlot(slot.id)}
                      isMobile={isMobile}
                    />
                  ))}
                </HStack>
              </Box>
            </Box>

            {/* Items Bank - Clean card design */}
            <Box 
              w="full" 
              p={isMobile ? 4 : 5} 
              bg="white" 
              borderRadius="xl" 
              boxShadow="md"
              border="1px solid"
              borderColor="gray.200"
            >
              <HStack justify="center" mb={4}>
                <Badge 
                  colorScheme="blue" 
                  px={3} 
                  py={1} 
                  borderRadius="full"
                  fontSize={isMobile ? 'xs' : 'sm'}
                >
                  🎯 {isMobile ? 'ITEM YANG HARUS DIURUTKAN' : 'DRAG ITEM KE POSISI YANG SESUAI'}
                </Badge>
              </HStack>
              
              {unassignedItems.length > 0 ? (
                <Wrap spacing={isMobile ? 3 : 4} justify="center">
                  {unassignedItems.map((item) => (
                    <WrapItem key={item.id}>
                      <DraggableItem item={item} isMobile={isMobile} />
                    </WrapItem>
                  ))}
                </Wrap>
              ) : (
                <Center 
                  py={4} 
                  px={6}
                  bg="green.50" 
                  borderRadius="xl"
                  border="2px dashed"
                  borderColor="green.300"
                >
                  <VStack spacing={2}>
                    <CheckCircleIcon boxSize={8} color="green.500" />
                    <Text 
                      color="green.600" 
                      fontWeight="bold" 
                      fontSize={isMobile ? 'md' : 'lg'}
                    >
                      Semua item sudah ditempatkan! ✨
                    </Text>
                    <Text color="green.500" fontSize="sm">
                      Klik item di atas untuk menghapus
                    </Text>
                  </VStack>
                </Center>
              )}
            </Box>
          </VStack>
        ) : (
          // MATCHING LAYOUT
          <Grid 
            templateColumns={{ base: '1fr', md: '1fr 2fr' }} 
            gap={isMobile ? 4 : 6}
          >
            {/* Items column */}
            <GridItem>
              <Box p={isMobile ? 3 : 4} bg="gray.50" borderRadius="lg">
                <Text 
                  fontSize={isMobile ? 'xs' : 'sm'} 
                  fontWeight="bold" 
                  color="gray.600" 
                  mb={3} 
                  textTransform="uppercase"
                >
                  {isMobile ? 'ITEM (GESER →)' : 'ITEM'}
                </Text>
                <VStack spacing={isMobile ? 2 : 3} align="stretch">
                  {unassignedItems.map((item) => (
                    <DraggableItem key={item.id} item={item} isMobile={isMobile} />
                  ))}
                  {unassignedItems.length === 0 && (
                    <Center p={isMobile ? 3 : 4} bg="green.50" borderRadius="md">
                      <Text color="green.600" fontWeight="medium" fontSize={isMobile ? 'xs' : 'sm'}>
                        Semua sudah dipasangkan
                      </Text>
                    </Center>
                  )}
                </VStack>
              </Box>
            </GridItem>

            {/* Slots column */}
            <GridItem>
              <Box p={isMobile ? 3 : 4}>
                <Text 
                  fontSize={isMobile ? 'xs' : 'sm'} 
                  fontWeight="bold" 
                  color="gray.600" 
                  mb={3} 
                  textTransform="uppercase"
                >
                  {isMobile ? 'TEMPAT DROP' : 'KATEGORI'}
                </Text>
                <VStack spacing={isMobile ? 3 : 4} align="stretch">
                  {question.slots.map((slot, idx) => (
                    <MatchingDropZone
                      key={slot.id}
                      slot={slot}
                      assignedItems={getAssignedItems(slot.id)}
                      index={idx}
                      onRemove={(itemId) => {
                        const newAnswer = { ...userAnswer };
                        delete newAnswer[itemId];
                        onAnswerChange(newAnswer);
                      }}
                      isMobile={isMobile}
                    />
                  ))}
                </VStack>
              </Box>
            </GridItem>
          </Grid>
        )}

        {/* Drag Overlay - shown while dragging */}
        <DragOverlay>
          {activeItem && (
            <Box
              bg="blue.100"
              p={isMobile ? 2 : 3}
              borderRadius="lg"
              border="2px solid"
              borderColor="blue.500"
              boxShadow="2xl"
              display="flex"
              alignItems="center"
              gap={2}
              transform="scale(1.05)"
              opacity={0.95}
            >
              {activeItem.imageUrl && (
                <Image
                  src={activeItem.imageUrl}
                  alt={activeItem.label}
                  boxSize={isMobile ? '32px' : '40px'}
                  objectFit="cover"
                  borderRadius="md"
                />
              )}
              <Text fontWeight="bold" fontSize={isMobile ? 'sm' : 'md'}>
                {activeItem.label}
              </Text>
            </Box>
          )}
        </DragOverlay>
      </DndContext>
    </Box>
  );
}
