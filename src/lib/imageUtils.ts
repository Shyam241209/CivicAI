/**
 * Image Utilities for compression, validation, and optimization
 * Designed for civic issue reporting with mobile-first approach
 */

export interface CompressedImage {
  file: File;
  dataUrl: string;
  width: number;
  height: number;
  sizeKB: number;
  quality: number;
}

export interface ImageValidationResult {
  isValid: boolean;
  error?: string;
  width?: number;
  height?: number;
  sizeKB?: number;
}

// Configuration constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const TARGET_SIZE = 2 * 1024 * 1024; // 2 MB target after compression
const MAX_DIMENSION = 4096; // Max width or height
const MIN_DIMENSION = 320; // Minimum useful dimension
const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const QUALITY_START = 0.95;
const QUALITY_MIN = 0.4;

/**
 * Validate an image file for civic issue reporting
 */
export async function validateImage(file: File): Promise<ImageValidationResult> {
  // Check file type
  if (!SUPPORTED_TYPES.includes(file.type)) {
    return {
      isValid: false,
      error: `Unsupported image format. Supported: JPEG, PNG, WebP, GIF`,
    };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: `Image too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum: 10 MB`,
    };
  }

  // Check if it's a valid image by loading it
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    
    if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
      return {
        isValid: false,
        error: `Image too small (${width}x${height}). Minimum: ${MIN_DIMENSION}x${MIN_DIMENSION}`,
        width,
        height,
        sizeKB: Math.round(file.size / 1024),
      };
    }

    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      return {
        isValid: false,
        error: `Image dimension too large (${width}x${height}). Maximum: ${MAX_DIMENSION}x${MAX_DIMENSION}`,
        width,
        height,
        sizeKB: Math.round(file.size / 1024),
      };
    }

    return {
      isValid: true,
      width,
      height,
      sizeKB: Math.round(file.size / 1024),
    };
  } catch (error) {
    return {
      isValid: false,
      error: 'Invalid image file or corrupted data',
    };
  }
}

/**
 * Compress an image to optimize for upload and AI analysis
 * Uses canvas-based compression with quality adjustment
 */
export async function compressImage(
  file: File,
  targetQuality = QUALITY_START
): Promise<CompressedImage> {
  // Create bitmap from file
  const bitmap = await createImageBitmap(file);
  const { width: origWidth, height: origHeight } = bitmap;

  // Calculate scale for max dimension
  const scale = Math.min(MAX_DIMENSION / Math.max(origWidth, origHeight), 1);
  const width = Math.round(origWidth * scale);
  const height = Math.round(origHeight * scale);

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  // Draw image on canvas
  ctx.drawImage(bitmap, 0, 0, width, height);

  // Determine target format
  const targetFormat = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  let quality = targetQuality;
  let dataUrl = '';
  let finalSize = 0;

  // Progressively reduce quality until target size is met
  while (quality >= QUALITY_MIN) {
    dataUrl = canvas.toDataURL(targetFormat, quality);
    finalSize = Math.round((dataUrl.length * 3) / 4); // Rough estimate from base64

    if (finalSize <= TARGET_SIZE) {
      break;
    }

    quality -= 0.05;
  }

  // Convert data URL to File
  const blob = await fetch(dataUrl).then(res => res.blob());
  const compressedFile = new File(
    [blob],
    file.name.replace(/\.[^/.]+$/, `.${targetFormat === 'image/png' ? 'png' : 'jpg'}`),
    { type: targetFormat }
  );

  return {
    file: compressedFile,
    dataUrl,
    width,
    height,
    sizeKB: Math.round(compressedFile.size / 1024),
    quality: Math.round(quality * 100) / 100,
  };
}

/**
 * Get a thumbnail from an image file (for preview)
 */
export async function getThumbnail(
  file: File,
  maxWidth = 200,
  maxHeight = 200
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const { width: origWidth, height: origHeight } = bitmap;

  const scale = Math.min(maxWidth / origWidth, maxHeight / origHeight, 1);
  const width = Math.round(origWidth * scale);
  const height = Math.round(origHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.8);
}

/**
 * Check if image appears to be blank or mostly empty
 */
export async function isBlankImage(file: File, threshold = 0.95): Promise<boolean> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Count "light" pixels (grayscale > 200)
  let lightPixels = 0;
  for (let i = 0; i < data.length; i += 4) {
    const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
    if (gray > 200) lightPixels++;
  }

  const lightRatio = lightPixels / (canvas.width * canvas.height);
  return lightRatio > threshold;
}

/**
 * Calculate image brightness to detect low-light conditions
 */
export async function getImageBrightness(file: File): Promise<{
  brightness: number; // 0-1
  isDark: boolean; // True if brightness < 0.3
}> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = Math.min(bitmap.width, 100);
  canvas.height = Math.min(bitmap.height, 100);

  const ctx = canvas.getContext('2d');
  if (!ctx) return { brightness: 0.5, isDark: false };

  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  let totalBrightness = 0;
  for (let i = 0; i < data.length; i += 4) {
    const gray = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
    totalBrightness += gray;
  }

  const brightness = totalBrightness / (canvas.width * canvas.height);
  return {
    brightness,
    isDark: brightness < 0.3,
  };
}

/**
 * Format bytes to human-readable size
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get image dimensions without loading full bitmap
 */
export async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  return { width: bitmap.width, height: bitmap.height };
}

/**
 * Rotate an image by 90 degrees
 */
export async function rotateImage(file: File, clockwise = true): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const angle = clockwise ? Math.PI / 2 : -Math.PI / 2;

  const canvas = document.createElement('canvas');
  canvas.width = bitmap.height;
  canvas.height = bitmap.width;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(angle);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);

  const blob = await new Promise<Blob>(resolve => canvas.toBlob(resolve, file.type));
  return new File([blob], file.name, { type: file.type });
}

/**
 * Crop an image to a specific region
 */
export async function cropImage(
  file: File,
  x: number,
  y: number,
  width: number,
  height: number
): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  ctx.drawImage(bitmap, x, y, width, height, 0, 0, width, height);

  const blob = await new Promise<Blob>(resolve => canvas.toBlob(resolve, file.type));
  return new File([blob], file.name, { type: file.type });
}
