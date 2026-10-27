const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const IMAGE_TIMEOUT_MS = 15_000;
const PROVIDER_TIMEOUT_MS = 90_000;
const SUPPORTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/pjpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/avif",
  "image/svg+xml",
];

interface AnalyzeRequest {
  imageUrl?: string | null;
  description?: string | null;
  locationData?: Record<string, unknown> | null;
}

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
  detected_objects: string[];
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const createJsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalizeString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const parseAnalysisResult = (value: unknown): AnalysisResult | null => {
  if (!isObject(value)) return null;

  const isBool = typeof value.is_valid_civic_issue === "boolean";
  const isString = (key: string) => typeof (value as Record<string, unknown>)[key] === "string";
  const isNumber = typeof (value as Record<string, unknown>).ai_confidence_score === "number";
  const detectedObjects = (value as Record<string, unknown>).detected_objects;

  if (
    !isBool ||
    !isString("validation_message") ||
    !isString("issue_category") ||
    !isString("severity") ||
    !isString("priority_level") ||
    !isString("short_description") ||
    !isString("suggested_department") ||
    !isString("context_analysis") ||
    !isString("estimated_resolution_time") ||
    !isString("recommended_action") ||
    !isNumber ||
    !Array.isArray(detectedObjects) ||
    !detectedObjects.every((item) => typeof item === "string")
  ) {
    return null;
  }

  return value as unknown as AnalysisResult;
};

const extractJsonObject = (text: string): string | null => {
  const cleaned = text.replace(/```(?:json)?\s*/gi, "").replace(/\s*```/g, "").trim();
  const firstBrace = cleaned.indexOf("{");
  if (firstBrace === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = firstBrace; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === "{") depth++;
      if (char === "}") {
        depth--;
        if (depth === 0) {
          return cleaned.slice(firstBrace, i + 1);
        }
      }
    }
  }

  return null;
};

const parseProviderResult = async (data: unknown): Promise<AnalysisResult | null> => {
  const directResult = parseAnalysisResult(data);
  if (directResult) {
    return directResult;
  }

  if (!isObject(data)) return null;

  const dataObj = data as Record<string, unknown>;
  const choices = Array.isArray(dataObj.choices) ? dataObj.choices : [];
  const output = dataObj.output;
  const maybeText = (): string | null => {
    if (choices.length > 0) {
      const first = choices[0] as Record<string, unknown>;
      const message = first.message;
      if (isObject(message) && typeof message.content === "string") return message.content;
      if (typeof first.text === "string") return first.text;
      const delta = first.delta;
      if (isObject(delta) && typeof delta.content === "string") return delta.content;
    }

    if (Array.isArray(output) && output.length > 0) {
      const first = output[0] as Record<string, unknown>;
      if (typeof first === "string") return first;
      if (Array.isArray(first.content)) {
        const textPart = first.content.find(
          (item) => isObject(item) && typeof (item as Record<string, unknown>).text === "string"
        ) as Record<string, unknown> | undefined;
        if (textPart) return textPart.text as string;
      }
    }

    const outputText = dataObj.output_text;
    if (typeof outputText === "string") {
      return outputText;
    }

    const text = dataObj.text;
    if (typeof text === "string") {
      return text;
    }

    const candidates = Array.isArray(dataObj.candidates) ? dataObj.candidates : [];
    if (candidates.length > 0) {
      const firstCandidate = candidates[0] as Record<string, unknown>;
      const content = firstCandidate.content;
      if (isObject(content) && Array.isArray(content.parts)) {
        const mergedText = content.parts
          .map((part) => {
            if (isObject(part) && typeof (part as Record<string, unknown>).text === "string") {
              return (part as Record<string, unknown>).text as string;
            }
            return "";
          })
          .join("");
        if (mergedText) return mergedText;
      }
    }

    return null;
  };

  const text = maybeText();
  if (!text) return null;

  const rawJson = extractJsonObject(text);
  if (!rawJson) return null;

  try {
    const parsed = JSON.parse(rawJson);
    return parseAnalysisResult(parsed);
  } catch {
    return null;
  }
};

const fetchWithTimeout = async (resource: RequestInfo, options: RequestInit = {}, timeoutMs = PROVIDER_TIMEOUT_MS) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(resource, { signal: controller.signal, ...options });
  } finally {
    clearTimeout(id);
  }
};

