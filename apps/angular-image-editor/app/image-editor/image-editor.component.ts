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

  // State
  private backgroundImageDeleted = false;

  // Internal state
  private editor!: ImageEditorInstance;
  private initialized = false;
  private currentSubmenu: string | null = null;
  private isMobile = false;
  private resizeObserver: ResizeObserver | null = null;
  private viewportWidth = 0;
  private menuObserver: MutationObserver | null = null;

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
    if (this.menuObserver) {
      this.menuObserver.disconnect();
      this.menuObserver = null;
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
      // Add close button click handler
      this.addCloseButtonHandler();
    } else {
      submenuElement?.classList.remove('modal-open');
      this.removeBackdrop();
    }
  }

  private addCloseButtonHandler(): void {
    const submenuElement = this.editorContainer.nativeElement.querySelector(
      '.tui-image-editor-submenu'
    ) as HTMLElement;
    
    if (submenuElement && !submenuElement.dataset['closeHandlerAdded']) {
      submenuElement.dataset['closeHandlerAdded'] = 'true';
      
      submenuElement.addEventListener('click', (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        // Check if clicked on the pseudo-element area (top-left corner)
        if (target === submenuElement || target.parentElement === submenuElement) {
          const rect = submenuElement.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          
          // If click is in the top-left area where the close button is
          if (x < 50 && y < 50) {
            e.preventDefault();
            e.stopPropagation();
            this.closeMobileSubmenu();
          }
        }
      }, true);
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

  private interceptTuiMenuChange(): void {
    if (!this.editor?.ui) return;

    // Store original changeMenu method
    const originalChangeMenu = this.editor.ui.changeMenu?.bind(this.editor.ui);
    
    if (originalChangeMenu) {
      this.editor.ui.changeMenu = (menuName: string, toggle = true, discardSelection = true) => {
        // On mobile, if clicking the same menu, toggle it off
        if (this.isMobile && this.currentSubmenu === menuName && toggle) {
          this.currentSubmenu = null;
          this.updateSubmenuModalState();
          return;
        }
        
        originalChangeMenu(menuName, toggle, discardSelection);
        
        // Update our submenu state after TUI changes menu
        setTimeout(() => {
          this.currentSubmenu = this.editor.ui.submenu || null;
          this.updateSubmenuModalState();
        }, 100);
      };
    }

    // Monitor menu button clicks directly
    const menuButtonContainer = this.editorContainer.nativeElement.querySelector('.tui-image-editor-menu');
    if (menuButtonContainer) {
      this.menuObserver = new MutationObserver(() => {
        const activeButton = menuButtonContainer.querySelector('.active');
        if (activeButton) {
          const menuName = activeButton.getAttribute('data-menu') || '';
          if (menuName && menuName !== this.currentSubmenu) {
            this.currentSubmenu = menuName;
            this.updateSubmenuModalState();
          }
        } else if (this.currentSubmenu) {
          this.currentSubmenu = null;
          this.updateSubmenuModalState();
        }
      });
      
      this.menuObserver.observe(menuButtonContainer, { 
        subtree: true, 
        attributes: true, 
        attributeFilter: ['class'] 
      });
    }
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

      // Intercept TUI's internal menu change to track submenu state
      this.interceptTuiMenuChange();

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
      const newZoomInBtn = zoomInBtn.cloneNode(true) as HTMLElement;
      zoomInBtn.parentNode?.replaceChild(newZoomInBtn, zoomInBtn);
      this.editor.ui._buttonElements['zoomIn'] = newZoomInBtn;
      newZoomInBtn.addEventListener('click', (e: Event) => {
        e.preventDefault();
        this.zoomIn();
      });
    }

    if (zoomOutBtn) {
      const newZoomOutBtn = zoomOutBtn.cloneNode(true) as HTMLElement;
      zoomOutBtn.parentNode?.replaceChild(newZoomOutBtn, zoomOutBtn);
      this.editor.ui._buttonElements['zoomOut'] = newZoomOutBtn;
      newZoomOutBtn.addEventListener('click', (e: Event) => {
        e.preventDefault();
        this.zoomOut();
      });
    }

    if (deleteBtn) {
      console.log('Setting up delete button - cloning');
      
      // Clone button to completely remove all original event listeners
      const newDeleteBtn = deleteBtn.cloneNode(true) as HTMLElement;
      deleteBtn.parentNode?.replaceChild(newDeleteBtn, deleteBtn);
      this.editor.ui._buttonElements['delete'] = newDeleteBtn;
      
      // Add our own click handler
      newDeleteBtn.addEventListener('click', (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('Delete button clicked');
        
        const activeObject = this.editor._graphics?.getActiveObject();
        const bgImage = this.editor._graphics?.getCanvasImage();
        const canvas = this.editor._graphics?.getCanvas();
        
        if (!activeObject || !canvas) {
          console.log('No active object or canvas');
          return;
        }
        
        console.log('Active object:', activeObject, 'is background image:', bgImage && activeObject === bgImage);
        console.log('Objects count before:', canvas.getObjects().length);
        console.log('canvasImage before:', this.editor._graphics?.canvasImage);
        
        // Always use direct fabric remove - bypass tui-image-editor completely!
        try {
          // First, remove it from fabric canvas
          canvas.remove(activeObject);
          
          // Also try to remove from canvas.backgroundImage if it exists
          if (canvas.backgroundImage === activeObject) {
            console.log('Also removing from canvas.backgroundImage');
            canvas.backgroundImage = null;
          }
          
          // If it was the background image, also clear canvasImage
          if (bgImage && activeObject === bgImage) {
            console.log('It was background image');
            this.backgroundImageDeleted = true;
            this.editor._graphics.canvasImage = null;
          }
          
          // Render canvas
          canvas.renderAll();
          
          console.log('Objects count after:', canvas.getObjects().length);
          console.log('canvasImage after:', this.editor._graphics?.canvasImage);
          console.log('Object deleted successfully');
        } catch (err) {
          console.error('Error deleting object:', err);
        }
      });
      
      console.log('Delete button setup complete');
    }

    if (deleteAllBtn) {
      // Clone button to remove all existing event listeners
      const newDeleteAllBtn = deleteAllBtn.cloneNode(true) as HTMLElement;
      deleteAllBtn.parentNode?.replaceChild(newDeleteAllBtn, deleteAllBtn);
      this.editor.ui._buttonElements['deleteAll'] = newDeleteAllBtn;
      
      newDeleteAllBtn.addEventListener('click', (e: Event) => {
        e.preventDefault();
        this.clearAll();
      });
    }
  }

zoomIn(): void {
    const currentZoom = this.currentZoom || 1;
    const newZoom = Math.min(currentZoom * 1.2, 10);
    this.applyPhysicalZoom(newZoom);
  }

  zoomOut(): void {
    const currentZoom = this.currentZoom || 1;
    const newZoom = Math.max(currentZoom / 1.2, 0.1);
    this.applyPhysicalZoom(newZoom);
  }

  private currentZoom = 1;
  private baseCanvasWidth = 0;
  private baseCanvasHeight = 0;

  /**
   * Physical zoom via pure DOM manipulation.
   * Stores original canvas size on first call, then scales everything proportionally.
   * Does NOT touch Fabric.js APIs to avoid conflicting with TUI's internal state.
   */
  private applyPhysicalZoom(zoom: number): void {
    const canvas = this.editor._graphics?.getCanvas();
    
    if (!canvas) {
      console.warn('Zoom: Canvas not found');
      return;
    }

    // Use Fabric.js zoom API directly
    const center = canvas.getCenter();
    canvas.zoomToPoint(new (window as any).fabric.Point(center.left, center.top), zoom);
    canvas.renderAll();

    // Also apply CSS transform to the canvas element for visual scaling
    const canvasElement = canvas.getElement();
    if (canvasElement) {
      canvasElement.style.transform = `scale(${zoom})`;
      canvasElement.style.transformOrigin = 'center center';
    }

    this.currentZoom = zoom;
  }

  private setupEventListeners(): void {
    this.editor.on('loadImage', (info: { width: number; height: number }) => {
      this.imageLoaded.emit(info);
      this.emitUndoRedoState();
      // Ensure background image is selectable after loading
      setTimeout(() => this.ensureCanvasSelectable(), 100);
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
    
    // Also check after undo/redo operations
    this.editor.on('undo', () => {
      setTimeout(() => this.ensureCanvasSelectable(), 100);
    });
    this.editor.on('redo', () => {
      setTimeout(() => this.ensureCanvasSelectable(), 100);
    });
    
    // Add a periodic check to ensure background image remains selectable
    setInterval(() => {
      this.ensureBackgroundImageSelectable();
    }, 500);
  }
  
  private ensureBackgroundImageSelectable(): void {
    // If background image has been deleted, don't restore it
    if (this.backgroundImageDeleted) {
      return;
    }
    
    const bgImage = this.editor._graphics?.getCanvasImage();
    const canvas = this.editor._graphics?.getCanvas();
    if (bgImage && canvas) {
      // Check if background image is not selectable
      if (!bgImage.selectable || !bgImage.evented || !bgImage.hasControls) {
        console.log('Re-enabling background image selectability');
        
        // Set all selectable properties
        bgImage.selectable = true;
        bgImage.evented = true;
        bgImage.hasControls = true;
        bgImage.hasBorders = true;
        bgImage.hoverCursor = 'move';
        bgImage.moveCursor = 'move';
        bgImage.lockMovementX = false;
        bgImage.lockMovementY = false;
        bgImage.lockRotation = false;
        bgImage.lockScalingX = false;
        bgImage.lockScalingY = false;
        bgImage.lockUniScaling = false;
        bgImage.excludeFromExport = false;
        
        // Ensure the background image is in the canvas object list
        const objects = canvas.getObjects();
        const bgImageInList = objects.some((obj: any) => obj === bgImage);
        
        if (!bgImageInList) {
          console.log('Adding background image to canvas object list');
          // Remove it first to avoid duplicates
          canvas.remove(bgImage);
          // Add it back to the canvas
          canvas.add(bgImage);
          // Make sure it's at the bottom
          canvas.sendToBack(bgImage);
        }
        
        canvas.renderAll();
      }
    }
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

      const canvasContainer = this.editorContainer.nativeElement.querySelector('.tui-image-editor-canvas-container') as HTMLElement;
      if (canvasContainer) {
        canvasContainer.style.cssText = `max-width: none !important; max-height: none !important;`;
      }

      const canvasWrap = this.editorContainer.nativeElement.querySelector('.tui-image-editor-canvas-wrap') as HTMLElement;
      if (canvasWrap) {
        canvasWrap.style.cssText = `max-width: none !important; max-height: none !important;`;
      }
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
    
    // Reset background image deleted flag when loading new image
    this.backgroundImageDeleted = false;
    
    if (!canvasImage) {
      // First image - load as background (filter applies to background image)
      promise = this.editor.loadImageFromURL(imageData, 'uploaded-image');
    } else {
      // Subsequent images - add as selectable objects
      promise = this.editor.addImageObject(imageData);
    }
    
    // Ensure images are selectable after loading
    return promise.then((result) => {
      // Use setTimeout to ensure image is fully rendered before making it selectable
      setTimeout(() => {
        // Hide any active submenu first to ensure selection is enabled
        this.hideAllSubmenus();
        
        // Make background image selectable and add to fabric object list
        const bgImage = this.editor._graphics?.getCanvasImage();
        const canvas = this.editor._graphics?.getCanvas();
        if (bgImage && canvas && !this.backgroundImageDeleted) {
          // Set all selectable properties
          bgImage.selectable = true;
          bgImage.evented = true;
          bgImage.hasControls = true;
          bgImage.hasBorders = true;
          bgImage.hoverCursor = 'move';
          bgImage.moveCursor = 'move';
          bgImage.lockMovementX = false;
          bgImage.lockMovementY = false;
          bgImage.lockRotation = false;
          bgImage.lockScalingX = false;
          bgImage.lockScalingY = false;
          bgImage.lockUniScaling = false;
          bgImage.excludeFromExport = false;
          
          // Add properties that tui-image-editor expects
          bgImage.id = -999; // Use a special id for background image
          if (!bgImage.type) {
            bgImage.type = 'image';
          }
          if (!bgImage.group) {
            bgImage.group = null;
          }
          
          // Ensure the background image is in the canvas object list
          const objects = canvas.getObjects();
          const bgImageInList = objects.some((obj: any) => obj === bgImage);
          
          if (!bgImageInList) {
            console.log('Adding background image to canvas object list on load');
            // Add it to the canvas
            canvas.add(bgImage);
            // Make sure it's at the bottom
            canvas.sendToBack(bgImage);
          }
        }
        
        this.ensureCanvasSelectable();
        // Call resizeToWindow to ensure canvas size is correct after loading
        this.resizeToWindow();
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
    const bgImage = this.editor._graphics?.getCanvasImage();
    
    // Check if trying to delete background image
    if (activeObject && bgImage && activeObject === bgImage) {
      console.log('Preventing deletion of background image');
      return; // Don't delete background image
    }
    
    // Otherwise proceed with normal deletion
    if (activeObject && activeObject.id) {
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
      
      // Make background image selectable if it hasn't been deleted
      const bgImage = this.editor._graphics?.getCanvasImage();
      if (bgImage && !this.backgroundImageDeleted) {
        console.log('Making background image selectable');
        bgImage.selectable = true;
        bgImage.evented = true;
        bgImage.hasControls = true;
        bgImage.hasBorders = true;
        bgImage.hoverCursor = 'move';
      }
      
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
        // Ensure canvas size fits within container after loading
        setTimeout(() => {
          this.resizeToWindow();
        }, 300);
      })
      .catch((e: any) => {
        console.error('Failed to load AI image:', e);
        this.error.emit(new Error('Failed to load AI image'));
      });
  }
}
