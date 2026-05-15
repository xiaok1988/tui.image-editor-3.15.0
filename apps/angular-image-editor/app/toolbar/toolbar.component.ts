import { Component, Input, Output, EventEmitter } from '@angular/core';
import { ToolbarAction } from '../app.component';

export interface ToolbarButton {
  icon: string;
  action: ToolbarAction['action'];
  tooltip: string;
}

@Component({
  selector: 'app-toolbar',
  templateUrl: './toolbar.component.html',
  styleUrls: ['./toolbar.component.scss']
})
export class ToolbarComponent {
  @Input() disabled = false;
  @Input() hasUndo = false;
  @Input() hasRedo = false;

  @Output() action = new EventEmitter<ToolbarAction>();
  @Output() fileSelected = new EventEmitter<File>();

  // Tool buttons
  toolButtons: ToolbarButton[] = [
    { icon: 'undo', action: 'undo', tooltip: 'Undo' },
    { icon: 'redo', action: 'redo', tooltip: 'Redo' },
  ];

  // Transform buttons
  transformButtons: ToolbarButton[] = [
    { icon: 'flip', action: 'flipX', tooltip: 'Flip Horizontal' },
    { icon: 'flip', action: 'flipY', tooltip: 'Flip Vertical' },
    { icon: 'rotate_right', action: 'rotate', tooltip: 'Rotate 90°' },
  ];

  // Action buttons
  actionButtons: ToolbarButton[] = [
    { icon: 'delete_outline', action: 'clear', tooltip: 'Clear' },
  ];

  onAction(action: ToolbarAction['action']): void {
    this.action.emit({ action });
  }

  triggerFileInput(): void {
    const input = document.getElementById('file-input') as HTMLInputElement;
    input?.click();
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (file) {
      this.fileSelected.emit(file);
      // Reset input so same file can be selected again
      input.value = '';
    }
  }

  onSave(): void {
    this.action.emit({ action: 'save' });
  }

  isToolButtonDisabled(button: ToolbarButton): boolean {
    if (this.disabled) return true;
    if (button.action === 'undo' && !this.hasUndo) return true;
    if (button.action === 'redo' && !this.hasRedo) return true;
    return false;
  }
}
