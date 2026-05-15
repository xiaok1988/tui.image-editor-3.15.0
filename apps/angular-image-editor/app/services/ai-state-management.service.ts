import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest, map } from 'rxjs';
import { AiImageGenerationRequest, AiImageGenerationResponse, AiModel } from './ai-image-generation.service';

export interface GeneratedImage {
  id: string;
  prompt: string;
  negativePrompt?: string;
  modelId: string;
  imageData: string;
  timestamp: number;
  isFavorite: boolean;
  width: number;
  height: number;
}

export interface GenerationState {
  prompt: string;
  negativePrompt: string;
  selectedModel: AiModel | null;
  isLoading: boolean;
  error: string | null;
  lastGeneratedImage: GeneratedImage | null;
}

export interface UserPreferences {
  defaultModel: string;
  defaultWidth: number;
  defaultHeight: number;
  enableHistory: boolean;
  maxHistoryItems: number;
  theme: 'light' | 'dark';
}

@Injectable({
  providedIn: 'root'
})
export class AiStateManagementService {
  private STORAGE_KEYS = {
    HISTORY: 'ai-image-history',
    FAVORITES: 'ai-image-favorites',
    PREFERENCES: 'ai-user-preferences'
  };

  // Generation state
  private promptSubject = new BehaviorSubject<string>('');
  private negativePromptSubject = new BehaviorSubject<string>('');
  private selectedModelSubject = new BehaviorSubject<AiModel | null>(null);
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string | null>(null);
  private lastGeneratedImageSubject = new BehaviorSubject<GeneratedImage | null>(null);

  // Image history
  private imageHistorySubject = new BehaviorSubject<GeneratedImage[]>([]);

  // Favorites
  private favoritesSubject = new BehaviorSubject<GeneratedImage[]>([]);

  // User preferences
  private preferencesSubject = new BehaviorSubject<UserPreferences>({
    defaultModel: 'stabilityai/stable-diffusion-xl-base-1.0',
    defaultWidth: 512,
    defaultHeight: 512,
    enableHistory: true,
    maxHistoryItems: 50,
    theme: 'light'
  });

  // Expose observables
  public prompt$ = this.promptSubject.asObservable();
  public negativePrompt$ = this.negativePromptSubject.asObservable();
  public selectedModel$ = this.selectedModelSubject.asObservable();
  public isLoading$ = this.isLoadingSubject.asObservable();
  public error$ = this.errorSubject.asObservable();
  public lastGeneratedImage$ = this.lastGeneratedImageSubject.asObservable();
  public imageHistory$ = this.imageHistorySubject.asObservable();
  public favorites$ = this.favoritesSubject.asObservable();
  public preferences$ = this.preferencesSubject.asObservable();

  // Combined generation state
  public generationState$: Observable<GenerationState> = combineLatest([
    this.prompt$,
    this.negativePrompt$,
    this.selectedModel$,
    this.isLoading$,
    this.error$,
    this.lastGeneratedImage$
  ]).pipe(
    map(([prompt, negativePrompt, selectedModel, isLoading, error, lastGeneratedImage]) => ({
      prompt,
      negativePrompt,
      selectedModel,
      isLoading,
      error,
      lastGeneratedImage
    }))
  );

  constructor() {
    this.loadFromStorage();
  }

  // ==================== Generation State Management ====================

  setPrompt(prompt: string): void {
    this.promptSubject.next(prompt);
  }

  setNegativePrompt(negativePrompt: string): void {
    this.negativePromptSubject.next(negativePrompt);
  }

  setSelectedModel(model: AiModel | null): void {
    this.selectedModelSubject.next(model);
    if (model) {
      this.updatePreference('defaultModel', model.id);
    }
  }

  setLoading(isLoading: boolean): void {
    this.isLoadingSubject.next(isLoading);
    if (isLoading) {
      this.errorSubject.next(null);
    }
  }

  setError(error: string | null): void {
    this.errorSubject.next(error);
    if (error) {
      this.isLoadingSubject.next(false);
    }
  }

  setLastGeneratedImage(image: GeneratedImage | null): void {
    this.lastGeneratedImageSubject.next(image);
    if (image) {
      this.addToHistory(image);
    }
  }

  clearGenerationState(): void {
    this.promptSubject.next('');
    this.negativePromptSubject.next('');
    this.isLoadingSubject.next(false);
    this.errorSubject.next(null);
  }

  // ==================== Image History Management ====================

  addToHistory(image: GeneratedImage): void {
    const preferences = this.preferencesSubject.value;
    if (!preferences.enableHistory) {
      return;
    }

    const history = this.imageHistorySubject.value;
    const existingIndex = history.findIndex(h => h.id === image.id);
    
    let updatedHistory: GeneratedImage[];
    
    if (existingIndex >= 0) {
      // Remove existing entry and add to top
      updatedHistory = [image, ...history.filter(h => h.id !== image.id)];
    } else {
      // Add new entry to top
      updatedHistory = [image, ...history];
    }

    // Apply max items limit
    if (updatedHistory.length > preferences.maxHistoryItems) {
      updatedHistory = updatedHistory.slice(0, preferences.maxHistoryItems);
    }

    this.imageHistorySubject.next(updatedHistory);
    this.saveHistoryToStorage();
  }

