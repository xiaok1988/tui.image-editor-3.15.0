import { Component, OnInit, ViewChild } from '@angular/core';
import { ImageEditorComponent } from './image-editor/image-editor.component';

export interface ToolbarAction {
  action: 'undo' | 'redo' | 'crop' | 'flipX' | 'flipY' | 'rotate' | 'clear' | 'save' | 'load';
}

export interface ObjectProperties {
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

// Creaition theme matching example01-includeUi.html
const CREAITION_THEME = {
  'common.bi.image': '',
  'common.bisize.width': '0px',
  'common.bisize.height': '0px',
  'common.backgroundImage': 'none',
  'common.backgroundColor': '#f0f0f0',
  'common.border': '0px',

  // header
  'header.backgroundImage': 'none',
  'header.backgroundColor': '#fff',
  'header.border': '0px',

  // load button
  'loadButton.backgroundColor': '#fff',
  'loadButton.border': '1px solid #ddd',
  'loadButton.color': 'black',
  'loadButton.fontFamily': "'Strokeweight 080', 'Eina03-Regular'",
  'loadButton.fontSize': '12px',
  'loadButton.fontVariationSettings': "'wght' var(--stroke-weight, 400)",

  // download button
  'downloadButton.backgroundColor': 'black',
  'downloadButton.border': '1px solid black',
  'downloadButton.color': '#fff',
  'downloadButton.fontFamily': "'Strokeweight 080', 'Eina03-Regular'",
  'downloadButton.fontSize': '12px',
  'downloadButton.fontVariationSettings': "'wght' var(--stroke-weight, 400)",

  // main icons
  'menu.backgroundColor': '#f0f0f0',
  'menu.normalIcon.color': '#000',
  'menu.activeIcon.color': '#000',
  'menu.disabledIcon.color': '#000',
  'menu.hoverIcon.color': '#bebebe',
  'menu.iconSize.width': '24px',
  'menu.iconSize.height': '24px',

  // submenu icons
  'submenu.normalIcon.color': '#8a8a8a',
  'submenu.activeIcon.color': '#e9e9e9',
  'submenu.iconSize.width': '32px',
  'submenu.iconSize.height': '32px',

  // submenu primary color
  'submenu.backgroundColor': '#fff',
  'submenu.partition.color': '#000',

  // submenu labels
  'submenu.normalLabel.color': '#8a8a8a',
  'submenu.normalLabel.fontWeight': 'lighter',
  'submenu.normalLabel.fontVariationSettings': "'wght' var(--stroke-weight, 400)",
  'submenu.activeLabel.color': '#000',
  'submenu.activeLabel.fontWeight': 'lighter',
  'submenu.activeLabel.fontVariationSettings': "'wght' var(--stroke-weight, 400)",

  // checkbox style
  'checkbox.border': '0px',
  'checkbox.backgroundColor': '#fff',

  // range style
  'range.pointer.color': '#fff',
  'range.bar.color': '#666',
  'range.subbar.color': '#d1d1d1',

  'range.disabledPointer.color': '#414141',
  'range.disabledBar.color': '#282828',
  'range.disabledSubbar.color': '#414141',

  'range.value.color': '#000',
  'range.value.fontWeight': 'lighter',
  'range.value.fontSize': '11px',
  'range.value.fontFamily': "'Strokeweight 080', 'Eina03-Regular'",
  'range.value.fontVariationSettings': "'wght' var(--stroke-weight, 400)",
  'range.value.border': '1px solid #353535',
  'range.value.backgroundColor': '#151515',
  'range.title.color': '#000',
  'range.title.fontWeight': 'lighter',
  'range.title.fontFamily': "'Strokeweight 080', 'Eina03-Regular'",
  'range.title.fontVariationSettings': "'wght' var(--stroke-weight, 400)",

  // colorpicker style
  'colorpicker.button.border': '1px solid #1e1e1e',
  'colorpicker.button.fontFamily': "'Strokeweight 080', 'Eina03-Regular'",
  'colorpicker.button.fontSize': '12px',
  'colorpicker.button.fontVariationSettings': "'wght' var(--stroke-weight, 400)",
  'colorpicker.title.color': '#000',
  'colorpicker.title.fontFamily': "'Strokeweight 080', 'Eina03-Regular'",
  'colorpicker.title.fontSize': '12px',
  'colorpicker.title.fontVariationSettings': "'wght' var(--stroke-weight, 400)",
};

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  // Theme matching example01-includeUi.html
  editorTheme = CREAITION_THEME;

