import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of, BehaviorSubject, timer } from 'rxjs';
import { catchError, retryWhen, scan, finalize, map, switchMap, tap } from 'rxjs/operators';

export interface AiImageGenerationRequest {
  model: string;
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  numImages?: number;
  quality?: 'standard' | 'hd' | 'ultra';
  style?: string;
  [key: string]: unknown;
}

export interface AiImageGenerationResponse {
  images: string[];
  model: string;
  prompt: string;
  creditsUsed: number;
  remainingCredits: number;
  generationTime: number;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: Date;
}

export interface GenerationProgress {
  status: 'idle' | 'loading' | 'generating' | 'completed' | 'error';
  progress: number;
  message: string;
  error?: string;
}

export interface AiModel {
  id: string;
  name: string;
  description: string;
  maxWidth: number;
  maxHeight: number;
  creditCost: number;
  supportedFeatures: string[];
}

@Injectable({
  providedIn: 'root',
})
export class AiImageGenerationService {
  // Google Vertex AI Imagen configuration
  // TODO: Replace with your actual PROJECT_ID
  private projectId = 'xiaokproject-496407';
  private location = 'us-central1';
  private publisher = 'google';
  private modelName = 'imagegeneration@006';

  // API endpoint built via proxy (/api rewrites to Vertex AI base URL)
  private apiEndpoint: string;

  // Enable mock mode for demonstration when API is unavailable
  private useMockMode = false;

  private progressSubject = new BehaviorSubject<GenerationProgress>({
    status: 'idle',
    progress: 0,
    message: '',
  });

  public progress$ = this.progressSubject.asObservable();

  private rateLimitSubject = new BehaviorSubject<RateLimitInfo | null>(null);
  public rateLimit$ = this.rateLimitSubject.asObservable();

  private remainingCredits = 0;
  private currentModel: AiModel | null = null;

  constructor(private http: HttpClient) {
    // Auth is handled by proxy (proxy injects Bearer token)
    // Build the predict endpoint path for Vertex AI Imagen
    this.apiEndpoint = `/api/v1/projects/${this.projectId}/locations/${this.location}/publishers/${this.publisher}/models/${this.modelName}:predict`;
  }

  // Google Imagen models available via Vertex AI
  private models: AiModel[] = [
    {
      id: 'imagen-006',
      name: 'Imagen 3',
      description: 'Google Imagen 3 — state-of-the-art text-to-image generation with photorealism',
      maxWidth: 1536,
      maxHeight: 1536,
      creditCost: 1,
      supportedFeatures: ['negativePrompt', 'width', 'height', 'numImages'],
    },
    {
      id: 'imagen-005',
      name: 'Imagen 2',
      description: 'Previous generation Imagen model with solid image quality',
      maxWidth: 1024,
      maxHeight: 1024,
      creditCost: 1,
      supportedFeatures: ['negativePrompt', 'width', 'height', 'numImages'],
    },
  ];

  getSupportedModels(): AiModel[] {
    return [...this.models];
  }

  getModelById(modelId: string): AiModel | undefined {
    return this.models.find((m) => m.id === modelId);
  }