  removeFromHistory(imageId: string): void {
    const updatedHistory = this.imageHistorySubject.value.filter(h => h.id !== imageId);
    this.imageHistorySubject.next(updatedHistory);
    this.saveHistoryToStorage();
  }

  clearHistory(): void {
    this.imageHistorySubject.next([]);
    this.saveHistoryToStorage();
  }

  // ==================== Favorites Management ====================

  toggleFavorite(imageId: string): void {
    const history = this.imageHistorySubject.value;
    const image = history.find(h => h.id === imageId);
    
    if (image) {
      const updatedImage: GeneratedImage = { ...image, isFavorite: !image.isFavorite };
      
      // Update in history
      const updatedHistory = history.map(h => h.id === imageId ? updatedImage : h);
      this.imageHistorySubject.next(updatedHistory);
      this.saveHistoryToStorage();

      // Update favorites list
      const favorites = this.favoritesSubject.value;
      if (updatedImage.isFavorite) {
        this.favoritesSubject.next([updatedImage, ...favorites]);
      } else {
        this.favoritesSubject.next(favorites.filter(f => f.id !== imageId));
      }
      this.saveFavoritesToStorage();
    }
  }

  isFavorite(imageId: string): boolean {
    return this.favoritesSubject.value.some(f => f.id === imageId);
  }

  removeFromFavorites(imageId: string): void {
    const favorites = this.favoritesSubject.value;
    const updatedFavorites = favorites.filter(f => f.id !== imageId);
    this.favoritesSubject.next(updatedFavorites);
    this.saveFavoritesToStorage();

    // Also update in history
    const history = this.imageHistorySubject.value;
    const updatedHistory = history.map(h => 
      h.id === imageId ? { ...h, isFavorite: false } : h
    );
    this.imageHistorySubject.next(updatedHistory);
    this.saveHistoryToStorage();
  }

  clearFavorites(): void {
    const favorites = this.favoritesSubject.value;
    
    // Update history to remove favorite flag
    const history = this.imageHistorySubject.value;
    const updatedHistory = history.map(h => ({ ...h, isFavorite: false }));
    this.imageHistorySubject.next(updatedHistory);
    this.saveHistoryToStorage();

    // Clear favorites
    this.favoritesSubject.next([]);
    this.saveFavoritesToStorage();
  }

  // ==================== Preferences Management ====================

  updatePreference<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]): void {
    const preferences = { ...this.preferencesSubject.value, [key]: value };
    this.preferencesSubject.next(preferences);
    this.savePreferencesToStorage();
  }

  setPreferences(preferences: Partial<UserPreferences>): void {
    const updatedPreferences = { ...this.preferencesSubject.value, ...preferences };
    this.preferencesSubject.next(updatedPreferences);
    this.savePreferencesToStorage();
  }

  // ==================== Storage Operations ====================

  private loadFromStorage(): void {
    // Load history
    try {
      const historyData = localStorage.getItem(this.STORAGE_KEYS.HISTORY);
      if (historyData) {
        this.imageHistorySubject.next(JSON.parse(historyData));
      }
    } catch (error) {
      console.warn('Failed to load image history from storage:', error);
    }

    // Load favorites
    try {
      const favoritesData = localStorage.getItem(this.STORAGE_KEYS.FAVORITES);
      if (favoritesData) {
        this.favoritesSubject.next(JSON.parse(favoritesData));
      }
    } catch (error) {
      console.warn('Failed to load favorites from storage:', error);
    }

    // Load preferences
    try {
      const preferencesData = localStorage.getItem(this.STORAGE_KEYS.PREFERENCES);
      if (preferencesData) {
        const savedPreferences = JSON.parse(preferencesData);
        this.preferencesSubject.next({ ...this.preferencesSubject.value, ...savedPreferences });
      }
    } catch (error) {
      console.warn('Failed to load preferences from storage:', error);
    }
  }

  private saveHistoryToStorage(): void {
    try {
      localStorage.setItem(this.STORAGE_KEYS.HISTORY, JSON.stringify(this.imageHistorySubject.value));
    } catch (error) {
      console.warn('Failed to save image history to storage:', error);
    }
  }

  private saveFavoritesToStorage(): void {
    try {
      localStorage.setItem(this.STORAGE_KEYS.FAVORITES, JSON.stringify(this.favoritesSubject.value));
    } catch (error) {
      console.warn('Failed to save favorites to storage:', error);
    }
  }

  private savePreferencesToStorage(): void {
    try {
      localStorage.setItem(this.STORAGE_KEYS.PREFERENCES, JSON.stringify(this.preferencesSubject.value));
    } catch (error) {
      console.warn('Failed to save preferences to storage:', error);
    }
  }

  // ==================== Helper Methods ====================

  createGeneratedImage(response: AiImageGenerationResponse, request: AiImageGenerationRequest): GeneratedImage {
    return {
      id: `image-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      prompt: request.prompt,
      negativePrompt: request.negativePrompt,
      modelId: request.model,
      imageData: response.images[0] || '',
      timestamp: Date.now(),
      isFavorite: false,
      width: request.width || 512,
      height: request.height || 512
    };
  }

  getImageById(imageId: string): GeneratedImage | undefined {
    return this.imageHistorySubject.value.find(h => h.id === imageId);
  }

  getHistoryCount(): number {
    return this.imageHistorySubject.value.length;
  }

  getFavoritesCount(): number {
    return this.favoritesSubject.value.length;
  }
}
