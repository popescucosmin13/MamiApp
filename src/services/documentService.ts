import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  deleteDoc,
  query,
  orderBy,
  where,
  Timestamp,
  limit,
} from 'firebase/firestore';
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { db, getFirebaseStorage } from './firebase';
import { DocumentRecord, DocumentType } from '../types/documents';

const documentsRef = (userId: string) => collection(db, 'users', userId, 'documents');
const childDocumentsRef = (userId: string, childId: string) =>
  collection(db, 'users', userId, 'children', childId, 'documents');

export const documentService = {
  async uploadDocument(
    userId: string,
    file: { uri: string; name: string; mimeType: string; size: number },
    childId?: string,
    onProgress?: (progress: number) => void
  ): Promise<DocumentRecord> {
    const path = childId
      ? `users/${userId}/children/${childId}/${Date.now()}_${file.name}`
      : `users/${userId}/documents/${Date.now()}_${file.name}`;

    const storage = await getFirebaseStorage();
    const storRef = storageRef(storage, path);

    // Fetch blobul fișierului
    const response = await fetch(file.uri);
    const blob = await response.blob();

    const uploadTask = uploadBytesResumable(storRef, blob, {
      contentType: file.mimeType,
    });

    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          onProgress?.(progress);
        },
        reject,
        async () => {
          const fileUrl = await getDownloadURL(uploadTask.snapshot.ref);
          const docData: Omit<DocumentRecord, 'id'> = {
            name: file.name,
            type: documentService.detectType(file.name, file.mimeType),
            fileUrl,
            fileName: file.name,
            mimeType: file.mimeType,
            size: file.size,
            uploadedAt: Timestamp.now(),
            childId,
          };
          const ref = childId
            ? await addDoc(childDocumentsRef(userId, childId), docData)
            : await addDoc(documentsRef(userId), docData);
          resolve({ id: ref.id, ...docData });
        }
      );
    });
  },

  async getDocuments(userId: string, childId?: string, limitN = 100): Promise<DocumentRecord[]> {
    const colRef = childId ? childDocumentsRef(userId, childId) : documentsRef(userId);
    const q = query(colRef, orderBy('uploadedAt', 'desc'), limit(limitN));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as DocumentRecord));
  },

  async deleteDocument(userId: string, docId: string, fileUrl: string, childId?: string): Promise<void> {
    const colRef = childId ? childDocumentsRef(userId, childId) : documentsRef(userId);
    await deleteDoc(doc(colRef, docId));
    try {
      const storage = await getFirebaseStorage();
      const fileRef = storageRef(storage, fileUrl);
      await deleteObject(fileRef);
    } catch { /* Ignorăm eroarea dacă fișierul nu există */ }
  },

  async updateOcrText(userId: string, docId: string, ocrText: string, childId?: string): Promise<void> {
    const colRef = childId ? childDocumentsRef(userId, childId) : documentsRef(userId);
    await updateDoc(doc(colRef, docId), { ocrText });
  },

  // Detectare tip document din numele fișierului și MIME
  detectType(fileName: string, mimeType: string): DocumentType {
    const name = fileName.toLowerCase();
    if (name.includes('ecografie') || name.includes('ultrasound')) return 'ultrasound';
    if (name.includes('certificat') || name.includes('certificate')) return 'birth_certificate';
    if (name.includes('vaccinare') || name.includes('vaccine')) return 'vaccine_card';
    if (name.includes('rețetă') || name.includes('reteta') || name.includes('prescription')) return 'prescription';
    if (name.includes('analize') || name.includes('analysis') || name.includes('bilet')) return 'analysis';
    return 'other';
  },
};
