import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

// Extend Window interface for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
  onstart: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export const VoiceInput = ({ onTranscript, disabled, className }: VoiceInputProps) => {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  const { toast } = useToast();
  const toastRef = useRef(toast);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  useEffect(() => {
    // Check for browser support
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognitionAPI) {
      setIsSupported(true);
      const recognitionInstance = new SpeechRecognitionAPI();
      recognitionInstance.continuous = true;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = "en-IN"; // Indian English for better recognition
      
      recognitionInstance.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = "";
        let interimTranscript = "";
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimTranscript += result[0].transcript;
          }
        }
        
        if (finalTranscript) {
          onTranscriptRef.current(finalTranscript);
        }
      };
      
      recognitionInstance.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
        
        if (event.error === "not-allowed") {
          toastRef.current({
            title: "Microphone Access Denied",
            description: "Please allow microphone access to use voice input",
            variant: "destructive",
          });
        } else if (event.error !== "aborted") {
          toastRef.current({
            title: "Voice Input Error",
            description: "Could not recognize speech. Please try again.",
            variant: "destructive",
          });
        }
      };
      
      recognitionInstance.onend = () => {
        setIsListening(false);
      };
      
      recognitionInstance.onstart = () => {
        setIsListening(true);
      };
      
      recognitionRef.current = recognitionInstance;
    }
    
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  const toggleListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    
    if (isListening) {
      recognition.stop();
      toast({
        title: "Voice Input Stopped",
        description: "Speech recognition has been stopped",
      });
    } else {
      try {
        recognition.start();
        toast({
          title: "Listening...",
          description: "Speak now to describe the issue",
        });
      } catch (error) {
        console.error("Failed to start recognition:", error);
        toast({
          title: "Failed to Start",
          description: "Could not start voice input. Please try again.",
          variant: "destructive",
        });
      }
    }
  }, [isListening, toast]);

  if (!isSupported) {
    return null; // Don't show button if not supported
  }

  return (
    <Button
      type="button"
      variant={isListening ? "destructive" : "outline"}
      size="icon"
      onClick={toggleListening}
      disabled={disabled}
      className={className}
      title={isListening ? "Stop listening" : "Start voice input"}
    >
      {isListening ? (
        <MicOff className="w-4 h-4 animate-pulse" />
      ) : (
        <Mic className="w-4 h-4" />
      )}
    </Button>
  );
};
