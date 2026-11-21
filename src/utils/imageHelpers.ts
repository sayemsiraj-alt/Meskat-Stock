/**
 * Compresses an uploaded company logo image file into a compact Data URL
 * (max 256px dimension) so it stays well within Firestore's 1 MiB document limit.
 */
export const compressLogoDataUrl = (
  file: File,
  maxDimension = 256
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = (event) => {
      const rawDataUrl = event.target?.result;
      if (typeof rawDataUrl !== 'string') {
        reject(new Error('Invalid image data.'));
        return;
      }

      const img = new Image();
      img.onerror = () => resolve(rawDataUrl);
      img.onload = () => {
        try {
          const width = img.naturalWidth || img.width || maxDimension;
          const height = img.naturalHeight || img.height || maxDimension;
          const scale = Math.min(1, maxDimension / Math.max(width, height));
          const targetW = Math.max(1, Math.round(width * scale));
          const targetH = Math.max(1, Math.round(height * scale));

          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(rawDataUrl);
            return;
          }

          ctx.clearRect(0, 0, targetW, targetH);
          ctx.drawImage(img, 0, 0, targetW, targetH);

          // Keep PNG transparency when reasonably small, otherwise encode compact JPEG
          const pngUrl = canvas.toDataURL('image/png');
          if (pngUrl.length <= 160_000) {
            resolve(pngUrl);
            return;
          }
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } catch {
          resolve(rawDataUrl);
        }
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
};
