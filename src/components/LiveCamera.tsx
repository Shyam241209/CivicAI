import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Camera, X, SwitchCamera, Loader2 } from "lucide-react";

interface LiveCameraProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

export const LiveCamera = ({ onCapture, onClose }: LiveCameraProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async (facing: "environment" | "user") => {
    // Stop any existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    setIsLoading(true);
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err: unknown) {
      console.error("Camera error:", err);
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setError("Camera access denied. Please allow camera permissions.");
      } else {
        setError("Could not access camera on this device.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSwitchCamera = () => {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    startCamera(next);
  };

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Mirror if using front camera
    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" });
          // Stop stream before closing
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
          }
          onCapture(file);
        }
      },
      "image/jpeg",
      0.9
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
            onClose();
          }}
          className="text-white hover:bg-white/20 rounded-full h-10 w-10"
        >
          <X className="w-6 h-6" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSwitchCamera}
          className="text-white hover:bg-white/20 rounded-full h-10 w-10"
        >
          <SwitchCamera className="w-6 h-6" />
        </Button>
      </div>

      {/* Video feed */}
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-white animate-spin" />
          </div>
        )}
        {error && (
          <div className="text-center text-white p-6">
            <p className="text-lg mb-4">{error}</p>
            <Button variant="outline" onClick={onClose} className="text-white border-white hover:bg-white/20">
              Go Back
            </Button>
          </div>
        )}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
          style={{ display: error ? "none" : "block" }}
        />
      </div>

      {/* Capture button */}
      {!error && (
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center pb-8 pt-4">
          <button
            onClick={handleCapture}
            className="w-18 h-18 rounded-full border-4 border-white bg-white/20 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform"
            style={{ width: 72, height: 72 }}
          >
            <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center">
              <Camera className="w-7 h-7 text-black" />
            </div>
          </button>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};
