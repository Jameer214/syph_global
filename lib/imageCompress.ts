// Client-side image downscale before upload. A phone photo is often 3-6MB;
// served to every browser that scrolls past it, that's the platform's
// largest egress cost. Capping the long edge and re-encoding as JPEG cuts
// typical uploads by 80-95% with no visible loss at card/detail sizes.

export async function compressImage(file: File, maxDim = 1600, quality = 0.82): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    // Already small enough — skip the re-encode.
    if (scale === 1 && file.size < 400_000) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/i, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file; // never block an upload over compression
  }
}
