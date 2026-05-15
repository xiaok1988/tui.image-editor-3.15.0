import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Observable, debounceTime, distinctUntilChanged, map, switchMap, of } from 'rxjs';
import {
  AiImageGenerationService,
  AiImageGenerationRequest,
  AiModel,
  GenerationProgress,
} from '../../services/ai-image-generation.service';
import { AiStateManagementService } from '../../services/ai-state-management.service';

@Component({
  selector: 'app-ai-panel',
  templateUrl: './ai-panel.component.html',
  styleUrls: ['./ai-panel.component.scss'],
})
export class AiPanelComponent implements OnInit {
  @Output() close = new EventEmitter<void>();
  @Output() imageGenerated = new EventEmitter<string>();

  models: AiModel[] = [];
  selectedModelId = '';
  prompt = '';
  negativePrompt = '';
  width = 512;
  height = 512;
  isImageToImage = false;
  isGenerating = false;
  progress = 0;
  progressMessage = '';
  errorMessage = '';

  maxWidth = 1024;
  maxHeight = 1024;

  suggestions: string[] = [];
  private promptControl = new FormControl('');

  private promptSuggestions = [
    'A beautiful sunset over the ocean with golden clouds',
    'A cute cat sitting on a windowsill in a cozy room',
    'A futuristic city skyline at night with neon lights',
    'A peaceful mountain landscape with a lake and forest',
    'A fantasy castle surrounded by magical creatures',
    'A vintage bookstore with sunlight streaming through windows',
    'A tropical beach with turquoise water and palm trees',
    'A cyberpunk street scene with flying cars',
    'A cute puppy playing in a field of flowers',
    'An ancient temple hidden in a misty jungle',
  ];

  constructor(
    private aiService: AiImageGenerationService,
    private stateService: AiStateManagementService
  ) {}

  ngOnInit(): void {
    this.loadModels();
    this.loadPreferences();
    this.setupPromptAutocomplete();
    this.subscribeToProgress();
  }

  private loadModels(): void {
    this.models = this.aiService.getSupportedModels();
    if (this.models.length > 0) {
      this.selectedModelId = this.models[0].id;
    }
  }

  private loadPreferences(): void {
    this.stateService.preferences$.subscribe((preferences) => {
      this.selectedModelId = preferences.defaultModel;
      this.width = preferences.defaultWidth;
      this.height = preferences.defaultHeight;
    });
  }

  private setupPromptAutocomplete(): void {
    this.promptControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((query) => this.getSuggestions(query))
      )
      .subscribe((suggestions) => {
        this.suggestions = suggestions;
      });
  }

  private getSuggestions(query: string | null): Observable<string[]> {
    if (!query || query.length < 2) {
      return of([]);
    }

    const filtered = this.promptSuggestions.filter((suggestion) =>
      suggestion.toLowerCase().includes(query.toLowerCase())
    );

    return of(filtered.slice(0, 5));
  }

  private subscribeToProgress(): void {
    this.aiService.progress$.subscribe((progress: GenerationProgress) => {
      this.isGenerating = progress.status === 'loading' || progress.status === 'generating';
      this.progress = progress.progress;
      this.progressMessage = progress.message;

      if (progress.status === 'error') {
        this.errorMessage = progress.error || 'Unknown error';
      } else {
        this.errorMessage = '';
      }
    });
  }

  onPromptChange(): void {
    this.promptControl.setValue(this.prompt);
  }

  applySuggestion(suggestion: string): void {
    this.prompt = suggestion;
    this.suggestions = [];
  }

  onModelChange(): void {
    const model = this.models.find((m) => m.id === this.selectedModelId);
    if (model) {
      this.maxWidth = model.maxWidth;
      this.maxHeight = model.maxHeight;

      if (this.width > model.maxWidth) {
        this.width = model.maxWidth;
      }
      if (this.height > model.maxHeight) {
        this.height = model.maxHeight;
      }
    }
  }

  toggleImageToImage(): void {
    // Can be extended to handle image-to-image workflow
  }

  get canGenerate(): boolean {
    return (
      this.prompt.trim().length > 0 &&
      this.width >= 256 &&
      this.height >= 256 &&
      !!this.selectedModelId
    );
  }

  async generateImage(): Promise<void> {
    if (!this.canGenerate) {
      return;
    }

    this.errorMessage = '';
    this.isGenerating = true;

    const request: AiImageGenerationRequest = {
      model: this.selectedModelId,
      prompt: this.prompt,
      negativePrompt: this.negativePrompt,
      width: this.width,
      height: this.height,
    };

    try {
      const response = await this.aiService.generateImageWithProgress(request).toPromise();

      if (response && response.images.length > 0) {
        const generatedImage = this.stateService.createGeneratedImage(response, request);
        this.stateService.setLastGeneratedImage(generatedImage);
        this.stateService.setPrompt(this.prompt);
        this.stateService.setNegativePrompt(this.negativePrompt);

        this.imageGenerated.emit(response.images[0]);
      }
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Generation failed';
    } finally {
      this.isGenerating = false;
    }
  }

  closePanel(): void {
    this.close.emit();
  }

  get Math(): typeof Math {
    return Math;
  }
}
