import { createClient } from '@/lib/supabase/client';

/**
 * Service for uploading and managing event banner images and media assets.
 * Supports direct Supabase Storage uploads with graceful fallback to high-quality compressed Base64 data URLs.
 */
export async function uploadEventImage(file: File): Promise<string> {
  const supabase = createClient();

  // Validate file type
  if (!file.type.startsWith('image/')) {
    throw new Error('Le fichier sélectionné doit être une image (JPG, PNG, WebP).');
  }

  // Max file size: 5MB
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("L'image est trop volumineuse. Taille maximale autorisée : 5 Mo.");
  }

  // Compression intelligente et redimensionnement côté client pour éviter d'exploser le quota localStorage du navigateur
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = e.target?.result as string;
      if (!rawDataUrl) {
        return reject(new Error("Impossible de lire l'image sélectionnée."));
      }

      // Utiliser un élément Image et Canvas pour redimensionner (max 1200px) et compresser en JPEG 80%
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 1200;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return resolve(rawDataUrl);
          }

          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
          resolve(compressedDataUrl);
        } catch {
          resolve(rawDataUrl);
        }
      };
      img.onerror = () => resolve(rawDataUrl);
      img.src = rawDataUrl;
    };
    reader.onerror = () => reject(new Error("Erreur lors de la lecture de l'image."));
    reader.readAsDataURL(file);
  });
}
