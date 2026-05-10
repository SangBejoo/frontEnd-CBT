'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Box, Button, HStack, Text, Wrap, WrapItem } from '@chakra-ui/react';
import { hasRenderableHtml, sanitizeHtml } from '../../shared/html-utils';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
}

const TOOLBAR: Array<{ label: string; command: string; value?: string }> = [
  { label: 'B', command: 'bold' },
  { label: 'I', command: 'italic' },
  { label: 'U', command: 'underline' },
  { label: '• List', command: 'insertUnorderedList' },
  { label: '1. List', command: 'insertOrderedList' },
];

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Tulis konten...',
  minHeight = 120,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  const syncEditor = useCallback(() => {
    if (!editorRef.current) {
      return;
    }

    const html = sanitizeHtml(editorRef.current.innerHTML);
    if (editorRef.current.innerHTML !== html) {
      editorRef.current.innerHTML = html;
    }
    onChange(html);
  }, [onChange]);

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }

    const nextValue = sanitizeHtml(value || '');
    if (editorRef.current.innerHTML !== nextValue) {
      editorRef.current.innerHTML = nextValue;
    }
  }, [value]);

  const runCommand = useCallback((command: string, commandValue?: string) => {
    if (!editorRef.current) {
      return;
    }

    editorRef.current.focus();
    document.execCommand(command, false, commandValue);
    syncEditor();
  }, [syncEditor]);

  return (
    <Box borderWidth="1px" borderColor="gray.300" borderRadius="md" bg="white" overflow="hidden">
      <Box px={3} py={2} borderBottomWidth="1px" borderColor="gray.200" bg="gray.50">
        <Wrap spacing={2}>
          {TOOLBAR.map((item) => (
            <WrapItem key={item.label}>
              <Button
                size="xs"
                variant="outline"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => runCommand(item.command, item.value)}
              >
                {item.label}
              </Button>
            </WrapItem>
          ))}
          <WrapItem>
            <Button
              size="xs"
              variant="outline"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                const url = window.prompt('Masukkan URL tautan');
                if (url) {
                  runCommand('createLink', url);
                }
              }}
            >
              Link
            </Button>
          </WrapItem>
          <WrapItem>
            <Button
              size="xs"
              variant="outline"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => runCommand('removeFormat')}
            >
              Clear
            </Button>
          </WrapItem>
        </Wrap>
      </Box>

      <Box position="relative">
        {!hasRenderableHtml(value) && (
          <Text
            position="absolute"
            top="12px"
            left="12px"
            color="gray.400"
            pointerEvents="none"
            fontSize="sm"
          >
            {placeholder}
          </Text>
        )}
        <Box
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          minH={`${minHeight}px`}
          px={3}
          py={3}
          outline="none"
          whiteSpace="pre-wrap"
          onInput={syncEditor}
          onBlur={syncEditor}
          _focusVisible={{ outline: 'none' }}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(value || '') }}
        />
      </Box>
    </Box>
  );
}
