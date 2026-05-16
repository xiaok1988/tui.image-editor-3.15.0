import {
  Component,
  ElementRef,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import tuiImageEditor from 'tui-image-editor';

// Use any type for tui-image-editor since it doesn't have proper TypeScript types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ImageEditorInstance = any;

// Object properties interface
interface ObjectProperties {
  id?: number;
  type?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  textAlign?: string;
  opacity?: number;
  [key: string]: unknown;
}

// Default theme
const DEFAULT_THEME = {
  'common.bi.image': '',
  'common.bisize.width': '0px',
  'common.bisize.height': '0px',
  'common.backgroundImage': 'none',
  'common.backgroundColor': '#f0f0f0',
  'common.border': '0px',
  'header.backgroundImage': 'none',
  'header.backgroundColor': '#fff',
  'header.border': '0px',
  'loadButton.backgroundColor': '#fff',
  'loadButton.border': '1px solid #ddd',
  'loadButton.color': 'black',
  'downloadButton.backgroundColor': 'black',
  'downloadButton.border': '1px solid black',
  'downloadButton.color': '#fff',
  'menu.backgroundColor': '#f0f0f0',
  'menu.normalIcon.color': '#efefee',
  'menu.activeIcon.color': '#bebebe',
  'menu.disabledIcon.color': '#434343',
  'menu.hoverIcon.color': '#bebebe',
  'submenu.backgroundColor': '#fff',
  'submenu.partition.color': '#e0e0e0',
  'submenu.normalLabel.color': '#8a8a8a',
  'submenu.activeLabel.color': '#000',
  'checkbox.border': '0px',
  'checkbox.backgroundColor': '#fff',
  'range.pointer.color': '#fff',
  'range.bar.color': '#666',
  'range.subbar.color': '#d1d1d1',
  'range.value.color': '#000',
  'range.title.color': '#000',
  'colorpicker.button.border': '1px solid #1e1e1e',
  'colorpicker.title.color': '#000',
};

@Component({
  selector: 'app-image-editor',
  templateUrl: './image-editor.component.html',
  styleUrls: ['./image-editor.component.scss'],
})
export class ImageEditorComponent implements OnInit, OnDestroy, AfterViewInit, OnChanges {
  @ViewChild('editorContainer', { static: true }) editorContainer!: ElementRef<HTMLDivElement>;

  // Inputs
  @Input() theme: Record<string, unknown> = {};
  @Input() menu: string[] = ['crop', 'flip', 'rotate', 'draw', 'shape', 'icon', 'text', 'filter'];
  @Input() initMenu = '';
  @Input() menuBarPosition: 'top' | 'bottom' | 'left' | 'right' = 'left';
  @Input() cssMaxWidth = 99999;
  @Input() cssMaxHeight = 99999;

  // Outputs
  @Output() imageLoaded = new EventEmitter<{ width: number; height: number }>();
  @Output() objectAdded = new EventEmitter<{ id: number; type: string }>();
  @Output() objectSelected = new EventEmitter<{ id: number; type: string }>();
  @Output() objectActivated = new EventEmitter<ObjectProperties>();
  @Output() objectRemoved = new EventEmitter<{ id: number }>();
  @Output() undoRedoState = new EventEmitter<{ hasUndo: boolean; hasRedo: boolean }>();
  @Output() submenuChanged = new EventEmitter<{ menuName: string | null }>();
  @Output() error = new EventEmitter<Error>();

  // Internal state
  private editor!: ImageEditorInstance;
  private initialized = false;
  private currentSubmenu: string | null = null;
  private isMobile = false;
  private resizeObserver: ResizeObserver | null = null;
  private viewportWidth = 0;

  // AI Panel state
  showAiPanel = false;

  ngOnInit(): void {
    // Initialization happens in AfterViewInit
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initEditor();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['theme'] && this.editor) {
      // Theme changes - would need to recreate editor or update theme
    }
  }

  ngOnDestroy(): void {
    if (this.editor) {
      this.editor.destroy();
      this.editor = null as unknown as ImageEditorInstance;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    window.removeEventListener('resize', this.handleResize);
  }

  private handleResize = (): void => {
    this.updateViewportSize();
    this.resizeToWindow();
  };

  private updateViewportSize(): void {
    this.viewportWidth = window.innerWidth;
    this.isMobile = this.viewportWidth < 640;
    this.updateSubmenuModalState();
  }

  private updateSubmenuModalState(): void {
    const submenuElement = this.editorContainer.nativeElement.querySelector(
      '.tui-image-editor-submenu'
    );
    const backdropElement = this.editorContainer.nativeElement.querySelector(
      '.tui-image-editor-submenu-backdrop'
    );

    if (this.isMobile && this.currentSubmenu) {
      submenuElement?.classList.add('modal-open');
      if (!backdropElement) {
        this.createBackdrop();
      }
    } else {
      submenuElement?.classList.remove('modal-open');
      this.removeBackdrop();
    }
  }

  private createBackdrop(): void {
    const backdrop = document.createElement('div');
    backdrop.className = 'tui-image-editor-submenu-backdrop';
    backdrop.addEventListener('click', () => this.closeMobileSubmenu());
    this.editorContainer.nativeElement.appendChild(backdrop);
  }

  private removeBackdrop(): void {
    const backdrop = this.editorContainer.nativeElement.querySelector(
      '.tui-image-editor-submenu-backdrop'
    );
    if (backdrop) {
      backdrop.remove();
    }
  }

  private closeMobileSubmenu(): void {
    this.setSubmenu('', false);
  }

  private initEditor(): void {
    if (this.initialized) return;

    const mergedTheme = { ...DEFAULT_THEME, ...this.theme };

    const options: Record<string, unknown> = {
      includeUI: {
        loadImage: {
          path: '',
          name: 'SampleImage',
        },
        theme: mergedTheme,
        menu: this.menu,
        initMenu: this.initMenu,
        menuBarPosition: this.menuBarPosition,
        usageStatistics: false,
      },
      cssMaxWidth: this.cssMaxWidth,
      cssMaxHeight: this.cssMaxHeight,
      usageStatistics: false,
    };

    try {
      this.editor = new tuiImageEditor(this.editorContainer.nativeElement, options);
      this.setupEventListeners();

      // Defer resize to ensure the container has its final layout dimensions
      requestAnimationFrame(() => {
        this.resizeToWindow();
        requestAnimationFrame(() => {
          this.resizeToWindow(); // double frame for safety
        });
      });

      this.removeUnwantedElements();

      // Wait for DOM to be ready before binding help-menu events
      setTimeout(() => {
        this.bindHelpMenuEvents();
      }, 100);

      // Initialize responsive features
      this.updateViewportSize();
      window.addEventListener('resize', this.handleResize);

      this.initialized = true;
    } catch (err) {
      console.error('Failed to initialize image editor:', err);
      this.error.emit(err as Error);
    }
  }

  private bindHelpMenuEvents(): void {
    if (!this.editor?.ui?.activeMenuEvent) {
      return;
    }

    this.editor.ui.activeMenuEvent();
    this.ensureCanvasSelectable();

    const zoomInBtn = this.editor.ui._buttonElements?.['zoomIn'];
    const zoomOutBtn = this.editor.ui._buttonElements?.['zoomOut'];
    const deleteBtn = this.editor.ui._buttonElements?.['delete'];
    const deleteAllBtn = this.editor.ui._buttonElements?.['deleteAll'];

    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', (e: Event) => {
        e.preventDefault();
        this.zoomIn();
      });
    }

    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', (e: Event) => {
        e.preventDefault();
        this.zoomOut();
      });
    }

    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e: Event) => {
        e.preventDefault();
        const activeObject = this.editor._graphics?.getActiveObject();
        if (activeObject) {
          this.deleteSelectedObject();
        }
      });
    }

    if (deleteAllBtn) {
      deleteAllBtn.addEventListener('click', (e: Event) => {
        e.preventDefault();
        this.clearAll();
      });
    }
  }

  zoomIn(): void {
    const canvas = this.editor._graphics?.getCanvas();
    if (canvas) {
      const currentZoom = canvas.getZoom();
      const newZoom = Math.min(currentZoom * 1.2, 10);
      canvas.setZoom(newZoom);
      this.scaleContainer(newZoom);
      canvas.renderAll();
    }
  }

  zoomOut(): void {
    const canvas = this.editor._graphics?.getCanvas();
    if (canvas) {
      const currentZoom = canvas.getZoom();
      const newZoom = Math.max(currentZoom / 1.2, 0.1);
      canvas.setZoom(newZoom);
      this.scaleContainer(newZoom);
      canvas.renderAll();
    }
  }

  private scaleContainer(zoom: number): void {
    const wrapper = this.editorContainer?.nativeElement.querySelector('.tui-image-editor-canvas-container') as HTMLElement;
    if (wrapper) {
      wrapper.style.width = `${100 * zoom}%`;
      wrapper.style.height = `${100 * zoom}%`;
    }
  }

  private setupEventListeners(): void {
    this.editor.on('loadImage', (info: { width: number; height: number }) => {
      this.imageLoaded.emit(info);
      this.emitUndoRedoState();
    });

    this.editor.on('addObject', (obj: { id: number; type: string }) => {
      this.objectAdded.emit(obj);
      this.emitUndoRedoState();
    });

    this.editor.on('selectObject', (obj: { id: number; type: string }) => {
      this.objectSelected.emit(obj);
    });

    this.editor.on('objectActivated', (props: ObjectProperties) => {
      this.objectActivated.emit(props);
    });

    this.editor.on('removeObject', (obj: { id: number }) => {
      this.objectRemoved.emit(obj);
      this.emitUndoRedoState();
    });

    this.editor.on('undoStackChanged', () => this.emitUndoRedoState());
    this.editor.on('redoStackChanged', () => this.emitUndoRedoState());
  }

  private emitUndoRedoState(): void {
    const state = {
      hasUndo: this.editor?.getUndoStack?.()?.length > 0 ?? false,
      hasRedo: this.editor?.getRedoStack?.()?.length > 0 ?? false,
    };
    this.undoRedoState.emit(state);
  }

  private removeUnwantedElements(): void {
    // Remove header buttons and header
    const headerButtons = this.editorContainer.nativeElement.querySelector(
      '.tui-image-editor-header-buttons'
    );
    if (headerButtons) {
      headerButtons.remove();
    }
    const header = this.editorContainer.nativeElement.querySelector('.tui-image-editor-header');
    if (header) {
      header.remove();
    }
  }

  resizeToWindow(): void {
    if (!this.editor) return;

    const container = this.editorContainer.nativeElement.parentElement;
    if (container) {
      const rect = container.getBoundingClientRect();
      const width = rect.width || window.innerWidth;
      const height = rect.height || window.innerHeight;

      this.editor.ui.resizeEditor({
        uiSize: {
          width: `${width}px`,
          height: `${height}px`,
        },
      });
    }
  }

  // Public API
  loadImageFromFile(file: File): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageData = e.target?.result as string;
        if (imageData) {
          this.loadImageToEditor(imageData).then(resolve).catch(reject);
        } else {
          reject(new Error('Failed to read file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  private loadImageToEditor(imageData: string): Promise<unknown> {
    const canvasImage = this.editor._graphics?.getCanvasImage();
    let promise: Promise<unknown>;
    
    if (!canvasImage) {
      // First image - load as background and then convert to selectable object
      promise = this.editor.loadImageFromURL(imageData, 'uploaded-image').then((sizeInfo: unknown) => {
        // After loading as background, add it as a selectable object too
        return this.editor.addImageObject(imageData).then(() => sizeInfo);
      });
    } else {
      promise = this.editor.addImageObject(imageData);
    }
    
    // Ensure images are selectable after loading
    return promise.then((result) => {
      // Use setTimeout to ensure image is fully rendered before making it selectable
      setTimeout(() => {
        // Hide any active submenu first to ensure selection is enabled
        this.hideAllSubmenus();
        this.ensureCanvasSelectable();
      }, 100);
      return result;
    });
  }

  private loadImageAsObject(imageData: string, fitToCanvas: boolean = true): Promise<unknown> {
    const canvas = this.editor._graphics?.getCanvas();
    if (!canvas) {
      return Promise.reject(new Error('Canvas not available'));
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let scaleX = 1;
        let scaleY = 1;
        let scale = 1;

        if (fitToCanvas) {
          scaleX = canvas.width / img.width;
          scaleY = canvas.height / img.height;
          scale = Math.min(scaleX, scaleY, 1);
        } else {
          const newWidth = img.width;
          const newHeight = img.height;

          if (typeof canvas.setWidth === 'function') {
            canvas.setWidth(newWidth);
          } else {
            canvas.width = newWidth;
          }
          if (typeof canvas.setHeight === 'function') {
            canvas.setHeight(newHeight);
          } else {
            canvas.height = newHeight;
          }

          const wrapper = this.editorContainer?.nativeElement.querySelector('.tui-image-editor-canvas-container');
          if (wrapper) {
            (wrapper as HTMLElement).style.width = `${newWidth}px`;
            (wrapper as HTMLElement).style.height = `${newHeight}px`;
          }

          const canvasWrapper = this.editorContainer?.nativeElement.querySelector('.tui-image-editor-canvas-wrap');
          if (canvasWrapper) {
            (canvasWrapper as HTMLElement).style.width = `${newWidth}px`;
            (canvasWrapper as HTMLElement).style.height = `${newHeight}px`;
          }

          const canvasElements = this.editorContainer?.nativeElement.querySelectorAll('canvas');
          canvasElements?.forEach((canvasEl) => {
            (canvasEl as HTMLCanvasElement).width = newWidth;
            (canvasEl as HTMLCanvasElement).height = newHeight;
          });

          canvas.renderAll();
          this.editor.ui.resizeEditor();
        }

        const fabricImg = new (window as any).fabric.Image(img, {
          left: fitToCanvas ? (canvas.width - img.width * scale) / 2 : 0,
          top: fitToCanvas ? (canvas.height - img.height * scale) / 2 : 0,
          scaleX: scale,
          scaleY: scale,
          selectable: true,
          hasControls: true,
          hasBorders: true,
        });

        canvas.add(fabricImg);
        canvas.setActiveObject(fabricImg);
        canvas.renderAll();

        this.ensureCanvasSelectable();
        resolve(fabricImg);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageData;
    });
  }

  loadImageFromURL(url: string, name = 'SampleImage'): Promise<unknown> {
    return this.editor.loadImageFromURL(url, name);
  }

  undo(): void {
    this.editor.undo();
  }

  redo(): void {
    this.editor.redo();
  }

  clear(): void {
    this.editor.clearObjects();
  }

  clearAll(): void {
    this.editor._graphics.removeAll(true);
  }

  deleteSelectedObject(): void {
    const activeObject = this.editor._graphics?.getActiveObject();
    if (activeObject) {
      this.editor.removeObject(activeObject.id);
    }
  }

  rotate(angle: number): Promise<number> {
    return this.editor.rotate(angle);
  }

  flipX(): Promise<unknown> {
    return this.editor.flipX();
  }

  flipY(): Promise<unknown> {
    return this.editor.flipY();
  }

  toDataURL(options?: { format?: string; quality?: number }): string {
    return this.editor.toDataURL(options);
  }

  getCanvasSize(): { width: number; height: number } {
    return this.editor.getCanvasSize();
  }

  getEditor(): ImageEditorInstance {
    return this.editor;
  }

  updateObjectProperties(id: number, properties: Partial<ObjectProperties>): void {
    if (this.editor) {
      this.editor.setObjectPropertiesQuietly(id, properties);
    }
  }

  /**
   * Set submenu - control which submenu is displayed
   * @param {string} menuName - Name of the menu to activate
   * @param {boolean} [toggle=true] - Whether to toggle if clicking the same menu
   * @param {boolean} [discardSelection=true] - Whether to discard current selection
   */
  setSubmenu(menuName: string, toggle = true, discardSelection = true): void {
    if (!this.editor || !this.editor.ui) {
      return;
    }

    const mainElement = this.editorContainer.nativeElement.querySelector('.tui-image-editor-main');
    const buttonElements = this.editor._buttonElements || {};

    // Debug: Check if mainElement exists
    console.log('setSubmenu called with:', menuName);
    console.log('mainElement found:', !!mainElement);
    if (mainElement) {
      console.log('mainElement classList before:', mainElement.className);
    }
    if (!mainElement) {
      // Try to find the correct element
      const allElements = this.editorContainer.nativeElement.querySelectorAll(
        '[class*="tui-image-editor"]'
      );
      console.log('Available tui-image-editor elements:', allElements);
    }

    // Debug: Check submenu elements
    const submenuElements =
      this.editorContainer.nativeElement.querySelectorAll('[class*="submenu"]');
    console.log('Submenu elements found:', submenuElements.length);
    submenuElements.forEach((el, index) => {
      console.log(`Submenu ${index}:`, el.className);
    });

    // Debug: Check the full submenu structure
    const mainSubmenu = this.editorContainer.nativeElement.querySelector(
      '.tui-image-editor-submenu'
    );
    if (mainSubmenu) {
      console.log('Main submenu element:', mainSubmenu);
      console.log('Main submenu children:', mainSubmenu.children);
    }

    // If there's an active submenu, deactivate it
    if (this.currentSubmenu) {
      // Remove active class from button
      if (buttonElements[this.currentSubmenu]) {
        buttonElements[this.currentSubmenu].classList.remove('active');
      }

      // Remove menu class from main element
      if (mainElement) {
        mainElement.classList.remove(`tui-image-editor-menu-${this.currentSubmenu}`);
      }

      // Discard selection if needed
      if (discardSelection && this.editor._actions?.main?.discardSelection) {
        this.editor._actions.main.discardSelection();
      }

      // Change selectable state
      if (this.editor._actions?.main?.changeSelectableAll) {
        this.editor._actions.main.changeSelectableAll(true);
      }

      // Call changeStandbyMode on the current submenu
      if (this.editor[this.currentSubmenu]?.changeStandbyMode) {
        this.editor[this.currentSubmenu].changeStandbyMode();
      }
    }

    // If clicking the same menu and toggle is enabled, close it
    if (this.currentSubmenu === menuName && toggle) {
      this.currentSubmenu = null;
    } else {
      // Activate the new menu
      if (buttonElements[menuName]) {
        buttonElements[menuName].classList.add('active');
      }

      if (mainElement) {
        mainElement.classList.add(`tui-image-editor-menu-${menuName}`);
      }

      this.currentSubmenu = menuName;

      // Call changeStartMode on the new submenu
      if (this.editor[menuName]?.changeStartMode) {
        this.editor[menuName].changeStartMode();
      }
    }

    // Resize editor after changing submenu
    if (this.editor.ui?.resizeEditor) {
      this.editor.ui.resizeEditor();
    }

    // Update mobile modal state
    this.updateSubmenuModalState();

    // Emit event to notify parent component
    this.submenuChanged.emit({ menuName: this.currentSubmenu });
  }

  /**
   * Get current active submenu
   * @returns {string | null} - Current submenu name or null
   */
  getCurrentSubmenu(): string | null {
    return this.currentSubmenu;
  }

  /**
   * Hide all submenus
   */
  hideAllSubmenus(): void {
    this.setSubmenu('', false);
  }

  /**
   * Setup listener to capture submenu changes from editor's internal events
   * This listener does NOT interfere with any editor functionality
   */
  private setupSubmenuChangeListener(): void {
    // No longer using event listener - we rely on interceptEditorSetSubmenu and polling
    console.log('setupSubmenuChangeListener - relying on interceptor and polling');
  }

  /**
   * Intercept the editor's setSubmenu method to capture all submenu changes
   */
  private interceptEditorSetSubmenu(): void {
    // Debug: Log the editor structure
    console.log('Editor object:', this.editor);
    console.log('Editor ui:', this.editor?.ui);
    console.log('Editor ui type:', typeof this.editor?.ui);

    // Check if ui exists and has methods
    if (this.editor?.ui) {
      console.log(
        'Editor ui methods:',
        Object.keys(this.editor.ui).filter((key) => typeof this.editor.ui[key] === 'function')
      );
      console.log(
        'Editor ui properties:',
        Object.keys(this.editor.ui).filter((key) => typeof this.editor.ui[key] !== 'function')
      );
    }

    // Check current submenu value
    if (this.editor?.ui) {
      console.log('Current ui.submenu value:', this.editor.ui.submenu);
    }

    // Use Object.defineProperty to intercept submenu property changes
    const ui = this.editor?.ui as any;
    if (ui !== undefined && ui !== null) {
      // Get the current submenu value
      let currentValue = ui.submenu;

      // Override the submenu property with a getter/setter
      Object.defineProperty(ui, 'submenu', {
        get: () => currentValue,
        set: (newValue: string | boolean) => {
          console.log('Submenu property changed from:', currentValue, 'to:', newValue);

          // Update internal state
          const newMenuName = newValue === false ? null : String(newValue);
          this.currentSubmenu = newMenuName;

          // Emit the event
          this.submenuChanged.emit({ menuName: this.currentSubmenu });
          console.log('Emitted submenuChanged event:', this.currentSubmenu);

          // Update the stored value
          currentValue = newValue;
        },
        enumerable: true,
        configurable: true,
      });

      console.log('Successfully set up submenu property interceptor');

      // Also set up a polling mechanism to detect changes
      // This is a fallback in case the setter doesn't get called
      let previousValue = ui.submenu;
      setInterval(() => {
        const current = ui.submenu;
        if (current !== previousValue) {
          console.log('Submenu changed detected via polling:', previousValue, '->', current);
          const newMenuName = current === false ? null : String(current);
          if (newMenuName !== this.currentSubmenu) {
            this.currentSubmenu = newMenuName;
            this.submenuChanged.emit({ menuName: this.currentSubmenu });
            console.log('Emitted submenuChanged event via polling:', this.currentSubmenu);
          }
          previousValue = current;
        }
      }, 100);
    } else {
      console.log('Could not set up submenu property interceptor - ui module not found');
    }
  }

  /**
   * Handle menu button click
   * @param menuName - Name of the menu that was clicked
   */
  private handleMenuClick(menuName: string): void {
    this.setSubmenu(menuName);
    this.ensureCanvasSelectable();
  }

  private ensureCanvasSelectable(): void {
    const canvas = this.editor._graphics?.getCanvas();
    if (canvas) {
      console.log('ensureCanvasSelectable called');
      console.log('Canvas before:', {
        selection: canvas.selection,
        defaultCursor: canvas.defaultCursor,
        objectsCount: canvas.getObjects().length
      });
      
      if (this.editor._graphics.getZoomMode() === 'hand') {
        console.log('Ending hand mode');
        this.editor._graphics.endHandMode();
      }
      
      canvas.selection = true;
      canvas.defaultCursor = 'default';
      
      // Use built-in method to make all objects selectable
      if (this.editor._graphics.changeSelectableAll) {
        console.log('Calling changeSelectableAll(true)');
        this.editor._graphics.changeSelectableAll(true);
      }
      
      // Additional settings for each object
      canvas.forEachObject((obj: any, index: number) => {
        console.log(`Object ${index} before:`, {
          selectable: obj.selectable,
          evented: obj.evented,
          hasControls: obj.hasControls,
          hasBorders: obj.hasBorders,
          type: obj.type
        });
        
        obj.evented = true;
        obj.selectable = true;
        obj.hasControls = true;
        obj.hasBorders = true;
        obj.hoverCursor = 'move';
        
        console.log(`Object ${index} after:`, {
          selectable: obj.selectable,
          evented: obj.evented,
          hasControls: obj.hasControls,
          hasBorders: obj.hasBorders
        });
      });
      
      canvas.renderAll();
      console.log('Canvas after render:', {
        selection: canvas.selection,
        defaultCursor: canvas.defaultCursor,
        objectsCount: canvas.getObjects().length
      });
    }
  }

  /**
   * Toggle AI panel visibility
   */
  toggleAiPanel(): void {
    this.showAiPanel = !this.showAiPanel;
  }

  /**
   * Handle AI-generated image
   * @param imageData - Base64 encoded image data
   */
  onImageGenerated(imageData: string): void {
    // Close the AI panel
    this.showAiPanel = false;

    // Load the generated image into the editor
    if (this.editor && imageData) {
      // Wait for the editor to be fully initialized before loading
      this.loadImageWithRetry(imageData, 3);
    }
  }

  /**
   * Load image with retry mechanism to handle initialization issues
   */
  private loadImageWithRetry(imageData: string, retries: number): void {
    const canvas = this.editor?._graphics?.getCanvas();

    if (!canvas || !canvas._objects) {
      if (retries > 0) {
        console.log(`Canvas not ready, retrying in 200ms (${retries} retries left)`);
        setTimeout(() => this.loadImageWithRetry(imageData, retries - 1), 200);
        return;
      } else {
        console.error('Canvas not initialized after retries');
        this.error.emit(new Error('Editor canvas not ready'));
        return;
      }
    }

    console.log('Loading AI-generated image into editor...');

    this.loadImageToEditor(imageData)
      .then(() => {
        console.log('AI image loaded successfully');
      })
      .catch((e: any) => {
        console.error('Failed to load AI image:', e);
        this.error.emit(new Error('Failed to load AI image'));
      });
  }
}
