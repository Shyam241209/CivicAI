import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Camera, Upload, X, Loader2, AlertCircle, Check, ZoomOut, ZoomIn } from "lucide-react";
import { validateImage, compressImage, getThumbnail, formatFileSize, getImageBrightness, CompressedImage } from "@/lib/imageUtils";
import { LiveCamera } from "./LiveCamera";

export interface CivicReportImage {
  file: File;
  thumbnail: string;
  preview: string;
  isMain: boolean;
  isCompressed: boolean;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
  isDark: boolean;
  quality?: number;
}

interface MultiImageGalleryProps {
  maxImages?: number;
  onImagesSelected: (images: CivicReportImage[]) => void;
  currentImages?: CivicReportImage[];
}

export const MultiImageGallery: React.FC<MultiImageGalleryProps> = ({
  maxImages = 5,
  onImagesSelected,
  currentImages = [],
}) => {
  const { toast } = useToast();
  const [images, setImages] = useState<CivicReportImage[]>(currentImages);
  const [isCompressing, setIsCompressing] = useState(false);
  const [showCameraDialog, setShowCameraDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewImage, setPreviewImage] = useState<CivicReportImage | null>(null);

  /**
   * Process and add image to gallery
   */
  const addImage = async (file: File, isMain = false) => {
    try {
      // Validate
      const validation = await validateImage(file);
      if (!validation.isValid) {
        toast({
          title: "Image Invalid",
          description: validation.error,
          variant: "destructive",
        });
        return;
      }

      // Check if at max
      if (images.length >= maxImages) {
        toast({
          title: "Maximum Images",
          description: `You can upload up to ${maxImages} images per report.`,
          variant: "destructive",
        });
        return;
      }

      setIsCompressing(true);

      // Get brightness
      const { isDark } = await getImageBrightness(file);

      // Get thumbnail
      const thumbnail = await getThumbnail(file);

      // Compress
      const compressed = await compressImage(file);

      // Create preview
      const preview = compressed.dataUrl;

      // Create image record
      const civicImage: CivicReportImage = {
        file: compressed.file,
        thumbnail,
        preview,
        isMain: isMain || images.length === 0,
        isCompressed: true,
        originalSize: file.size,
        compressedSize: compressed.sizeKB * 1024,
        width: compressed.width,
        height: compressed.height,
        isDark,
        quality: compressed.quality,
      };

      // Update main image if needed
      const updatedImages = images.map(img => ({
        ...img,
        isMain: false,
      }));

      if (civicImage.isMain) {
        updatedImages.forEach(img => img.isMain = false);
      }

      const newImages = [...updatedImages, civicImage];
      setImages(newImages);
      onImagesSelected(newImages);

      // Show success with compression info
      const saved = file.size - civicImage.compressedSize;
      const savedPercent = Math.round((saved / file.size) * 100);
      
      toast({
        title: "Image Added",
        description: `${civicImage.width}×${civicImage.height} - Saved ${savedPercent}% (${formatFileSize(saved)})${isDark ? ' - Image is dark' : ''}`,
      });

      setIsCompressing(false);
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
      setIsCompressing(false);
    }
  };

  /**
   * Handle gallery selection
   */
  const handleGallerySelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      await addImage(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  /**
   * Remove image
   */
  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    
    // Ensure main image exists
    if (newImages.length > 0 && !newImages.some(img => img.isMain)) {
      newImages[0].isMain = true;
    }
    
    setImages(newImages);
    onImagesSelected(newImages);
    
    toast({
      title: "Image Removed",
    });
  };

  /**
   * Set as main image
   */
  const setAsMain = (index: number) => {
    const newImages = images.map((img, i) => ({
      ...img,
      isMain: i === index,
    }));
    setImages(newImages);
    onImagesSelected(newImages);
  };

  /**
   * Handle camera capture
   */
  const handleCameraCapture = async (dataUrl: string) => {
    try {
      const blob = await fetch(dataUrl).then(res => res.blob());
      const file = new File([blob], `civic-issue-${Date.now()}.jpg`, { type: "image/jpeg" });
      await addImage(file, images.length === 0);
      setShowCameraDialog(false);
    } catch (error) {
      toast({
        title: "Camera Error",
        description: "Failed to capture photo",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowCameraDialog(true)}
          disabled={isCompressing || images.length >= maxImages}
          className="gap-2"
        >
          <Camera className="w-4 h-4" />
          Camera
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isCompressing || images.length >= maxImages}
          className="gap-2"
        >
          <Upload className="w-4 h-4" />
          Gallery
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleGallerySelect}
        disabled={isCompressing}
        className="hidden"
      />

      {/* Loading state */}
      {isCompressing && (
        <div className="flex items-center justify-center py-8 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Optimizing image...
        </div>
      )}

      {/* Images Grid */}
      {images.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">
              Civic Images ({images.length}/{maxImages})
            </label>
            {images.some(img => img.isDark) && (
              <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                <AlertCircle className="w-3 h-3" />
                Some images are dark
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {images.map((image, index) => (
              <div key={index} className="relative group">
                <div
                  className={`aspect-square rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                    image.isMain
                      ? "border-blue-500 ring-2 ring-blue-200"
                      : "border-gray-200 hover:border-gray-400"
                  }`}
                  onClick={() => setPreviewImage(image)}
                >
                  <img
                    src={image.thumbnail}
                    alt={`Civic issue ${index + 1}`}
                    className="w-full h-full object-cover"
                  />

                  {/* Dark image indicator */}
                  {image.isDark && (
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <AlertCircle className="w-4 h-4 text-amber-400" />
                    </div>
                  )}

                  {/* Main indicator */}
                  {image.isMain && (
                    <div className="absolute top-1 right-1 bg-blue-500 text-white rounded-full p-1">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </div>

                {/* Hover actions */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                  {!image.isMain && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAsMain(index);
                      }}
                      className="text-xs"
                    >
                      Main
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeImage(index);
                    }}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Image details card */}
          {images.length > 0 && (
            <Card className="p-3 bg-gray-50">
              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">Main Image:</span>
                  <span className="font-medium">
                    {images.find(img => img.isMain)?.width}×{images.find(img => img.isMain)?.height}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Size:</span>
                  <span className="font-medium">
                    {formatFileSize(images.reduce((sum, img) => sum + img.compressedSize, 0))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Compression:</span>
                  <span className="font-medium text-green-600">
                    {Math.round(
                      ((images.reduce((sum, img) => sum + img.originalSize, 0) -
                        images.reduce((sum, img) => sum + img.compressedSize, 0)) /
                        images.reduce((sum, img) => sum + img.originalSize, 0)) *
                        100
                    )}%
                  </span>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Empty state */}
      {images.length === 0 && !isCompressing && (
        <Card className="p-8 text-center border-dashed">
          <Camera className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            Start by taking a photo or selecting from gallery
          </p>
        </Card>
      )}

      {/* Camera Dialog */}
      <Dialog open={showCameraDialog} onOpenChange={setShowCameraDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Take a Photo</DialogTitle>
            <DialogDescription>
              Position the issue clearly in frame for better AI analysis
            </DialogDescription>
          </DialogHeader>
          <LiveCamera
            onCapture={handleCameraCapture}
            onClose={() => setShowCameraDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      {previewImage && (
        <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Image Preview</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <img
                src={previewImage.preview}
                alt="Preview"
                className="w-full rounded-lg"
              />
              <div className="text-xs text-gray-600 space-y-1">
                <div className="flex justify-between">
                  <span>Dimensions:</span>
                  <span className="font-medium">
                    {previewImage.width}×{previewImage.height}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Compressed Size:</span>
                  <span className="font-medium">
                    {formatFileSize(previewImage.compressedSize)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Quality:</span>
                  <span className="font-medium">{Math.round((previewImage.quality || 0.95) * 100)}%</span>
                </div>
                {previewImage.isDark && (
                  <div className="flex items-center gap-1 text-amber-600">
                    <AlertCircle className="w-3 h-3" />
                    Image is dark - may affect AI analysis
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default MultiImageGallery;
