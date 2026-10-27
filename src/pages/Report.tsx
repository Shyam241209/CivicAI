import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload, MapPin, Camera, FileText, Zap, AlertCircle, Locate, CheckCircle, X, RotateCcw, WifiOff, CloudUpload, Search, Plus, Minus } from "lucide-react";
import { useOfflineReports } from "@/hooks/useOfflineReports";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AnalysisResults } from "@/components/AnalysisResults";
import { AnalysisComparisonView } from "@/components/AnalysisComparisonView";
import { VoiceInput } from "@/components/VoiceInput";
import { AppLayout } from "@/components/AppLayout";
import { useTranslation } from "@/hooks/use-translation";
import { LiveCamera } from "@/components/LiveCamera";
import { ImageEditor } from "@/components/ImageEditor";
import { MultiImageGallery, CivicReportImage } from "@/components/MultiImageGallery";
import { DuplicateWarning } from "@/components/DuplicateWarning";
import { PrioritySeverityBadge } from "@/components/PrioritySeverityBadge";
import { checkForDuplicates, DuplicateCheckResult } from "@/lib/duplicateDetection";
import { calculatePriorityScore, PriorityScoreDetails } from "@/lib/priorityScoring";
import {
  routeReportToDepartment,
  formatRoutingMessage,
  shouldAutoAssign,
} from "@/lib/reportWorkflow";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  reverseGeocode,
  reverseGeocodeDetails,
  forwardGeocode,
  forwardGeocodeMany,
  haversineKm,
  HOSUR_BIAS,
  type ForwardGeocodeResult,
  type ReverseGeocodeDetails,
} from "@/lib/reverseGeocode";
import { matchDepartment } from "@/lib/departmentMatcher";

interface AnalysisResult {
  is_valid_civic_issue: boolean;
  validation_message: string;
  issue_category: string;
  severity: string;
  priority_level: string;
  short_description: string;
  suggested_department: string;
  context_analysis: string;
  estimated_resolution_time: string;
  recommended_action: string;
  ai_confidence_score: number;
  detected_objects?: string[];
}

