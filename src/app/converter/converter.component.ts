import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LoadingSpinnerComponent } from '../shared/loading-spinner/loading-spinner.component';
import { FileUploadService } from '../services/file-upload.service';
import { ConversionService } from '../services/conversion.service';

@Component({
  selector: 'app-converter',
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingSpinnerComponent],
  templateUrl: './converter.component.html',
  styleUrl: './converter.component.scss'
})
export class ConverterComponent {
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  selectedFile: File | null = null;
  conversionStatus = '';
  uploadProgress = 0;

  constructor(
    private fileUploadService: FileUploadService,
    private conversionService: ConversionService
  ) {}

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];

      // Check file type
      if (!this.fileUploadService.validateFileType(file)) {
        this.errorMessage = 'Please select a PowerPoint file (.ppt or .pptx)';
        this.selectedFile = null;
        return;
      }

      // Check file size
      if (!this.fileUploadService.validateFileSize(file)) {
        this.errorMessage = 'File size exceeds the maximum limit of 10MB';
        this.selectedFile = null;
        return;
      }

      this.selectedFile = file;
      this.errorMessage = '';
      this.successMessage = '';
    }
  }

  convertToPdf(): void {
    if (!this.selectedFile) {
      this.errorMessage = 'Please select a file first';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.conversionStatus = 'Uploading file to server...';
    this.uploadProgress = 0;

    // Simulate progress updates
    const progressInterval = setInterval(() => {
      if (this.uploadProgress < 90) {
        this.uploadProgress += 10;

        // Update status message based on progress
        if (this.uploadProgress >= 30 && this.uploadProgress < 60) {
          this.conversionStatus = 'Processing PowerPoint file...';
        } else if (this.uploadProgress >= 60 && this.uploadProgress < 90) {
          this.conversionStatus = 'Converting to PDF...';
        }
      }
    }, 500);

    // Call the conversion service
    this.conversionService.convertToPdf(this.selectedFile).subscribe({
      next: (pdfBlob) => {
        // Complete the progress bar
        this.uploadProgress = 100;
        this.conversionStatus = 'Finalizing...';

        // Clear the interval
        clearInterval(progressInterval);

        // Short delay before showing success message
        setTimeout(() => {
          this.isLoading = false;
          this.conversionStatus = '';
          this.successMessage = 'Conversion successful! Downloading PDF...';

          // Download the PDF
          this.conversionService.downloadPdf(pdfBlob, this.selectedFile!.name);
        }, 500);
      },
      error: (error) => {
        // Clear the interval
        clearInterval(progressInterval);

        this.isLoading = false;
        this.conversionStatus = '';
        this.uploadProgress = 0;
        this.errorMessage = error.message || 'An error occurred during conversion. Please try again.';
        console.error('Conversion error:', error);
      }
    });
  }
}
