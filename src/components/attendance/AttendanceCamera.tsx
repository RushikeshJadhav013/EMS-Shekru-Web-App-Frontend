import React, { useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Camera, RotateCcw, Check, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/hooks/use-toast';

interface AttendanceCameraProps {
  onCapture: (imageData: string) => void;
  onCancel: () => void;
}

const AttendanceCamera: React.FC<AttendanceCameraProps> = ({ onCapture, onCancel }) => {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  React.useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'user' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: false
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
        setIsLoading(false);
      }
    } catch (error) {
      toast({
        title: 'Camera Error',
        description: t.attendance.cameraRequired,
        variant: 'destructive',
      });
      onCancel();
    }
  };

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        // Flip horizontally to correct the mirror effect from front camera
        // This ensures the captured image is in normal (non-mirrored) orientation
        context.save();
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        context.restore();
        
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        setPhoto(imageData);
        
        // Stop the camera stream after capturing to save resources
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
      }
    }
  }, [stream]);

  const retakePhoto = async () => {
    setPhoto(null);
    // Restart the camera if it was stopped
    if (!stream || !stream.active) {
      setIsLoading(true);
      await startCamera();
    }
  };

  const confirmPhoto = () => {
    if (photo) {
      onCapture(photo);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    }
  };

  return (
    <Card className="p-6 max-w-2xl mx-auto">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-center">{t.attendance.capturePhoto}</h3>
        
        <div className="relative rounded-lg overflow-hidden bg-muted aspect-[4/3]">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-pulse-slow">
                <Camera className="h-12 w-12 text-muted-foreground" />
              </div>
            </div>
          )}
          
          {!photo ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ display: isLoading ? 'none' : 'block', transform: 'scaleX(-1)' }}
            />
          ) : (
            <img src={photo} alt="Captured" className="w-full h-full object-cover" />
          )}
          
          <canvas ref={canvasRef} className="hidden" />
        </div>
        
        <div className="flex gap-3 justify-center">
          {!photo ? (
            <>
              <Button
                onClick={capturePhoto}
                disabled={isLoading}
                size="lg"
                className="gap-2"
              >
                <Camera className="h-5 w-5" />
                {t.attendance.capturePhoto}
              </Button>
              <Button
                onClick={onCancel}
                variant="outline"
                size="lg"
                className="gap-2"
              >
                <X className="h-5 w-5" />
                {t.common.cancel}
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={retakePhoto}
                variant="outline"
                size="lg"
                className="gap-2"
              >
                <RotateCcw className="h-5 w-5" />
                {t.attendance.retake}
              </Button>
              <Button
                onClick={confirmPhoto}
                size="lg"
                className="gap-2"
              >
                <Check className="h-5 w-5" />
                {t.attendance.usePhoto}
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
};

export default AttendanceCamera;