const Report = () => {
  const { t } = useTranslation();
  // Multi-image support (PHASE 1)
  const [images, setImages] = useState<CivicReportImage[]>([]);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<ForwardGeocodeResult[]>([]);
  const [isAutocompleting, setIsAutocompleting] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedSuggestion, setHighlightedSuggestion] = useState(-1);
  const [locationDetails, setLocationDetails] = useState<ReverseGeocodeDetails | null>(null);
  // User-edited overrides for the structured address fields. When set, these
  // win over the reverse-geocoded values so manual fixes survive re-pinning.
  const [editedDetails, setEditedDetails] = useState<Partial<ReverseGeocodeDetails>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [previousAnalysisResult, setPreviousAnalysisResult] = useState<AnalysisResult | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isInvalidImage, setIsInvalidImage] = useState(false);
  // PHASE 1: Duplicate detection
  const [duplicateCheckResult, setDuplicateCheckResult] = useState<DuplicateCheckResult | null>(null);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  // PHASE 2: Priority scoring
  const [priorityDetails, setPriorityDetails] = useState<PriorityScoreDetails | null>(null);
  // PHASE 2: Department assignment
  const [assignedDepartmentId, setAssignedDepartmentId] = useState<string | null>(null);
  const [assignedDepartmentName, setAssignedDepartmentName] = useState<string | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showLiveCamera, setShowLiveCamera] = useState(false);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState<string>("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isOnline, pendingReports, isSyncing, saveOffline, syncAll, pendingCount } = useOfflineReports();

  // Map refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const currentLocationMarkerRef = useRef<maplibregl.Marker | null>(null);
  const markerDraggableRef = useRef(false);
  // True when the next `location` change came from the user typing
  // (used to trigger debounced live geocoding without looping on
  // programmatic updates from GPS / map clicks / search).
  const userTypedRef = useRef(false);

  /**
   * Animate the marker to a new coordinate with a soft drop + bounce so
   * selecting a suggestion feels responsive (Google-Maps-style).
   * Falls back to instant placement if no marker exists yet.
   */
  const isValidCoordinatePair = (lat: number, lng: number) => {
    return Number.isFinite(lat) && Number.isFinite(lng)
      && lat >= -90 && lat <= 90
      && lng >= -180 && lng <= 180;
  };

  const normalizeCoordinatePair = useCallback((lat: number | string | null | undefined, lng: number | string | null | undefined) => {
    if (lat === null || lat === undefined || lng === null || lng === undefined) {
      return null;
    }
    if ((typeof lat === "string" && lat.trim() === "") || (typeof lng === "string" && lng.trim() === "")) {
      return null;
    }

    const parsedLat = typeof lat === "number" ? lat : Number(lat);
    const parsedLng = typeof lng === "number" ? lng : Number(lng);

    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
      return null;
    }

    if (!isValidCoordinatePair(parsedLat, parsedLng)) {
      return null;
    }

    return { lat: parsedLat, lng: parsedLng };
  }, []);

  const safeSetLocationCoords = useCallback((lat: number | null | undefined, lng: number | null | undefined) => {
    const normalized = normalizeCoordinatePair(lat, lng);
    if (!normalized) {
      setLocationCoords(null);
      return null;
    }
    setLocationCoords(normalized);
    return normalized;
  }, [normalizeCoordinatePair]);

  const syncMapMarkerToCoords = useCallback((lat: number, lng: number, draggable = false) => {
    if (!mapRef.current) return;

    if (!isValidCoordinatePair(lat, lng)) {
      return;
    }

    if (markerRef.current) {
      markerRef.current.setLngLat([lng, lat]);
      markerRef.current.setDraggable(draggable);
      markerDraggableRef.current = draggable;
      return;
    }

    markerRef.current = new maplibregl.Marker({ color: "#F58220", draggable })
      .setLngLat([lng, lat])
      .addTo(mapRef.current);
    markerDraggableRef.current = draggable;
  }, []);

  const removeCurrentLocationMarker = useCallback(() => {
    if (currentLocationMarkerRef.current) {
      currentLocationMarkerRef.current.remove();
      currentLocationMarkerRef.current = null;
    }
  }, []);

  const updateCurrentLocationMarker = useCallback((lat: number, lng: number) => {
    if (!isValidCoordinatePair(lat, lng) || !mapRef.current) return;

    const addMarker = () => {
      const map = mapRef.current;
      if (!map || !map.isStyleLoaded()) return;

      if (currentLocationMarkerRef.current) {
        currentLocationMarkerRef.current.setLngLat([lng, lat]);
        return;
      }

      const markerElement = document.createElement("div");
      markerElement.className = "my-location-marker";
      markerElement.setAttribute("aria-label", "My location");
      markerElement.title = "Current location";
      markerElement.style.cssText = [
        "width: 16px;",
        "height: 16px;",
        "display: block;",
        "position: relative;",
        "overflow: visible;",
        "pointer-events: none;",
        "z-index: 500;",
      ].join(" ");

      const markerCore = document.createElement("span");
      markerCore.className = "my-location-marker-core";
      markerCore.setAttribute("aria-hidden", "true");
      markerElement.appendChild(markerCore);

      currentLocationMarkerRef.current = new maplibregl.Marker({
        element: markerElement,
        anchor: "center",
        rotationAlignment: "map",
      })
        .setLngLat([lng, lat])
        .addTo(map);
    };

    if (mapRef.current.isStyleLoaded()) {
      addMarker();
    } else {
      mapRef.current.once("load", addMarker);
    }
  }, []);

  const animateMarkerTo = (lng: number, lat: number) => {
    if (!mapRef.current) return;
    syncMapMarkerToCoords(lat, lng, markerDraggableRef.current);
    const el = markerRef.current?.getElement();
    if (!el) return;
    el.style.transition = "transform 450ms cubic-bezier(0.34, 1.56, 0.64, 1)";
    // Pop up then settle — runs every selection.
    el.style.transformOrigin = "center bottom";
    el.animate(
      [
        { transform: "translateY(-18px) scale(1.25)" },
        { transform: "translateY(0) scale(1)" },
      ],
      { duration: 500, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" }
    );
  };

  // Initialize map
  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current) {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: "https://tiles.openfreemap.org/styles/bright",
        center: [78.14, 11.65],
        zoom: 12,
      });

      map.addControl(new maplibregl.NavigationControl(), "top-right");

      // Handle map click to select location
      map.on("click", (e) => {
        const { lng, lat } = e.lngLat;
        if (!isValidCoordinatePair(lat, lng)) {
          return;
        }

        removeCurrentLocationMarker();
        safeSetLocationCoords(lat, lng);
        userTypedRef.current = false;
        setLocation(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);

        // Reverse geocode to get address name
        reverseGeocode(lat, lng).then((address) => {
          userTypedRef.current = false;
          setLocation(address);
        });

        // Update or create draggable marker
        if (markerRef.current) {
          markerRef.current.setLngLat([lng, lat]);
        } else {
          markerRef.current = new maplibregl.Marker({ color: "#F58220", draggable: true })
            .setLngLat([lng, lat])
            .addTo(map);
          markerDraggableRef.current = true;
          // When the user drags the pin, resolve the new spot to a name —
          // mirrors Google Maps' draggable pin behaviour.
          markerRef.current.on("dragend", () => {
            const ll = markerRef.current?.getLngLat();
            if (!ll || !isValidCoordinatePair(ll.lat, ll.lng)) {
              return;
            }
            safeSetLocationCoords(ll.lat, ll.lng);
            reverseGeocode(ll.lat, ll.lng).then((address) => {
              userTypedRef.current = false;
              setLocation(address);
            });
          });
        }

        toast({
          title: t("locationCaptured"),
          description: "Location selected on map",
        });
      });

      mapRef.current = map;
    }

    return () => {
      removeCurrentLocationMarker();
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [removeCurrentLocationMarker, t, toast]);

  const compressImage = (file: File, maxWidth = 1280, quality = 0.7): Promise<File> => {
    return new Promise((resolve) => {
      // Skip compression for small files (<500KB)
      if (file.size < 500 * 1024) {
        resolve(file);
        return;
      }

      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressed = new File([blob], file.name, { type: "image/jpeg", lastModified: Date.now() });
              console.log(`Compressed: ${(file.size / 1024).toFixed(0)}KB → ${(compressed.size / 1024).toFixed(0)}KB`);
              resolve(compressed);
            } else {
              resolve(file);
            }
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setRawImageSrc(reader.result as string);
        setShowImageEditor(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCameraCapture = async (file: File) => {
    setShowLiveCamera(false);
    const reader = new FileReader();
    reader.onloadend = () => {
      setRawImageSrc(reader.result as string);
      setShowImageEditor(true);
    };
    reader.readAsDataURL(file);
  };

  const handleEditorConfirm = async (editedFile: File) => {
    setShowImageEditor(false);
    setIsInvalidImage(false);
    setAnalysisResult(null);

    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(editedFile);

    const compressed = await compressImage(editedFile);
    setImage(compressed);

    toast({
      title: t("analyzing"),
      description: editedFile.size > 500 * 1024
        ? `Compressed from ${(editedFile.size / 1024 / 1024).toFixed(1)}MB to ${(compressed.size / 1024 / 1024).toFixed(1)}MB`
        : t("analyzing"),
    });
    await analyzeImage(compressed);
  };

  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setIsGettingLocation(false);
      toast({
        title: t("locationError"),
        description: "Geolocation is not supported by your browser or device.",
        variant: "destructive",
      });
      return;
    }

    setIsGettingLocation(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords?.latitude;
        const lng = position.coords?.longitude;

        const coords = safeSetLocationCoords(lat, lng);

        if (!coords) {
          setIsGettingLocation(false);
          setLocationCoords(null);
          toast({
            title: t("locationError"),
            description: "The browser returned invalid coordinates. Please try again or choose a location on the map.",
            variant: "destructive",
          });
          return;
        }

        userTypedRef.current = false;
        setLocation(`${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`);

        reverseGeocode(coords.lat, coords.lng).then((address) => {
          userTypedRef.current = false;
          if (address && !/^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(address)) {
            setLocation(address);
          }
        });

        if (mapRef.current) {
          const { lat: validLat, lng: validLng } = coords;
          if (isValidCoordinatePair(validLat, validLng)) {
            mapRef.current.flyTo({
              center: [validLng, validLat],
              zoom: 15,
              essential: true,
            });
            updateCurrentLocationMarker(validLat, validLng);
            syncMapMarkerToCoords(validLat, validLng, true);
          }
        }

        setIsGettingLocation(false);
        toast({
          title: t("locationCaptured"),
          description: "Current location detected successfully.",
        });
      },
      (error) => {
        const errorMessage = (() => {
          switch (error?.code) {
            case error?.PERMISSION_DENIED:
              return "Location permission was denied. Please allow access or choose a location manually.";
            case error?.POSITION_UNAVAILABLE:
              return "Your current position is unavailable right now. Please try again or choose a location on the map.";
            case error?.TIMEOUT:
              return "Location request timed out. Please try again or select a location manually.";
            default:
              return "Could not retrieve your current location. Please try again or choose a location on the map.";
          }
        })();

        console.error("Error getting location:", error);
        setIsGettingLocation(false);
        removeCurrentLocationMarker();
        setLocationCoords((current) => (
          current && isValidCoordinatePair(current.lat, current.lng) ? current : null
        ));
        toast({
          title: t("locationError"),
          description: errorMessage,
          variant: "destructive",
        });
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
    );
  }, [removeCurrentLocationMarker, safeSetLocationCoords, syncMapMarkerToCoords, t, toast, updateCurrentLocationMarker]);

  /** Forward-geocode the typed address and place a marker on the map. */
  const handleSearchLocation = async () => {
    const query = location.trim();
    if (!query) {
      toast({
        title: "Type an address",
        description: "Enter a street, area, or landmark to search.",
        variant: "destructive",
      });
      return;
    }
    setIsSearchingLocation(true);
    // Always run the looser multi-result query first so vague terms like
    // "hosur busstand" still resolve to the closest match. Only fall back
    // to the strict single-result query if the looser one returns nothing.
    let result: ForwardGeocodeResult | null = null;
    const many = await forwardGeocodeMany(query, 1);
    if (many.length > 0) {
      result = many[0];
    } else {
      result = await forwardGeocode(query);
    }
    // Last-resort: try splitting the query into significant tokens so things
    // like "hosur busstand" → "hosur" still pin somewhere reasonable.
    if (!result) {
      const tokens = query.split(/\s+/).filter((t) => t.length >= 4);
      for (const tok of tokens) {
        const r = await forwardGeocodeMany(tok, 1);
        if (r.length > 0) { result = r[0]; break; }
      }
    }
    setIsSearchingLocation(false);
    if (!result) {
      toast({
        title: "No exact match",
        description: "Showing the closest area we could find — fine-tune by tapping the map.",
      });
      return;
    }
    removeCurrentLocationMarker();
    if (!isValidCoordinatePair(result.lat, result.lng)) {
      setLocationCoords(null);
      return;
    }
    setLocationCoords({ lat: result.lat, lng: result.lng });
    userTypedRef.current = false;
    setLocation(result.displayName);
    setShowSuggestions(false);
    setLocationSuggestions([]);
    if (mapRef.current) {
      mapRef.current.flyTo({ center: [result.lng, result.lat], zoom: 16, essential: true });
      animateMarkerTo(result.lng, result.lat);
    }
    toast({
      title: t("locationCaptured"),
      description: "Address found and pinned on the map.",
    });
  };

  /**
   * Debounced live geocoding: as the user types an address, look it up after
   * a short pause and silently move the map pin. Skips when the value was set
   * programmatically (GPS, map click, search button) and when too short.
   */
  useEffect(() => {
    if (!userTypedRef.current) {
      setLocationSuggestions([]);
      setIsAutocompleting(false);
      return;
    }
    const query = location.trim();
    if (query.length < 3) {
      setLocationSuggestions([]);
      setIsAutocompleting(false);
      return;
    }
    // Don't re-geocode if user is typing literal coordinates from a map click.
    if (/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(query)) {
      setLocationSuggestions([]);
      setIsAutocompleting(false);
      return;
    }

    const controller = new AbortController();
    const handle = setTimeout(async () => {
      setIsAutocompleting(true);
      const results = await forwardGeocodeMany(query, 8, controller.signal, HOSUR_BIAS);
      if (controller.signal.aborted) return;
      setIsAutocompleting(false);
      if (userTypedRef.current === false) return;
      setLocationSuggestions(results);
      setShowSuggestions(results.length > 0);
      // Silently move pin to top result so the map tracks typing.
      const top = results[0];
      if (top) {
        if (!isValidCoordinatePair(top.lat, top.lng)) {
          setLocationCoords(null);
          return;
        }
        setLocationCoords({ lat: top.lat, lng: top.lng });
        if (mapRef.current) {
          mapRef.current.flyTo({ center: [top.lng, top.lat], zoom: 14 });
          if (markerRef.current) {
            markerRef.current.setLngLat([top.lng, top.lat]);
          } else {
            markerRef.current = new maplibregl.Marker({ color: "#F58220" })
              .setLngLat([top.lng, top.lat])
              .addTo(mapRef.current);
            markerDraggableRef.current = false;
          }
        }
      }
    }, 700);

    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [location]);

  /**
   * Always show readable place names instead of raw coordinates. If the
   * location field ever ends up as "lat, lng" (e.g. from a map click before
   * reverse-geocoding finishes, or pasted coords), look it up and replace
   * with the display name.
   */
  useEffect(() => {
    const trimmed = location.trim();
    const coordMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (!coordMatch) return;
    const lat = parseFloat(coordMatch[1]);
    const lng = parseFloat(coordMatch[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    let cancelled = false;
    reverseGeocode(lat, lng).then((address) => {
      if (cancelled) return;
      // Only replace if we got a real name back (not the same coords string).
      if (address && !/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(address)) {
        userTypedRef.current = false;
        setLocation(address);
        if (isValidCoordinatePair(lat, lng)) {
          setLocationCoords({ lat, lng });
        } else {
          setLocationCoords(null);
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [location]);

  /**
   * Whenever we have valid coordinates, pull structured address parts so the
   * UI can show street / area / city / pincode separately.
   */
  useEffect(() => {
    if (!locationCoords) {
      setLocationDetails(null);
      return;
    }
    let cancelled = false;
    reverseGeocodeDetails(locationCoords.lat, locationCoords.lng).then((d) => {
      if (cancelled) return;
      setLocationDetails(d);
      // Fresh pin → discard any previous manual edits.
      setEditedDetails({});
    });
    return () => {
      cancelled = true;
    };
  }, [locationCoords]);

  /**
   * Whenever the user manually edits one of the structured address fields,
   * rebuild the canonical `location` string so the submitted report carries
   * the corrected name.
   */
  useEffect(() => {
    if (!locationDetails && Object.keys(editedDetails).length === 0) return;
    const merged = { ...locationDetails, ...editedDetails };
    const parts = [
      [merged.building, merged.street].filter(Boolean).join(" "),
      merged.area,
      merged.city,
      merged.state,
      merged.postcode,
      merged.country,
    ].filter(Boolean);
    if (parts.length > 0) {
      userTypedRef.current = false;
      setLocation(parts.join(", "));
    }
    // Only run when the user actively edits — not on every geocode refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editedDetails]);

  /** Pin a chosen suggestion to the map and close the dropdown. */
  const handleSelectSuggestion = (s: ForwardGeocodeResult) => {
    removeCurrentLocationMarker();
    userTypedRef.current = false;
    if (!isValidCoordinatePair(s.lat, s.lng)) {
      setLocationCoords(null);
      return;
    }
    setLocation(s.displayName);
    setLocationCoords({ lat: s.lat, lng: s.lng });
    setLocationSuggestions([]);
    setShowSuggestions(false);
    setIsAutocompleting(false);
    setHighlightedSuggestion(-1);
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [s.lng, s.lat],
        zoom: 17,
        speed: 1.2,
        curve: 1.4,
        essential: true,
      });
      animateMarkerTo(s.lng, s.lat);
    }
    // Verify the result is within a reasonable distance of the typed locality
    // bias (default Hosur). Warn the user if it's clearly far away.
    if (HOSUR_BIAS.center) {
      const distKm = haversineKm(HOSUR_BIAS.center, { lat: s.lat, lng: s.lng });
      if (distKm > 30) {
        toast({
          title: "Far from Hosur locality",
          description: `Selected place is ~${distKm.toFixed(0)} km from Hosur. Tap the map to fine-tune if this isn't right.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: t("locationCaptured"),
          description: "Map centered on selected address.",
        });
      }
    } else {
      toast({
        title: t("locationCaptured"),
        description: "Map centered on selected address.",
      });
    }
  };

  /** Live-preview pan/zoom while user arrows through dropdown suggestions. */
  const previewSuggestion = (s: ForwardGeocodeResult) => {
    if (!mapRef.current) return;
    if (!isValidCoordinatePair(s.lat, s.lng)) {
      setLocationCoords(null);
      return;
    }
    setLocationCoords({ lat: s.lat, lng: s.lng });
    mapRef.current.flyTo({
      center: [s.lng, s.lat],
      zoom: 15,
      speed: 1.5,
      essential: true,
    });
    animateMarkerTo(s.lng, s.lat);
  };

  /** Manual zoom controls layered on the map. */
  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();

  const analyzeImage = useCallback(async (imageFile?: File | null): Promise<AnalysisResult | null> => {
    setIsAnalyzing(true);
    
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error("Please sign in to analyze a report.");

      let publicUrl: string | null = null;
      if (imageFile) {
        const fileExt = imageFile.name.split(".").pop();
        const fileName = `${authUser.id}/${crypto.randomUUID()}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("civic-reports")
          .upload(fileName, imageFile);

        if (uploadError) throw uploadError;

        const { data: signed, error: signedError } = await supabase.storage
          .from("civic-reports")
          .createSignedUrl(fileName, 600);
        if (signedError || !signed?.signedUrl) throw signedError ?? new Error("Could not read uploaded image.");
        publicUrl = signed.signedUrl;
      }

      const locationData = locationCoords
        ? { ...locationCoords, address: location }
        : location
        ? { address: location }
        : null;

      const { data, error } = await supabase.functions.invoke("analyze-civic-issue", {
        body: {
          imageUrl: publicUrl,
          description: description || null,
          locationData,
        },
      });

      if (error) throw error;
      if (!data || typeof data !== "object") {
        throw new Error("Invalid response from the AI analysis service.");
      }
      if ("error" in data && data.error) {
        throw new Error(String((data as { error?: unknown }).error));
      }

      const result = data as AnalysisResult;
      if (typeof result.is_valid_civic_issue !== "boolean") {
        throw new Error("AI analysis returned an unexpected result.");
      }

      if (!result.is_valid_civic_issue) {
        setIsInvalidImage(true);
        toast({
          title: "Invalid Civic Issue",
          description: result.validation_message || "The AI determined this image is not a valid civic issue.",
          variant: "destructive",
        });
        setAnalysisResult(null);
        return null;
      } else {
        setIsInvalidImage(false);
        setAnalysisResult(result);
        
        if (!description && result.short_description) {
          setDescription(result.short_description);
        }
        
        // PHASE 1: Check for duplicates after analysis
        setIsCheckingDuplicates(true);
        let dupResult = null;
        try {
          dupResult = await checkForDuplicates(
            result.issue_category,
            result.short_description,
            locationCoords?.lat,
            locationCoords?.lng
          );
          setDuplicateCheckResult(dupResult);
        } catch (dupError) {
          console.warn("Duplicate check failed:", dupError);
          setDuplicateCheckResult(null);
        } finally {
          setIsCheckingDuplicates(false);
        }
        
        // PHASE 2: Calculate priority based on analysis and duplicates
        try {
          const priority = await calculatePriorityScore(
            result.issue_category,
            result.severity,
            result.ai_confidence_score,
            dupResult?.matches,
            undefined // location popularity - could be added later
          );
          setPriorityDetails(priority);
        } catch (priorityError) {
          console.warn("Priority calculation failed:", priorityError);
        }
        
        toast({
          title: t("aiAnalysis"),
          description: `${t("detectedObjects")}: ${result.issue_category}`,
        });
        return result;
      }
    } catch (error) {
      console.error("Error analyzing image:", error);
      toast({
        title: "Analysis Failed",
        description: "Failed to analyze the image. Please try again.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, [description, location, locationCoords, t, toast]);

  const handleReanalyze = async () => {
    if (!image && !description) {
      toast({
        title: "Missing Information",
        description: "Please provide either an image or description",
        variant: "destructive",
      });
      return;
    }

    if (analysisResult) {
      setPreviousAnalysisResult(analysisResult);
    }

    const newResult = await analyzeImage(image || null);
    if (newResult) {
      setShowComparison(true);
    }
  };

  const handleVoiceTranscript = (text: string) => {
    setDescription((prev) => {
      const newText = prev ? `${prev} ${text}` : text;
      return newText;
    });
    toast({
      title: "Voice Input Added",
      description: "Your speech has been added to the description",
    });
  };

  const dismissComparison = () => {
    setShowComparison(false);
    setPreviousAnalysisResult(null);
  };

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith("image/")) {
        setImage(file);
        setIsInvalidImage(false);
        setAnalysisResult(null);
        const reader = new FileReader();
        reader.onloadend = () => setImagePreview(reader.result as string);
        reader.readAsDataURL(file);
        toast({ title: t("analyzing"), description: t("analyzing") });
        await analyzeImage(file);
      } else {
        toast({ title: "Invalid File", description: "Please drop an image file.", variant: "destructive" });
      }
    }
  }, [analyzeImage, t, toast]);

  const handleConfirmSubmit = () => {
    setShowConfirmDialog(true);
  };

  const uploadFileWithProgress = (file: File, fileName: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const runUpload = async () => {
        try {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const { data: { session } } = await supabase.auth.getSession();
          const accessToken = session?.access_token;
          if (!accessToken) {
            reject(new Error("You must be signed in to upload an image."));
            return;
          }

          const xhr = new XMLHttpRequest();
          xhr.open("POST", `${supabaseUrl}/storage/v1/object/civic-reports/${encodeURIComponent(fileName)}`, true);
          xhr.setRequestHeader("apikey", import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
          xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
          xhr.setRequestHeader("x-upsert", "true");

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              setUploadProgress(Math.round((event.loaded / event.total) * 100));
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Upload failed (${xhr.status})`));
            }
          };

          xhr.onerror = () => reject(new Error("Upload error"));
          xhr.send(file);
        } catch (error) {
          reject(error);
        }
      };

      void runUpload();
    });
  };

  const handleSaveReport = async () => {
    setShowConfirmDialog(false);
    if (!analysisResult || !analysisResult.is_valid_civic_issue) {
      toast({
        title: "Cannot Submit",
        description: "Please upload a valid civic issue image",
        variant: "destructive",
      });
      return;
    }

    // Offline: save locally
    if (!navigator.onLine) {
      saveOffline({
        imageDataUrl: imagePreview || null,
        imageName: image?.name || null,
        description,
        location,
        locationCoords,
        analysisResult: analysisResult as unknown as Record<string, unknown>,
      });
      navigate("/dashboard");
      return;
    }

    setIsSaving(true);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast({
          title: "Authentication Required",
          description: "Please sign in to save your report",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      let imageUrl = "";
      if (image) {
        try {
          const fileExt = image.name.split(".").pop();
          const fileName = `${user.id}/${crypto.randomUUID()}.${fileExt}`;
          
          console.log("[REPORT SUBMISSION] Starting image upload:", fileName);
          await uploadFileWithProgress(image, fileName);
          console.log("[REPORT SUBMISSION] Image uploaded successfully:", fileName);

          imageUrl = fileName;
        } catch (uploadErr) {
          console.error("[REPORT SUBMISSION] Image upload failed:", {
            fileName: image?.name,
            error: uploadErr instanceof Error ? uploadErr.message : String(uploadErr),
          });
          throw uploadErr;
        }
      }

      setIsUploading(false);
      setUploadProgress(100);

      const locationData = locationCoords
        ? { ...locationCoords, address: location }
        : location
        ? { address: location }
        : null;

      // Insert report first to get report ID for routing
      const { data: insertedReport, error: insertError } = await supabase
        .from("civic_reports")
        .insert({
          user_id: user.id,
          image_url: imageUrl,
          user_description: description,
          location_data: locationData,
          issue_category: analysisResult.issue_category,
          severity: analysisResult.severity,
          priority_level: analysisResult.priority_level,
          short_description: analysisResult.short_description,
          suggested_department: analysisResult.suggested_department,
          context_analysis: analysisResult.context_analysis,
          estimated_resolution_time: analysisResult.estimated_resolution_time,
          recommended_action: analysisResult.recommended_action,
          ai_confidence_score: analysisResult.ai_confidence_score,
          // NOTE: detected_objects is NOT a database field, only in AI response
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("[REPORT SUBMISSION] civic_reports INSERT failed:", {
          message: insertError.message,
          code: (insertError as any).code,
          details: (insertError as any).details,
          hint: (insertError as any).hint,
        });
        throw insertError;
      }
      if (!insertedReport) {
        const err = new Error("Failed to create report - no ID returned");
        console.error("[REPORT SUBMISSION] Report creation returned empty:", err);
        throw err;
      }

      const reportId = insertedReport.id;
      console.log("[REPORT SUBMISSION] Report created successfully:", reportId);

      // PHASE 2: Route report to department via backend
      setIsRouting(true);
      let routingSuccess = false;
      try {
        console.log("[REPORT SUBMISSION] Starting backend routing...");
        const routingResult = await routeReportToDepartment(
          reportId,
          analysisResult.issue_category,
          analysisResult.ai_confidence_score,
          analysisResult.suggested_department
        );

        if (!routingResult.success) {
          console.warn("[REPORT SUBMISSION] Routing returned failure status:", routingResult);
          // Routing failed but report was created - this is not a fatal error
          // The report will be in the database and admin can review it
        } else {
          console.log("[REPORT SUBMISSION] Routing succeeded:", routingResult);
          routingSuccess = true;
        }

        if (routingResult.success && routingResult.departmentId) {
          setAssignedDepartmentId(routingResult.departmentId);
          setAssignedDepartmentName(routingResult.departmentName);
        }
      } catch (routingError) {
        // Routing failed - but report was already successfully created
        // This is non-fatal; the report is in the database
        console.error("[REPORT SUBMISSION] Routing failed (non-fatal):", {
          error: routingError instanceof Error ? routingError.message : String(routingError),
          reportId,
        });
        // Don't throw - let the report be saved despite routing failure
      } finally {
        setIsRouting(false);
      }

      toast({
        title: t("submitReport"),
        description: "Report submitted successfully",
      });

      navigate("/dashboard");
    } catch (error) {
      // Comprehensive error logging for debugging
      console.error("[REPORT SUBMISSION] Fatal error:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        type: error instanceof Error ? error.constructor.name : typeof error,
      });

      // Show user-friendly error message based on error type
      let errorTitle = "Save Failed";
      let errorDescription = "Failed to save the report. Please try again.";

      if (error instanceof Error) {
        if (error.message.includes("civic_reports")) {
          errorTitle = "Database Error";
          errorDescription = "Failed to save report to database. Please check your connection and try again.";
        } else if (error.message.includes("Authentication")) {
          errorTitle = "Not Authenticated";
          errorDescription = "Please sign in to submit a report.";
        } else if (error.message.includes("upload")) {
          errorTitle = "Upload Error";
          errorDescription = "Failed to upload image. Please check file size and try again.";
        }
      }

      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <>
      {showLiveCamera && (
        <LiveCamera
          onCapture={handleCameraCapture}
          onClose={() => setShowLiveCamera(false)}
        />
      )}
      {showImageEditor && rawImageSrc && (
        <ImageEditor
          imageSrc={rawImageSrc}
          onConfirm={handleEditorConfirm}
          onCancel={() => setShowImageEditor(false)}
        />
      )}
    <AppLayout overlay="medium">
      <div className="py-6 md:py-8 px-4">
        <div className="w-full mx-auto">
          {/* Header */}
          <div className="text-center mb-6 md:mb-12">
            <div className="inline-block bg-primary/10 text-primary px-3 py-1.5 rounded-full text-xs font-semibold mb-3">
              {t("reportAnIssueTag")}
            </div>
            <h1 className="text-2xl md:text-5xl font-bold text-foreground mb-2 md:mb-4">
              {t("reportTitle")}
            </h1>
            <p className="text-sm md:text-xl text-muted-foreground max-w-2xl mx-auto">
              {t("heroDescription")}
            </p>
          </div>

          {/* Offline Banner */}
          {!isOnline && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-3">
              <WifiOff className="w-5 h-5 text-destructive flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-sm text-destructive">You're Offline</p>
                <p className="text-xs text-muted-foreground">Reports will be saved locally and submitted when you're back online.</p>
              </div>
            </div>
          )}

          {/* Pending Offline Reports */}
          {pendingCount > 0 && isOnline && (
            <div className="mb-4 p-3 bg-accent/50 border border-accent rounded-lg flex items-center gap-3">
              <CloudUpload className="w-5 h-5 text-primary flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-sm">{pendingCount} saved report(s) pending</p>
                <p className="text-xs text-muted-foreground">You're back online. Submit your saved reports now.</p>
              </div>
              <Button size="sm" onClick={syncAll} disabled={isSyncing}>
                {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sync Now"}
              </Button>
            </div>
          )}

          {/* Progress Indicators */}
          <div className="grid grid-cols-3 gap-2 md:gap-4 mb-6 md:mb-8">
            <Card className={`border-2 rounded-2xl ${!analysisResult ? 'border-primary bg-primary/5' : 'border-border'}`}>
              <CardContent className="p-3 md:pt-6 md:pb-4">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${!analysisResult ? 'bg-primary' : 'bg-muted'}`}>
                    <Camera className={`w-4 h-4 md:w-5 md:h-5 ${!analysisResult ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="min-w-0">
                    <h3 className={`font-semibold text-xs md:text-sm truncate ${!analysisResult ? '' : 'text-muted-foreground'}`}>1. {t("capturePhoto")}</h3>
                    <p className="text-[10px] md:text-sm text-muted-foreground hidden md:block">{t("uploadPhoto")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className={`border-2 rounded-2xl ${isAnalyzing ? 'border-primary bg-primary/5' : 'border-border'}`}>
              <CardContent className="p-3 md:pt-6 md:pb-4">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isAnalyzing ? 'bg-primary' : 'bg-muted'}`}>
                    <Zap className={`w-4 h-4 md:w-5 md:h-5 ${isAnalyzing ? 'text-primary-foreground animate-pulse' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="min-w-0">
                    <h3 className={`font-semibold text-xs md:text-sm truncate ${isAnalyzing ? '' : 'text-muted-foreground'}`}>2. {t("aiAnalysis")}</h3>
                    <p className="text-[10px] md:text-sm text-muted-foreground hidden md:block">{isAnalyzing ? t("analyzing") : t("aiAnalysis")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className={`border-2 rounded-2xl ${analysisResult?.is_valid_civic_issue ? 'border-primary bg-primary/5' : 'border-border'}`}>
              <CardContent className="p-3 md:pt-6 md:pb-4">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${analysisResult?.is_valid_civic_issue ? 'bg-primary' : 'bg-muted'}`}>
                    <FileText className={`w-4 h-4 md:w-5 md:h-5 ${analysisResult?.is_valid_civic_issue ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="min-w-0">
                    <h3 className={`font-semibold text-xs md:text-sm truncate ${analysisResult?.is_valid_civic_issue ? '' : 'text-muted-foreground'}`}>3. {t("confirmSubmit")}</h3>
                    <p className="text-[10px] md:text-sm text-muted-foreground hidden md:block">{t("submitReport")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Invalid Image Warning */}
          {isInvalidImage && (
            <Card className="mb-6 border-2 border-destructive bg-destructive/5">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-destructive mb-1">{t("invalidImageWarning")}</h3>
                    <p className="text-sm text-muted-foreground">
                      {analysisResult?.validation_message || t("invalidImageWarning")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="mb-4 md:mb-6 border-2 shadow-xl rounded-2xl">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5 p-4 md:p-6">
              <CardTitle className="text-xl md:text-3xl flex items-center gap-2 md:gap-3">
                <Camera className="w-6 h-6 md:w-8 md:h-8 text-primary" />
                {t("reportTitle")}
              </CardTitle>
              <CardDescription className="text-sm md:text-base">
                {t("dragDropPhoto")}
              </CardDescription>
            </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div>
              <Label htmlFor="image" className="text-base font-semibold flex items-center gap-2">
                <Camera className="w-4 h-4" />
                {t("uploadPhoto")}
              </Label>
              <p className="text-sm text-muted-foreground mt-1 mb-2">
                {t("clearPhotoHelp")}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-4">
                {/* Capture Photo (Camera) - opens live camera */}
                <div
                  className="relative border-2 border-dashed border-border rounded-lg p-6 hover:border-primary transition-colors bg-muted/20 cursor-pointer"
                  onClick={() => {
                    if (!isAnalyzing) {
                      setShowLiveCamera(true);
                    }
                  }}
                >
                  <div className="text-center">
                    <Camera className="w-10 h-10 text-primary mx-auto mb-2" />
                    <p className="text-sm font-medium">{t("capturePhotoCamera")}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("useYourCamera")}
                    </p>
                  </div>
                </div>

                {/* Upload Photo (Gallery/Files/Drive) - opens file picker */}
                <div
                  className={`relative border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer ${
                    isDragging
                      ? "border-primary bg-primary/10 scale-[1.02]"
                      : "border-border hover:border-primary bg-muted/20"
                  }`}
                  onClick={() => {
                    if (!isAnalyzing) {
                      const uploadInput = document.getElementById('image-upload') as HTMLInputElement;
                      if (uploadInput) {
                        uploadInput.value = '';
                        uploadInput.click();
                      }
                    }
                  }}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    disabled={isAnalyzing}
                    className="hidden"
                  />
                  <div className="text-center">
                    <Upload className={`w-10 h-10 mx-auto mb-2 ${isDragging ? "text-primary animate-bounce" : "text-accent"}`} />
                    <p className="text-sm font-medium">{isDragging ? "Drop here!" : t("uploadPhotoGallery")}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("phoneFilesGallery")}
                    </p>
                  </div>
                </div>
              </div>
              {image && (
                <div className="flex items-center justify-between mt-2">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    {image.name}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowLiveCamera(true)}
                      disabled={isAnalyzing}
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1" />
                      Retake
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setImage(null);
                        setImagePreview("");
                        setAnalysisResult(null);
                        setIsInvalidImage(false);
                      }}
                      disabled={isAnalyzing}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="w-3.5 h-3.5 mr-1" />
                      Remove
                    </Button>
                  </div>
                </div>
              )}
              {imagePreview && (
                <div className="mt-4 relative">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className={`rounded-lg max-h-64 w-full object-cover transition-opacity ${isAnalyzing ? 'opacity-50' : ''}`}
                  />
                  {isAnalyzing && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 rounded-lg">
                      <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
                      <p className="text-sm font-medium text-primary">Analyzing image...</p>
                    </div>
                  )}
                </div>
              )}
              {isAnalyzing && !imagePreview && (
                <div className="mt-4 space-y-3">
                  <Skeleton className="h-64 w-full rounded-lg" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-24 rounded-full" />
                    <Skeleton className="h-6 w-32 rounded-full" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-3/4" />
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="description" className="text-base font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Issue Description
                {analysisResult?.is_valid_civic_issue && (
                  <span className="text-xs font-normal text-muted-foreground">(Auto-filled by AI)</span>
                )}
              </Label>
              <p className="text-sm text-muted-foreground mt-1 mb-2">
                AI has detected the issue. You can modify the description if needed or use voice input.
              </p>
              <div className="flex gap-2">
                <Textarea
                  id="description"
                  placeholder="Describe the civic issue you've encountered..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isAnalyzing}
                  className="min-h-32 flex-1"
                />
                <div className="flex flex-col gap-2">
                  <VoiceInput
                    onTranscript={handleVoiceTranscript}
                    disabled={isAnalyzing}
                  />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
                {analysisResult?.detected_objects && analysisResult.detected_objects.length > 0 && (
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-xs text-muted-foreground">Detected:</span>
                    {analysisResult.detected_objects.map((obj, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {obj}
                      </Badge>
                    ))}
                  </div>
                )}
                {image && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleReanalyze}
                    disabled={isAnalyzing}
                    className="ml-auto"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Re-analyzing...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        Re-analyze
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>

            {/* Location Section with Map */}
            <div>
              <Label className="text-base font-semibold flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Location
              </Label>
              <p className="text-sm text-muted-foreground mt-1 mb-2">
                Type an address, use your current location, or click on the map.
              </p>

              {/* Manual address entry + search */}
              <div className="flex flex-col sm:flex-row gap-2 mb-2">
                <div className="flex-1 relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="location"
                    placeholder="Type an address, area, or landmark…"
                    value={location}
                    onChange={(e) => {
                      userTypedRef.current = true;
                      setLocation(e.target.value);
                      setShowSuggestions(true);
                      setHighlightedSuggestion(-1);
                    }}
                    onKeyDown={(e) => {
                      const list = locationSuggestions;
                      if (e.key === "ArrowDown" && list.length > 0) {
                        e.preventDefault();
                        setShowSuggestions(true);
                        const next = highlightedSuggestion < list.length - 1 ? highlightedSuggestion + 1 : 0;
                        setHighlightedSuggestion(next);
                        previewSuggestion(list[next]);
                        return;
                      }
                      if (e.key === "ArrowUp" && list.length > 0) {
                        e.preventDefault();
                        setShowSuggestions(true);
                        const next = highlightedSuggestion <= 0 ? list.length - 1 : highlightedSuggestion - 1;
                        setHighlightedSuggestion(next);
                        previewSuggestion(list[next]);
                        return;
                      }
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (highlightedSuggestion >= 0 && list[highlightedSuggestion]) {
                          handleSelectSuggestion(list[highlightedSuggestion]);
                          return;
                        }
                        setShowSuggestions(false);
                        handleSearchLocation();
                      }
                      if (e.key === "Escape") setShowSuggestions(false);
                    }}
                    onFocus={() => {
                      if (locationSuggestions.length > 0) setShowSuggestions(true);
                    }}
                    onBlur={() => {
                      // Delay so click on a suggestion can register first.
                      setTimeout(() => setShowSuggestions(false), 150);
                    }}
                    autoComplete="off"
                    disabled={isAnalyzing}
                    maxLength={250}
                    className="pl-9 pr-9"
                  />
                  {isAutocompleting && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
                  )}
                  {showSuggestions && locationSuggestions.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 mt-1 bg-popover text-popover-foreground border rounded-md shadow-lg max-h-64 overflow-y-auto">
                      {locationSuggestions.map((s, i) => (
                        <button
                          key={`${s.lat}-${s.lng}-${i}`}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectSuggestion(s);
                          }}
                          onMouseEnter={() => setHighlightedSuggestion(i)}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-start gap-2 border-b last:border-b-0 ${i === highlightedSuggestion ? "bg-accent text-accent-foreground" : ""}`}
                        >
                          <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
                          <span className="flex flex-col min-w-0">
                            <span className="font-medium truncate">
                              {s.primaryName || s.displayName.split(",")[0]}
                            </span>
                            {s.secondaryName && (
                              <span className="text-xs text-muted-foreground line-clamp-1">
                                {s.secondaryName}
                              </span>
                            )}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSearchLocation}
                  disabled={isSearchingLocation || isAnalyzing || !location.trim()}
                  className="flex-shrink-0"
                >
                  {isSearchingLocation ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4 mr-2" />
                  )}
                  Search
                </Button>
              </div>
              {isAutocompleting && (
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Searching location…
                </p>
              )}

              <div className="flex flex-wrap gap-2 mb-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={getCurrentLocation}
                  disabled={isGettingLocation || isAnalyzing}
                  className="flex-shrink-0"
                >
                  {isGettingLocation ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Locate className="w-4 h-4 mr-2" />
                  )}
                  Use Current Location
                </Button>
                <p className="text-xs text-muted-foreground self-center">
                  Or click anywhere on the map below to drop a pin.
                </p>
              </div>

              {/* MapLibre Map */}
              <Card className="overflow-hidden relative">
                <div
                  ref={mapContainerRef}
                  className="w-full h-[300px]"
                  style={{ minHeight: "300px" }}
                />
                {/* On-screen zoom controls (in addition to MapLibre's default
                    NavigationControl) — bigger touch targets for mobile users
                    while picking a suggestion. */}
                <div className="absolute bottom-3 right-3 flex flex-col gap-1.5 z-10">
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    onClick={handleZoomIn}
                    aria-label="Zoom in"
                    className="h-9 w-9 shadow-md rounded-xl"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    onClick={handleZoomOut}
                    aria-label="Zoom out"
                    className="h-9 w-9 shadow-md rounded-xl"
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
              {locationCoords && (
                <div className="mt-2 rounded-lg border bg-muted/40 p-3 space-y-2">
                  <p className="text-xs font-medium text-foreground">
                    Address details (editable)
                  </p>
                  {locationDetails || Object.keys(editedDetails).length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {([
                        ["building", "Building / House"],
                        ["street", "Street"],
                        ["area", "Area / Neighbourhood"],
                        ["city", "City / Town"],
                        ["state", "State"],
                        ["postcode", "PIN code"],
                      ] as const).map(([key, label]) => {
                        const value =
                          editedDetails[key] !== undefined
                            ? (editedDetails[key] as string)
                            : (locationDetails?.[key] as string | undefined) ?? "";
                        return (
                          <div key={key} className="space-y-1">
                            <label className="text-[10px] text-muted-foreground">
                              {label}
                            </label>
                            <Input
                              value={value}
                              onChange={(e) =>
                                setEditedDetails((prev) => ({
                                  ...prev,
                                  [key]: e.target.value,
                                }))
                              }
                              placeholder={label}
                              className="h-8 text-sm"
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">
                      Resolving address for {locationCoords.lat.toFixed(6)},{" "}
                      {locationCoords.lng.toFixed(6)}…
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    Coords: {locationCoords.lat.toFixed(6)},{" "}
                    {locationCoords.lng.toFixed(6)} · drag the map pin to fine-tune.
                  </p>
                </div>
              )}
            </div>

            {analysisResult && !analysisResult.is_valid_civic_issue && (
              <Button
                onClick={handleReanalyze}
                disabled={isAnalyzing || !image}
                variant="outline"
                className="w-full"
                size="lg"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    <span className="text-lg">Re-analyzing...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5 mr-2" />
                    <span className="text-lg">Try Different Photo</span>
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>

        {showComparison && previousAnalysisResult && analysisResult && (
          <AnalysisComparisonView
            previousResult={previousAnalysisResult}
            currentResult={analysisResult}
            onDismiss={dismissComparison}
          />
        )}

        {analysisResult && analysisResult.is_valid_civic_issue && (
          <>
            <AnalysisResults result={analysisResult} onUpdate={(updated) => setAnalysisResult(updated)} />
            <div className="mt-6">
              <Card className="border-2 border-primary/20 bg-primary/5">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-start gap-3 p-4 bg-background/50 rounded-lg border">
                    <AlertCircle className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <h4 className="font-semibold mb-1">Please Confirm Details</h4>
                      <p className="text-sm text-muted-foreground">
                        Review the AI-detected information above. You can edit the description if needed before submitting.
                      </p>
                    </div>
                  </div>
                  {isUploading && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Uploading image...</span>
                        <span className="font-medium text-primary">{uploadProgress}%</span>
                      </div>
                      <Progress value={uploadProgress} className="h-2" />
                    </div>
                  )}
                  <Button onClick={handleConfirmSubmit} disabled={isSaving || isUploading} size="lg" className="w-full">
                    {isSaving ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        <span className="text-lg">{isUploading ? `Uploading ${uploadProgress}%...` : "Saving Report..."}</span>
                      </>
                    ) : !isOnline ? (
                      <>
                        <WifiOff className="w-5 h-5 mr-2" />
                        <span className="text-lg">Save Offline</span>
                      </>
                    ) : (
                      <>
                        <FileText className="w-5 h-5 mr-2" />
                        <span className="text-lg">Confirm & Submit Report</span>
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Confirmation Dialog */}
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-primary" />
                Confirm Report Submission
              </DialogTitle>
              <DialogDescription>
                Review the details below before submitting your report.
              </DialogDescription>
            </DialogHeader>
            {analysisResult && (
              <div className="space-y-3 text-sm">
                {imagePreview && (
                  <img src={imagePreview} alt="Report" className="rounded-lg max-h-40 w-full object-cover" />
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2 rounded bg-muted/50">
                    <p className="text-muted-foreground text-xs">Category</p>
                    <p className="font-medium">{analysisResult.issue_category}</p>
                  </div>
                  <div className="p-2 rounded bg-muted/50">
                    <p className="text-muted-foreground text-xs">Severity</p>
                    <p className="font-medium">{analysisResult.severity}</p>
                  </div>
                  <div className="p-2 rounded bg-muted/50">
                    <p className="text-muted-foreground text-xs">Priority</p>
                    <p className="font-medium">{analysisResult.priority_level}</p>
                  </div>
                  <div className="p-2 rounded bg-muted/50">
                    <p className="text-muted-foreground text-xs">Department</p>
                    <p className="font-medium">{analysisResult.suggested_department}</p>
                  </div>
                  <div className="p-2 rounded bg-muted/50">
                    <p className="text-muted-foreground text-xs">ETA</p>
                    <p className="font-medium">{analysisResult.estimated_resolution_time}</p>
                  </div>
                  <div className="p-2 rounded bg-muted/50">
                    <p className="text-muted-foreground text-xs">AI Confidence</p>
                    <p className="font-medium">{analysisResult.ai_confidence_score}%</p>
                  </div>
                </div>
                <div className="p-2 rounded bg-muted/50">
                  <p className="text-muted-foreground text-xs">Description</p>
                  <p className="font-medium">{description || analysisResult.short_description}</p>
                </div>
                {location && (
                  <div className="p-2 rounded bg-muted/50">
                    <p className="text-muted-foreground text-xs">Location</p>
                    <p className="font-medium">{location}</p>
                  </div>
                )}
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
                Go Back & Edit
              </Button>
              <Button onClick={handleSaveReport} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Report"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>
    </AppLayout>
    </>
  );
};

export default Report;