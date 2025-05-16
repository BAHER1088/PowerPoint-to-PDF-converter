import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConversionService } from './services/conversion.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container mt-5">
      <h1 class="text-center mb-4">PowerPoint to PDF Converter</h1>
      
      <div class="card">
        <div class="card-body">
          <div class="mb-3">
            <label for="fileInput" class="form-label">Select PowerPoint File</label>
            <input 
              type="file" 
              class="form-control" 
              id="fileInput" 
              accept=".ppt,.pptx"
              (change)="onFileSelected($event)"
              [disabled]="isConverting"
            >
          </div>

          <div *ngIf="selectedFile" class="mb-3">
            <p>Selected file: {{ selectedFile.name }}</p>
            <p>Size: {{ (selectedFile.size / 1024 / 1024).toFixed(2) }} MB</p>
          </div>

          <div *ngIf="error" class="alert alert-danger">
            {{ error }}
          </div>

          <div *ngIf="isConverting" class="alert alert-info">
            Converting your file... Please wait.
          </div>

          <button 
            class="btn btn-primary" 
            (click)="convertFile()"
            [disabled]="!selectedFile || isConverting"
          >
            {{ isConverting ? 'Converting...' : 'Convert to PDF' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .container {
      max-width: 600px;
    }
    .card {
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .btn-primary {
      width: 100%;
    }
  `]
})
export class AppComponent {
  selectedFile: File | null = null;
  isConverting = false;
  error: string | null = null;

  constructor(private conversionService: ConversionService) {}

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      this.error = null;
    }
  }

  convertFile(): void {
    if (!this.selectedFile) {
      this.error = 'Please select a file first';
      return;
    }

    this.isConverting = true;
    this.error = null;

    this.conversionService.convertToPdf(this.selectedFile).subscribe({
      next: (pdfBlob: Blob) => {
        // Create a download link
        const url = window.URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = this.selectedFile!.name.replace(/\.(ppt|pptx)$/i, '.pdf');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        // Reset state
        this.isConverting = false;
        this.selectedFile = null;
        const fileInput = document.getElementById('fileInput') as HTMLInputElement;
        if (fileInput) {
          fileInput.value = '';
        }
      },
      error: (error: Error) => {
        this.error = error.message;
        this.isConverting = false;
      }
    });
  }
}