const validateImageUrl = async (imageUrl: string) => {
  if (!imageUrl.trim()) {
    throw new Error("Image URL must be a non-empty string.");
  }

  const response = await fetchWithTimeout(imageUrl, { method: "GET", headers: { Accept: "image/*" } }, IMAGE_TIMEOUT_MS);
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Image not found at the provided URL.");
    }
    throw new Error(`Unable to fetch image from URL (${response.status}).`);
  }

  const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() || "";
  if (!SUPPORTED_IMAGE_TYPES.includes(contentType)) {
    throw new Error("Unsupported image format. Supported formats are JPEG, PNG, WebP, GIF, BMP, AVIF, and SVG.");
  }

  const buffer = await response.arrayBuffer();
  const size = buffer.byteLength;
  if (size === 0) {
    throw new Error("The provided image is empty or malformed.");
  }

  if (size > MAX_IMAGE_SIZE) {
    throw new Error("Image exceeds the maximum allowed size of 10 MB.");
  }

  return { contentType, size, buffer };
};

const encodeBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.byteLength; index++) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
};

const isGoogleApiKey = (value: string) => /^AIza[0-9A-Za-z_-]{35}$/.test(value);
const isGoogleBearerToken = (value: string) => /^(ya29\.|AQ\.)/.test(value);
const isGoogleGenerativeLanguageUrl = (value: string) =>
  value.includes("generativelanguage.googleapis.com") || value.includes("genai.googleapis.com");

const buildGeminiGenerateContentUrl = (baseUrl: string, model: string, apiKey: string) => {
  const trimmed = baseUrl.trim();
  const normalizedBase = trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
  const encodedModel = encodeURIComponent(model);
  const baseEndpoint = `${normalizedBase}/models/${encodedModel}:generateContent`;

  if (isGoogleGenerativeLanguageUrl(normalizedBase) && isGoogleApiKey(apiKey)) {
    return `${baseEndpoint}?key=${encodeURIComponent(apiKey)}`;
  }

  return baseEndpoint;
};

