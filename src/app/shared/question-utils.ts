export const QUESTION_TYPE_MULTIPLE_CHOICE = 'MULTIPLE_CHOICE';
export const QUESTION_TYPE_MULTIPLE_CHOICE_COMPLEX = 'MULTIPLE_CHOICE_COMPLEX';
export const QUESTION_TYPE_DRAG_DROP = 'DRAG_DROP';

const LEGACY_LETTER_MAP: Record<string, number> = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  F: 6,
  G: 7,
  H: 8,
  I: 9,
  J: 10,
  K: 11,
  L: 12,
  M: 13,
  N: 14,
  O: 15,
  P: 16,
  Q: 17,
  R: 18,
  S: 19,
  T: 20,
  U: 21,
  V: 22,
  W: 23,
  X: 24,
  Y: 25,
  Z: 26,
};

export function normalizeIndices(indices: Array<number | string | null | undefined> = []) {
  const seen = new Set<number>();
  const result: number[] = [];

  for (const raw of indices) {
    const value = typeof raw === 'string' ? Number(raw) : raw;
    if (value === null || value === undefined || !Number.isFinite(value)) {
      continue;
    }

    const index = Math.trunc(Number(value));
    if (index <= 0 || seen.has(index)) {
      continue;
    }

    seen.add(index);
    result.push(index);
  }

  result.sort((a, b) => a - b);
  return result;
}

export function getQuestionType(value: unknown, optionsLength = 0, correctCount = 0) {
  const normalized = String(value || '').toUpperCase();

  if (normalized.includes('DRAG')) {
    return QUESTION_TYPE_DRAG_DROP;
  }

  if (
    normalized.includes('COMPLEX') ||
    normalized === QUESTION_TYPE_MULTIPLE_CHOICE_COMPLEX ||
    optionsLength > 4 ||
    correctCount > 1
  ) {
    return QUESTION_TYPE_MULTIPLE_CHOICE_COMPLEX;
  }

  return QUESTION_TYPE_MULTIPLE_CHOICE;
}

export function getQuestionOptions(question: any): string[] {
  const dynamicOptions = Array.isArray(question?.options) && question.options.length > 0
    ? question.options
    : Array.isArray(question?.mcOptions) && question.mcOptions.length > 0
      ? question.mcOptions
      : null;

  if (dynamicOptions) {
    return dynamicOptions
      .map((option: unknown) => (typeof option === 'string' ? option.trim() : String(option ?? '').trim()))
      .filter(Boolean);
  }

  const legacy = [
    question?.opsiA || question?.mcOpsiA,
    question?.opsiB || question?.mcOpsiB,
    question?.opsiC || question?.mcOpsiC,
    question?.opsiD || question?.mcOpsiD,
  ];

  return legacy
    .map((option) => (typeof option === 'string' ? option.trim() : String(option ?? '').trim()))
    .filter(Boolean);
}

export function getQuestionCorrectIndices(question: any, optionsLength = 0): number[] {
  const dynamicIndices =
    (Array.isArray(question?.correctOptionIndices) && question.correctOptionIndices.length > 0 && question.correctOptionIndices) ||
    (Array.isArray(question?.mcSelectedOptionIndices) && question.mcSelectedOptionIndices.length > 0 && question.mcSelectedOptionIndices) ||
    (Array.isArray(question?.selectedOptionIndices) && question.selectedOptionIndices.length > 0 && question.selectedOptionIndices) ||
    (Array.isArray(question?.correct_option_indices) && question.correct_option_indices.length > 0 && question.correct_option_indices) ||
    null;

  if (dynamicIndices) {
    return normalizeIndices(dynamicIndices);
  }

  const dynamicIndex = question?.correctOptionIndex ?? question?.mcSelectedOptionIndex ?? question?.selectedOptionIndex;
  if (typeof dynamicIndex === 'number' && dynamicIndex > 0) {
    return [Math.trunc(dynamicIndex)];
  }

  const legacyValue = String(
    question?.jawabanBenar ||
    question?.mcJawabanDipilih ||
    question?.jawaban_dipilih ||
    ''
  ).trim().toUpperCase();

  if (LEGACY_LETTER_MAP[legacyValue]) {
    return [LEGACY_LETTER_MAP[legacyValue]];
  }

  const legacyList = legacyValue
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => LEGACY_LETTER_MAP[item] || Number(item))
    .filter((value) => Number.isFinite(value) && value > 0) as number[];

  if (legacyList.length > 0) {
    return normalizeIndices(legacyList);
  }

  if (optionsLength > 0) {
    return [];
  }

  return [];
}

export function getQuestionSelectedIndices(question: any): number[] {
  const questionOptions = getQuestionOptions(question);
  const dynamicIndices = getQuestionCorrectIndices(question, questionOptions.length);
  if (dynamicIndices.length > 0) {
    return dynamicIndices;
  }

  const selectedValue = question?.jawabanDipilih || question?.mcJawabanDipilih || '';
  if (!selectedValue) {
    return [];
  }

  const normalized = String(selectedValue).trim();
  if (!normalized) {
    return [];
  }

  if (normalized.includes(',')) {
    return normalizeIndices(
      normalized
        .split(',')
        .map((value) => value.trim())
        .map((value) => LEGACY_LETTER_MAP[value.toUpperCase()] || Number(value))
    );
  }

  return normalizeIndices([LEGACY_LETTER_MAP[normalized.toUpperCase()] || Number(normalized)]);
}

export function getOptionLabel(index: number): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (index >= 1 && index <= alphabet.length) {
    return alphabet[index - 1];
  }

  return `Opsi ${index}`;
}

export function isMultipleChoiceComplexQuestion(question: any): boolean {
  const options = getQuestionOptions(question);
  const selected = getQuestionCorrectIndices(question, options.length);
  return getQuestionType(question?.questionType, options.length, selected.length) === QUESTION_TYPE_MULTIPLE_CHOICE_COMPLEX;
}
