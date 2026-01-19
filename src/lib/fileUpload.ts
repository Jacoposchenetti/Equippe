import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { FileAttachment } from '@/types/equippe';
import { Timestamp } from 'firebase/firestore';

export interface UploadProgress {
  progress: number;
  file: File;
}

export const ALLOWED_FILE_TYPES = [
  // Immagini
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  // Documenti
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  // Testo
  'text/plain', 'text/csv',
  // Archivi
  'application/zip', 'application/x-rar-compressed'
];

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const validateFile = (file: File): string | null => {
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return `Tipo di file non supportato: ${file.type}`;
  }
  
  if (file.size > MAX_FILE_SIZE) {
    return `File troppo grande. Massimo ${MAX_FILE_SIZE / 1024 / 1024}MB`;
  }
  
  return null;
};

export const uploadFile = async (
  file: File,
  conversationId: string,
  userId: string,
  onProgress?: (progress: number) => void
): Promise<FileAttachment> => {
  // Valida file
  const validationError = validateFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  // Genera nome file univoco
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 15);
  const fileName = `${timestamp}_${randomId}_${file.name}`;
  
  // Crea riferimento storage
  const fileRef = ref(storage, `chat-attachments/${conversationId}/${fileName}`);
  
  try {
    // Upload file
    const snapshot = await uploadBytes(fileRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    // Crea oggetto attachment
    const attachment: FileAttachment = {
      id: randomId,
      name: file.name,
      size: file.size,
      type: file.type,
      url: snapshot.ref.fullPath,
      downloadURL,
      uploadedAt: Timestamp.now()
    };
    
    return attachment;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw new Error('Errore durante l\'upload del file');
  }
};

export const getFileIcon = (mimeType: string): string => {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '📋';
  if (mimeType.startsWith('text/')) return 'TXT';
  if (mimeType.includes('zip') || mimeType.includes('rar')) return '🗜️';
  return '📁';
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