const buildProviderAuthHeaders = (apiKey: string, apiUrl: string) => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (isGoogleGenerativeLanguageUrl(apiUrl)) {
    headers["x-goog-api-key"] = apiKey;
    return headers;
  }

  headers.Authorization = `Bearer ${apiKey}`;
  return headers;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return createJsonResponse({ error: "Method not allowed. Use POST." }, 405);
  }

  let body: AnalyzeRequest;
  try {
    body = (await req.json()) as AnalyzeRequest;
  } catch {
    return createJsonResponse({ error: "Invalid JSON payload." }, 400);
  }

  const { imageUrl, description, locationData } = body;
  if (imageUrl != null && typeof imageUrl !== "string") {
    return createJsonResponse({ error: "imageUrl must be a string or null." }, 400);
  }
  if (description != null && typeof description !== "string") {
    return createJsonResponse({ error: "description must be a string or null." }, 400);
  }
  if (locationData != null && !isObject(locationData)) {
    return createJsonResponse({ error: "locationData must be an object or null." }, 400);
  }

  const apiUrl = Deno.env.get("AI_API_URL") || Deno.env.get("GEMINI_API_URL") || "https://generativelanguage.googleapis.com/v1beta";
  const apiKey = Deno.env.get("AI_API_KEY") || Deno.env.get("GEMINI_API_KEY");
  const model = Deno.env.get("AI_MODEL") || Deno.env.get("GEMINI_MODEL") || "gemini-2.0-flash";

  if (!apiKey) {
    console.error("AI analysis configuration missing", {
      apiUrl: Boolean(apiUrl),
      apiKey: Boolean(apiKey),
      model: Boolean(model),
    });
    return createJsonResponse({ error: "AI analysis is not configured on the server." }, 500);
  }

  let imageMetadata: { contentType: string; size: number; buffer: ArrayBuffer } | null = null;
  try {
    if (imageUrl) {
      imageMetadata = await validateImageUrl(imageUrl);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid image provided.";
    return createJsonResponse({ error: message }, 400);
  }

  const userPrompts: string[] = [];
  if (description) {
    userPrompts.push(`Description: ${description}`);
  }

  if (locationData) {
    userPrompts.push(`Location: ${JSON.stringify(locationData)}`);
  }

  if (imageUrl) {
    userPrompts.push(`Image URL: ${imageUrl}`);
    if (imageMetadata) {
      userPrompts.push(`Image MIME type: ${imageMetadata.contentType}`);
      userPrompts.push(`Image size (bytes): ${imageMetadata.size}`);
    }
  }

  if (userPrompts.length === 0) {
    return createJsonResponse(
      { error: "At least one of imageUrl, description, or locationData must be provided." },
      400
    );
  }

  console.log("Starting AI analysis for civic issue", { apiUrl, model, hasImage: Boolean(imageUrl) });

  const systemMessage = {
    role: "system",
    content: `You are an intelligent civic assistant integrated into a Crowdsourced Civic Issue Reporting and Resolution System.

Your goal is to analyze citizen-submitted reports and automatically detect civic issues from images and descriptions.

CRITICAL: First determine if the image/description represents a valid civic issue.

Return ONLY valid JSON (no markdown, no extra text) in this exact format:
{
  "is_valid_civic_issue": true/false,
  "validation_message": "string",
  "issue_category": "string",
  "severity": "string",
  "priority_level": "string",
  "short_description": "string",
  "suggested_department": "string",
  "context_analysis": "string",
  "estimated_resolution_time": "string",
  "recommended_action": "string",
  "ai_confidence_score": 0.95,
  "detected_objects": ["object1", "object2"]
}

Guidelines for Validation:
- is_valid_civic_issue: true only if image shows: potholes, broken infrastructure, garbage/waste, water leakage, damaged roads, broken street lights, public property damage, illegal dumping, drainage issues, graffiti, damaged footpaths, traffic issues
- is_valid_civic_issue: false if image shows: selfies, animals, random scenery, food, personal items, unrelated objects, unclear/blurry non-civic content
- validation_message: Clear message for users (e.g., "Valid civic issue detected" or "This photo does not appear to show a valid civic issue. Please upload a relevant image.")

Guidelines for Valid Issues:
- severity must be one of: "minor", "moderate", "critical"
- priority_level must be one of: "low", "medium", "high"
- issue_category examples: pothole, garbage overflow, broken streetlight, water leakage, tree fall, road blockage, drainage issue, damaged footpath, public property damage, illegal dumping, graffiti
- suggested_department examples: Public Works, Sanitation, Electrical, Water Supply, Parks and Trees, Traffic Management, Building Department
- ai_confidence_score must be between 0 and 1
- detected_objects: list specific objects/issues found in the image
- Be professional, concise, and action-ready`,
  };

  const promptText = userPrompts.join("\n\n");
  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          { text: `${systemMessage.content}\n\nRespond with valid JSON only.` },
          { text: promptText },
          ...(imageUrl && imageMetadata
            ? [
                {
                  inlineData: {
                    mimeType: imageMetadata.contentType,
                    data: encodeBase64(imageMetadata.buffer),
                  },
                },
              ]
            : []),
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  };

  const providerUrl = buildGeminiGenerateContentUrl(apiUrl, model, apiKey);
  const providerHeaders = buildProviderAuthHeaders(apiKey, apiUrl);

  let providerResponse: Response;
  try {
    providerResponse = await fetchWithTimeout(providerUrl, {
      method: "POST",
      headers: providerHeaders,
      body: JSON.stringify(requestBody),
    }, PROVIDER_TIMEOUT_MS);
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? "AI provider request timed out."
      : error instanceof Error
      ? error.message
      : "AI provider request failed.";
    console.error("AI provider request failed:", error);
    return createJsonResponse({ error: message }, 504);
  }

  const responseText = await providerResponse.text();
  let parsedProviderData: unknown = null;
  try {
    parsedProviderData = responseText ? JSON.parse(responseText) : null;
  } catch {
    parsedProviderData = responseText;
  }

  if (!providerResponse.ok) {
    console.error("AI provider returned non-OK status", {
      status: providerResponse.status,
      body: parsedProviderData,
    });

    const errorMessage = isObject(parsedProviderData)
      ? (() => {
          const providerObj = parsedProviderData as Record<string, unknown>;
          const errorField = providerObj.error;
          if (isObject(errorField) && typeof errorField.message === "string") return errorField.message;
          if (typeof errorField === "string") return errorField;
          if (typeof providerObj.message === "string") return providerObj.message;
          return JSON.stringify(providerObj);
        })()
      : typeof parsedProviderData === "string"
      ? parsedProviderData
      : "AI provider returned an error.";

    if (providerResponse.status === 400) {
      return createJsonResponse({ error: `AI request rejected: ${errorMessage}` }, 400);
    }
    if (providerResponse.status === 401) {
      return createJsonResponse({ error: "Invalid AI credentials. Please check your AI_API_KEY." }, 401);
    }
    if (providerResponse.status === 403) {
      return createJsonResponse({ error: "AI provider rejected the request. Check API access and permissions." }, 403);
    }
    if (providerResponse.status === 404) {
      return createJsonResponse({ error: `AI provider endpoint not found for model ${model}. Check AI_API_URL and AI_MODEL.` }, 404);
    }
    if (providerResponse.status === 429) {
      return createJsonResponse({ error: "Rate limit exceeded. Please try again later." }, 429);
    }
    if (providerResponse.status >= 500) {
      return createJsonResponse({ error: "AI provider is currently unavailable. Please try again later." }, 502);
    }

    return createJsonResponse({ error: `AI provider error: ${errorMessage}` }, 502);
  }

  const analysisResult = await parseProviderResult(parsedProviderData);
  if (!analysisResult) {
    console.error("Malformed AI response", {
      responseBody: parsedProviderData,
      responseText,
    });
    return createJsonResponse({ error: "AI returned an invalid analysis format." }, 502);
  }

  return createJsonResponse(analysisResult, 200);
});