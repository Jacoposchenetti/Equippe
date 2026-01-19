import { storage, db } from './firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject, uploadBytesResumable, UploadTask } from 'firebase/storage';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png', 
  'image/gif',
  'image/webp'
];

export const MAX_TEAM_PHOTO_SIZE = 5 * 1024 * 1024; // 5MB

export const validateTeamPhoto = (file: File): string | null => {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return `Tipo di file non supportato. Formati consentiti: JPEG, PNG, GIF, WebP`;
  }
  
  if (file.size > MAX_TEAM_PHOTO_SIZE) {
    return `Immagine troppo grande. Massimo ${MAX_TEAM_PHOTO_SIZE / 1024 / 1024}MB`;
  }
  
  return null;
};

export const uploadTeamPhoto = async (
  file: File,
  teamId: string,
  onProgress?: (progress: number) => void
): Promise<string> => {
  // Valida file
  const validationError = validateTeamPhoto(file);
  if (validationError) {
    throw new Error(validationError);
  }

  // Genera nome file
  const timestamp = Date.now();
  const fileExtension = file.name.split('.').pop();
  const fileName = `team_${teamId}_${timestamp}.${fileExtension}`;
  
  // Crea riferimento storage
  const photoRef = ref(storage, `team-photos/${teamId}/${fileName}`);
  
  try {
    // Upload file con progress tracking se disponibile
    if (onProgress) {
      const uploadTask: UploadTask = uploadBytesResumable(photoRef, file);
      
      return new Promise<string>((resolve, reject) => {
        uploadTask.on('state_changed',
          (snapshot: any) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            onProgress(progress);
          },
          (error: any) => reject(error),
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(downloadURL);
            } catch (error) {
              reject(error);
            }
          }
        );
      });
    } else {
      // Upload semplice senza progress
      const snapshot = await uploadBytes(photoRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      return downloadURL;
    }
  } catch (error) {
    console.error('Error uploading team photo:', error);
    throw new Error('Errore durante l\'upload della foto');
  }
};

export const updateTeamPhoto = async (
  teamId: string, 
  photoURL: string, 
  oldPhotoURL?: string
): Promise<void> => {
  try {
    // Aggiorna il documento team in Firestore
    await updateDoc(doc(db, 'teams', teamId), {
      photoURL,
      updatedAt: Timestamp.now()
    });

    // Elimina la vecchia foto se esiste
    if (oldPhotoURL && oldPhotoURL !== photoURL) {
      try {
        // Estrai il path dalla URL
        const urlParts = oldPhotoURL.split('/');
        const tokenIndex = urlParts.findIndex(part => part.includes('token='));
        if (tokenIndex > 0) {
          const pathWithParams = urlParts.slice(7, tokenIndex).join('/'); // Salta "https://firebasestorage.googleapis.com/v0/b/bucket/o/"
          const path = decodeURIComponent(pathWithParams);
          const oldPhotoRef = ref(storage, path);
          await deleteObject(oldPhotoRef);
        }
      } catch (deleteError) {
        console.warn('Error deleting old team photo:', deleteError);
        // Non bloccare l'operazione se non riusciamo a cancellare la vecchia foto
      }
    }
  } catch (error) {
    console.error('Error updating team photo:', error);
    throw new Error('Errore durante l\'aggiornamento della foto');
  }
};

export const deleteTeamPhoto = async (teamId: string, photoURL: string): Promise<void> => {
  try {
    // Rimuovi photoURL dal documento team
    await updateDoc(doc(db, 'teams', teamId), {
      photoURL: null,
      updatedAt: Timestamp.now()
    });

    // Elimina il file da Storage
    try {
      const urlParts = photoURL.split('/');
      const tokenIndex = urlParts.findIndex(part => part.includes('token='));
      if (tokenIndex > 0) {
        const pathWithParams = urlParts.slice(7, tokenIndex).join('/');
        const path = decodeURIComponent(pathWithParams);
        const photoRef = ref(storage, path);
        await deleteObject(photoRef);
      }
    } catch (deleteError) {
      console.warn('Error deleting team photo file:', deleteError);
    }
  } catch (error) {
    console.error('Error deleting team photo:', error);
    throw new Error('Errore durante l\'eliminazione della foto');
  }
};
