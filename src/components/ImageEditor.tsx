import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { RotateCw, RotateCcw, Crop, Check, X, ZoomIn, ZoomOut, Move } from "lucide-react";

interface ImageEditorProps {
  imageSrc: string;
  onConfirm: (editedFile: File) => void;
  onCancel: () => void;
}

export const ImageEditor = ({ imageSrc, onConfirm, onCancel }: ImageEditorProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);

  // Crop state
  const [isCropping, setIsCropping] = useState(false);
  const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImageLoaded(true);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const container = previewRef.current;
    if (!container) return;

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    canvas.width = cw;
    canvas.height = ch;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, cw, ch);
    ctx.save();

    // Move to center, apply transforms
    ctx.translate(cw / 2 + pan.x, ch / 2 + pan.y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);

    // Fit image within container
    const scale = Math.min(cw / img.width, ch / img.height) * 0.85;
    const dw = img.width * scale;
    const dh = img.height * scale;

    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();

    // Draw crop overlay
    if (cropRect && isCropping) {
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      // Top
      ctx.fillRect(0, 0, cw, cropRect.y);
      // Bottom
      ctx.fillRect(0, cropRect.y + cropRect.h, cw, ch - cropRect.y - cropRect.h);
      // Left
      ctx.fillRect(0, cropRect.y, cropRect.x, cropRect.h);
      // Right
      ctx.fillRect(cropRect.x + cropRect.w, cropRect.y, cw - cropRect.x - cropRect.w, cropRect.h);

      // Crop border
      ctx.strokeStyle = "hsl(var(--primary))";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
      ctx.setLineDash([]);

      // Grid lines (rule of thirds)
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 1;
      for (let i = 1; i < 3; i++) {
        const lx = cropRect.x + (cropRect.w * i) / 3;
        const ly = cropRect.y + (cropRect.h * i) / 3;
        ctx.beginPath(); ctx.moveTo(lx, cropRect.y); ctx.lineTo(lx, cropRect.y + cropRect.h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cropRect.x, ly); ctx.lineTo(cropRect.x + cropRect.w, ly); ctx.stroke();
      }
    }
  }, [rotation, zoom, pan, cropRect, isCropping]);

  useEffect(() => {
    if (imageLoaded) {
      drawCanvas();
    }
  }, [imageLoaded, drawCanvas]);

  // Redraw on resize
  useEffect(() => {
    const handleResize = () => drawCanvas();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [drawCanvas]);

  const handlePointerDown = (e: React.PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isCropping) {
      setCropStart({ x, y });
      setCropRect({ x, y, w: 0, h: 0 });
    } else {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isCropping && cropStart) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      setCropRect({
        x: Math.min(cropStart.x, cx),
        y: Math.min(cropStart.y, cy),
        w: Math.abs(cx - cropStart.x),
        h: Math.abs(cy - cropStart.y),
      });
    } else if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    if (isCropping) {
      setCropStart(null);
    }
  };

  const rotate = (deg: number) => {
    setRotation((prev) => (prev + deg) % 360);
  };

  const applyCrop = () => {
    if (!cropRect || cropRect.w < 10 || cropRect.h < 10) {
      setIsCropping(false);
      setCropRect(null);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Extract cropped region
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const imageData = ctx.getImageData(cropRect.x, cropRect.y, cropRect.w, cropRect.h);

    // Create new canvas with crop dimensions
    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = cropRect.w;
    cropCanvas.height = cropRect.h;
    const cropCtx = cropCanvas.getContext("2d");
    if (!cropCtx) return;
    cropCtx.putImageData(imageData, 0, 0);

    // Replace image source
    const newImg = new Image();
    newImg.onload = () => {
      imgRef.current = newImg;
      setRotation(0);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setCropRect(null);
      setIsCropping(false);
      drawCanvas();
    };
    newImg.src = cropCanvas.toDataURL("image/jpeg", 0.92);
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    // Render final image at full resolution
    const outCanvas = document.createElement("canvas");
    const maxDim = Math.max(img.width, img.height);
    const isRotated90 = rotation % 180 !== 0;
    outCanvas.width = isRotated90 ? img.height : img.width;
    outCanvas.height = isRotated90 ? img.width : img.height;

    const ctx = outCanvas.getContext("2d");
    if (!ctx) return;

    ctx.translate(outCanvas.width / 2, outCanvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);

    outCanvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `edited-${Date.now()}.jpg`, { type: "image/jpeg" });
          onConfirm(file);
        }
      },
      "image/jpeg",
      0.92
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-card">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="w-4 h-4 mr-1" /> Cancel
        </Button>
        <span className="text-sm font-semibold text-foreground">Edit Photo</span>
        <Button size="sm" onClick={handleConfirm} className="bg-primary text-primary-foreground">
          <Check className="w-4 h-4 mr-1" /> Done
        </Button>
      </div>

      {/* Canvas area */}
      <div ref={previewRef} className="flex-1 relative overflow-hidden bg-muted/30">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 border-t border-border bg-card space-y-3">
        {/* Zoom slider */}
        <div className="flex items-center gap-3">
          <ZoomOut className="w-4 h-4 text-muted-foreground" />
          <Slider
            value={[zoom]}
            min={0.5}
            max={3}
            step={0.1}
            onValueChange={([v]) => setZoom(v)}
            className="flex-1"
          />
          <ZoomIn className="w-4 h-4 text-muted-foreground" />
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => rotate(-90)}
            title="Rotate left"
          >
            <RotateCcw className="w-4 h-4 mr-1" /> Left
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => rotate(90)}
            title="Rotate right"
          >
            <RotateCw className="w-4 h-4 mr-1" /> Right
          </Button>
          <Button
            variant={isCropping ? "default" : "outline"}
            size="sm"
            onClick={() => {
              if (isCropping && cropRect) {
                applyCrop();
              } else {
                setIsCropping(!isCropping);
                setCropRect(null);
              }
            }}
          >
            <Crop className="w-4 h-4 mr-1" />
            {isCropping ? (cropRect && cropRect.w > 10 ? "Apply Crop" : "Cancel") : "Crop"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRotation(0);
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
          >
            Reset
          </Button>
        </div>

        {isCropping && (
          <p className="text-xs text-center text-muted-foreground">
            Click and drag on the image to select crop area
          </p>
        )}
      </div>
    </div>
  );
};
