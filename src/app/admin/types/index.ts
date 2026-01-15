export interface BaseEntity {
  id: number;
}

export interface Level extends BaseEntity {
  nama: string;
  is_active?: boolean;
}

export interface Subject extends BaseEntity {
  nama: string;
  is_active?: boolean;
}

export interface Topic extends BaseEntity {
  mataPelajaran: { id: number; nama: string };
  tingkat: { id: number; nama: string };
  nama: string;
  isActive?: boolean;
  defaultDurasiMenit?: number;
  defaultJumlahSoal?: number;
  jumlahSoalReal?: number;
}

export interface Question extends BaseEntity {
  materi: {
    id: number;
    mataPelajaran: { id: number; nama: string };
    tingkat: { id: number; nama: string };
    nama: string;
  };
  pertanyaan: string;
  opsiA: string;
  opsiB: string;
  opsiC: string;
  opsiD: string;
  jawabanBenar: string;
  pembahasan?: string;
  gambar: {
    id: number;
    namaFile: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
    urutan: number;
    keterangan: string;
    createdAt: string;
  }[];
}

export interface PaginationInfo {
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

export interface ApiResponse<T> {
  data?: T;
  message?: string;
  success?: boolean;
  [key: string]: any;
}
