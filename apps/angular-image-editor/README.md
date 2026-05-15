# @creaition/angular-image-editor

Angular 17 components wrapping Tui.ImageEditor with Creaition custom styles.

## Features

- **Responsive Design**: Mobile-first approach with breakpoints (sm: 640px, md: 768px, lg: 1024px, xl: 1280px)
- **Toolbar**: Collapses on mobile, full controls on desktop
- **Properties Panel**: Side panel on desktop, modal on mobile
- **Creaition Styling**: Custom button styles, typography, and theme
- **Material Design**: Built with Angular Material components

## Components

### ImageEditorComponent
Main wrapper for Tui.ImageEditor with Angular integration.

```html
<app-image-editor
  [theme]="customTheme"
  [menu]="menuItems"
  (imageLoaded)="onImageLoaded($event)"
  (objectSelected)="onObjectSelected($event)"
>
</app-image-editor>
```

### ToolbarComponent
Responsive toolbar with Creaition button styles.

```html
<app-toolbar
  [hasUndo]="hasUndo"
  [hasRedo]="hasRedo"
  (action)="onToolbarAction($event)"
  (fileSelected)="onFileSelected($event)"
>
</app-toolbar>
```

### PropertiesPanelComponent
Properties editor panel that adapts to screen size.

```html
<app-properties-panel
  [properties]="selectedObject"
  [isModal]="isMobile"
  (propertiesChange)="onPropertiesChange($event)"
>
</app-properties-panel>
```

## Responsive Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| sm | < 640px | Compact toolbar, modal panel |
| md | 640-767px | Full toolbar, modal panel |
| lg | 768-1023px | Full toolbar, side panel |
| xl | >= 1024px | Full toolbar, side panel |

## Installation

```bash
npm install
npm start
```

## Usage

### Standalone Usage
```typescript
import { ImageEditorComponent } from '@creaition/angular-image-editor';

@Component({
  standalone: true,
  imports: [ImageEditorComponent],
  template: `<app-image-editor></app-image-editor>`
})
export class MyComponent {}
```

### Module Usage
```typescript
import { AppModule } from '@creaition/angular-image-editor';

@NgModule({
  imports: [AppModule]
})
export class MyModule {}
```

## Customization

### Theme
Override the default theme by passing a custom theme object:

```typescript
const customTheme = {
  'common.backgroundColor': '#1a1a1a',
  'menu.backgroundColor': '#2a2a2a',
  // ...
};
```

### Button Styles
Creaition uses custom button styles defined in `styles.scss`:
- `.btn-creaition-primary`: Black background, white text
- `.btn-creaition-secondary`: White background, black border
- `.btn-creaition-icon`: Icon-only buttons with rounded style

## License

MIT