  generateImage(request: AiImageGenerationRequest): Observable<AiImageGenerationResponse> {
    // Validate request
    const model = this.getModelById(request.model);
    if (!model) {
      return throwError(() => new Error(`Unsupported model: ${request.model}`));
    }

    // Validate dimensions
    const width = request.width || 512;
    const height = request.height || 512;

    if (width > model.maxWidth || height > model.maxHeight) {
      return throwError(
        () =>
          new Error(
            `Dimensions exceed model limits. Max: ${model.maxWidth}x${model.maxHeight}, Requested: ${width}x${height}`
          )
      );
    }

    // Check credits
    if (this.remainingCredits > 0 && this.remainingCredits < model.creditCost) {
      return throwError(
        () =>
          new Error(
            `Insufficient credits. Required: ${model.creditCost}, Available: ${this.remainingCredits}`
          )
      );
    }

    this.currentModel = model;
    this.updateProgress('loading', 10, 'Initializing generation...');

    // Mock mode for demonstration when API is unavailable
    if (this.useMockMode) {
      return this.generateMockImage(request, model);
    }

    // Vertex AI Imagen request — auth injected by proxy
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
    });

    const numImages = request.numImages || 1;

    // Build Vertex AI predict request body
    const body = {
      instances: [
        {
          prompt: request.prompt,
        },
      ],
      parameters: {
        sampleCount: numImages,
        negativePrompt: request.negativePrompt || '',
        aspectRatio: width > height ? '4:3' : width < height ? '3:4' : '1:1',
      },
    };

    return this.http
      .post<{ predictions: Array<{ bytesBase64Encoded: string }> }>(this.apiEndpoint, body, {
        headers,
        responseType: 'json',
        reportProgress: true,
      })
      .pipe(
        map((response) => {
          const images = response.predictions
            ? response.predictions.map((p) => `data:image/png;base64,${p.bytesBase64Encoded}`)
            : [];

          return {
            images,
            model: request.model,
            prompt: request.prompt,
            creditsUsed: model.creditCost,
            remainingCredits: this.remainingCredits - model.creditCost,
            generationTime: Date.now(),
          };
        }),
        retryWhen(this.exponentialBackoff()),
        catchError(this.handleError.bind(this)),
        finalize(() => {
          this.updateProgress('completed', 100, 'Generation complete');
        })
      );
  }

  /**
   * Generate a mock image for demonstration purposes
   */
  private generateMockImage(
    request: AiImageGenerationRequest,
    model: AiModel
  ): Observable<AiImageGenerationResponse> {
    return new Observable((observer) => {
      let progress = 10;
      const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 90) progress = 90;

        const messages = [
          'Processing prompt...',
          'Generating image...',
          'Refining details...',
          'Finalizing...',
        ];
        const messageIndex = Math.min(Math.floor(progress / 30), messages.length - 1);

        this.updateProgress('generating', progress, messages[messageIndex]);
      }, 300);

      setTimeout(() => {
        clearInterval(interval);
        this.updateProgress('completed', 100, 'Generation complete');

        // Generate a mock base64 image using canvas
        const mockImage = this.createMockImage(request.width || 512, request.height || 512);

        observer.next({
          images: [mockImage],
          model: request.model,
          prompt: request.prompt,
          creditsUsed: model.creditCost,
          remainingCredits: this.remainingCredits - model.creditCost,
          generationTime: Date.now(),
        });
        observer.complete();
      }, 2000 + Math.random() * 2000);
    });
  }

  /**
   * Create a mock image using canvas
   */
  private createMockImage(width: number, height: number): string {
    // Create a simple gradient pattern as mock image
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // Create gradient background
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, '#667eea');
      gradient.addColorStop(0.5, '#764ba2');
      gradient.addColorStop(1, '#f093fb');

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Add some pattern
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      for (let i = 0; i < 20; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const size = Math.random() * 50 + 20;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Add text overlay
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('AI Generated', width / 2, height / 2 - 20);
      ctx.font = '16px Arial';
      ctx.fillText(`${width} × ${height}`, width / 2, height / 2 + 20);
    }

    return canvas.toDataURL('image/png');
  }

  generateImageWithProgress(
    request: AiImageGenerationRequest
  ): Observable<AiImageGenerationResponse> {
    return new Observable((observer) => {
      const interval = setInterval(() => {
        const current = this.progressSubject.value;
        if (current.status === 'loading') {
          this.updateProgress(
            'generating',
            Math.min(current.progress + Math.random() * 15, 90),
            'Generating image...'
          );
        }
      }, 500);

      this.generateImage(request).subscribe({
        next: (response) => {
          clearInterval(interval);
          this.updateProgress('completed', 100, 'Generation complete');
          observer.next(response);
          observer.complete();
        },
        error: (error) => {
          clearInterval(interval);
          this.updateProgress('error', 0, error.message);
          observer.error(error);
        },
      });
    });
  }

  private exponentialBackoff() {
    return (errors: Observable<HttpErrorResponse>) => {
      return errors.pipe(
        scan((retryCount, error) => {
          if (retryCount >= 8) {
            throw error;
          }
          // Retry on rate limiting, server errors, timeout, and network errors
          if (
            error.status !== 429 &&
            error.status !== 500 &&
            error.status !== 502 &&
            error.status !== 503 &&
            error.status !== 504 &&
            error.status !== 0
          ) {
            throw error;
          }
          console.warn(`Retry attempt ${retryCount + 1} for status ${error.status}`);
          return retryCount + 1;
        }, 0),
        switchMap((attempt) => timer(Math.pow(2, attempt) * 2000))
      );
    };
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unknown error occurred';

    if (error.error instanceof ErrorEvent) {
      // Client-side errors
      errorMessage = `Client error: ${error.error.message}`;
      console.error('AI Service Error - Client-side:', error.error.message);
      console.error('Possible causes: CORS issue, network connectivity, or request cancellation');
    } else {
      // Server-side errors
      switch (error.status) {
        case 0:
          errorMessage =
            'Network error: Request failed to reach server. This may be due to CORS restrictions or network issues.';
          console.error('AI Service Error - Status 0:', error);
          console.error(
            'Possible causes: CORS policy blocking request, network disconnected, or server unreachable'
          );
          break;
        case 400:
          errorMessage = 'Bad request: Invalid parameters';
          break;
        case 401:
          errorMessage = 'Unauthorized: Invalid API key';
          break;
        case 402:
          errorMessage = 'Payment required: Insufficient credits';
          break;
        case 429:
          errorMessage = 'Rate limit exceeded. Please try again later';
          this.updateRateLimitFromHeaders(error.headers);
          break;
        case 500:
          errorMessage = 'Server error: Please try again later';
          break;
        case 503:
          errorMessage = 'Service unavailable: Please try again later';
          break;
        default:
          errorMessage = `HTTP error ${error.status}: ${error.message}`;
      }
    }

    console.error('AI Image Generation Error:', errorMessage);
    this.updateProgress('error', 0, errorMessage);

    return throwError(() => new Error(errorMessage));
  }

  private updateRateLimitFromHeaders(headers: HttpHeaders): void {
    const limit = headers.get('X-RateLimit-Limit');
    const remaining = headers.get('X-RateLimit-Remaining');
    const reset = headers.get('X-RateLimit-Reset');

    if (limit && remaining && reset) {
      this.rateLimitSubject.next({
        limit: parseInt(limit, 10),
        remaining: parseInt(remaining, 10),
        resetTime: new Date(parseInt(reset, 10) * 1000),
      });
    }
  }

  private updateProgress(
    status: GenerationProgress['status'],
    progress: number,
    message: string
  ): void {
    this.progressSubject.next({ status, progress, message });
  }

  resetProgress(): void {
    this.progressSubject.next({ status: 'idle', progress: 0, message: '' });
  }

  getRemainingCredits(): number {
    return this.remainingCredits;
  }

  setRemainingCredits(credits: number): void {
    this.remainingCredits = credits;
  }

  checkRateLimit(): Observable<RateLimitInfo> {
    // Vertex AI free tier: ~1000 requests/month
    // Since we can't query rate-limit headers without auth,
    // return a default estimate
    return of({ limit: 1000, remaining: 1000, resetTime: new Date(Date.now() + 86400000) }).pipe(
      tap((info) => {
        this.rateLimitSubject.next(info);
      })
    );
  }

  cancelGeneration(): void {
    this.updateProgress('error', 0, 'Generation cancelled');
    // Note: Actual cancellation would require server-side support
  }
}