  // Menu items
  menuItems = ['crop', 'flip', 'rotate', 'draw', 'shape', 'icon', 'text', 'filter'];

  // Reference to the image editor component
  @ViewChild('imageEditor') imageEditor!: ImageEditorComponent;

  // Current active submenu
  currentSubmenu: string | null = null;

  // Selected object properties for the properties panel
  selectedObjectProperties: ObjectProperties | null = null;

  ngOnInit(): void {
    // Initialization handled by ImageEditorComponent
  }

  onImageLoaded(info: { width: number; height: number }): void {
    console.log('Image loaded:', info);
  }

  onObjectAdded(obj: { id: number; type: string }): void {
    console.log('Object added:', obj);
  }

  onObjectSelected(obj: { id: number; type: string }): void {
    console.log('Object selected:', obj);
  }

  onObjectActivated(props: ObjectProperties): void {
    console.log('Object activated:', props);
    this.selectedObjectProperties = props;
  }

  onPropertiesChange(props: ObjectProperties): void {
    if (props.id && this.imageEditor) {
      this.imageEditor.updateObjectProperties(props.id, props as Partial<ObjectProperties>);
    }
  }

  onObjectRemoved(obj: { id: number }): void {
    console.log('Object removed:', obj);
    if (this.selectedObjectProperties?.id === obj.id) {
      this.selectedObjectProperties = null;
    }
  }

  onSubmenuChanged(event: { menuName: string | null }) {
    console.log('Submenu changed:', event.menuName);
    this.currentSubmenu = event.menuName;
    //this.imageEditor.setSubmenu(this.currentSubmenu);
  }

  /**
   * Activate a specific submenu
   * @param menuName - Name of the menu to activate
   */
  activateSubmenu(menuName: string): void {
    if (this.imageEditor) {
      this.imageEditor.setSubmenu(menuName);
    }
  }

  /**
   * Toggle a submenu (close if already open)
   * @param menuName - Name of the menu to toggle
   */
  toggleSubmenu(menuName: string): void {
    if (this.imageEditor) {
      this.imageEditor.setSubmenu(menuName, true);
    }
  }

  /**
   * Close the currently active submenu
   */
  closeSubmenu(): void {
    if (this.imageEditor) {
      this.imageEditor.hideAllSubmenus();
    }
  }

  /**
   * Check if a specific submenu is active
   * @param menuName - Name of the menu to check
   * @returns True if the menu is active
   */
  isSubmenuActive(menuName: string): boolean {
    return this.currentSubmenu === menuName;
  }

  /**
   * Get the name of the currently active submenu
   * @returns Current submenu name or null
   */
  getCurrentSubmenu(): string | null {
    return this.currentSubmenu;
  }

  /**
   * Handle toolbar actions
   */
  onToolbarAction(action: ToolbarAction): void {
    if (!this.imageEditor) return;

    switch (action.action) {
      case 'undo':
        this.imageEditor.undo();
        break;
      case 'redo':
        this.imageEditor.redo();
        break;
      case 'flipX':
        this.imageEditor.flipX();
        break;
      case 'flipY':
        this.imageEditor.flipY();
        break;
      case 'rotate':
        this.imageEditor.rotate(90);
        break;
      case 'clear':
        this.imageEditor.clearAll();
        break;
      case 'save':
        this.downloadImage();
        break;
    }
  }

  /**
   * Handle file selection for loading images
   */
  onFileSelected(file: File): void {
    if (this.imageEditor) {
      this.imageEditor.loadImageFromFile(file);
    }
  }

  /**
   * Download the edited image
   */
  downloadImage(): void {
    if (this.imageEditor) {
      const dataUrl = this.imageEditor.toDataURL({ format: 'png', quality: 1 });
      const link = document.createElement('a');
      link.download = 'edited-image.png';
      link.href = dataUrl;
      link.click();
    }
  }
}
