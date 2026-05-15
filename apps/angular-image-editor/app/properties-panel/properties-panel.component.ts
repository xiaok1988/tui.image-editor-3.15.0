import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { ObjectProperties } from '../app.component';

@Component({
  selector: 'app-properties-panel',
  templateUrl: './properties-panel.component.html',
  styleUrls: ['./properties-panel.component.scss']
})
export class PropertiesPanelComponent implements OnChanges {
  @Input() properties: ObjectProperties | null = null;
  @Input() isModal = false;

  @Output() propertiesChange = new EventEmitter<ObjectProperties>();
  @Output() close = new EventEmitter<void>();

  // Form values
  fillColor = '#000000';
  strokeColor = '#000000';
  strokeWidth = 1;
  fontSize = 14;
  fontFamily = 'Arial';
  fontWeight = 'normal';
  textAlign = 'left';
  opacity = 1;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['properties'] && this.properties) {
      this.fillColor = this.properties.fill || '#000000';
      this.strokeColor = this.properties.stroke || '#000000';
      this.strokeWidth = this.properties.strokeWidth || 1;
      this.fontSize = this.properties.fontSize || 14;
      this.fontFamily = this.properties.fontFamily || 'Arial';
      this.fontWeight = this.properties.fontWeight || 'normal';
      this.textAlign = this.properties.textAlign || 'left';
      this.opacity = this.properties.opacity || 1;
    }
  }

  onPropertyChange(): void {
    const updated: ObjectProperties = {
      ...this.properties,
      fill: this.fillColor,
      stroke: this.strokeColor,
      strokeWidth: this.strokeWidth,
      fontSize: this.fontSize,
      fontFamily: this.fontFamily,
      fontWeight: this.fontWeight,
      textAlign: this.textAlign,
      opacity: this.opacity
    };
    this.propertiesChange.emit(updated);
  }

  onClose(): void {
    this.close.emit();
  }

  get hasTextProperties(): boolean {
    return this.properties?.type === 'iText' || this.properties?.type === 'text';
  }

  get hasShapeProperties(): boolean {
    const type = this.properties?.type;
    return type === 'rect' || type === 'circle' || type === 'triangle' || type === 'line';
  }

  get hasImageProperties(): boolean {
    return this.properties?.type === 'image';
  }
}
