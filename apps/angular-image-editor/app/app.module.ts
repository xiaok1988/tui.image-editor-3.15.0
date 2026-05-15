import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';

// App Components
import { AppComponent } from './app.component';
import { ImageEditorComponent } from './image-editor/image-editor.component';
import { ToolbarComponent } from './toolbar/toolbar.component';
import { PropertiesPanelComponent } from './properties-panel/properties-panel.component';
import { AiPanelComponent } from './image-editor/ai-panel/ai-panel.component';

@NgModule({
  declarations: [
    AppComponent,
    ImageEditorComponent,
    ToolbarComponent,
    PropertiesPanelComponent,
    AiPanelComponent,
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    // Angular Material
    MatButtonModule,
    MatIconModule,
    MatSliderModule,
    MatInputModule,
    MatSelectModule,
    MatToolbarModule,
    MatSidenavModule,
    MatMenuModule,
    MatDividerModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatChipsModule,
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
