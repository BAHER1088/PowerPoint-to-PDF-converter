import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ConversionService {
  private apiUrl = 'http://localhost:3000/api/convert';

  constructor(private http: HttpClient) { }

  /**
   * Converts a PowerPoint file to PDF using the backend API
   * @param file The PowerPoint file to convert
   * @returns An Observable that emits the converted PDF file as a Blob
   */
  convertToPdf(file: File): Observable<Blob> {
    // Validate file type
    if (!this.isValidPowerPointFile(file)) {
      return throwError(() => new Error('Invalid file type. Please upload a PowerPoint file (.ppt or .pptx)'));
    }

    // Validate file size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
      return throwError(() => new Error('File size exceeds 50MB limit'));
    }

    // Create a FormData object to send the file
    const formData = new FormData();
    formData.append('file', file);

    // Make the HTTP request to the backend API
    return this.http.post(this.apiUrl, formData, {
      responseType: 'blob',
      observe: 'response'
    }).pipe(
      map(response => {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/pdf')) {
          return response.body as Blob;
        } else {
          throw new Error('Invalid response type from server');
        }
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Validates if the file is a PowerPoint file
   * @param file The file to validate
   * @returns boolean indicating if the file is valid
   */
  private isValidPowerPointFile(file: File): boolean {
    const validTypes = [
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ];
    const validExtensions = ['.ppt', '.pptx'];
    
    return validTypes.includes(file.type) || 
           validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
  }

  /**
   * Handles HTTP errors
   * @param error The error to handle
   * @returns An Observable that emits an error
   */
  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An error occurred during conversion';
    
    if (error.error instanceof Blob) {
      // Try to read the error message from the blob
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const errorResponse = JSON.parse(reader.result as string);
          errorMessage = errorResponse.details || errorResponse.error || errorMessage;
        } catch (e) {
          console.error('Error parsing error response:', e);
        }
      };
      reader.readAsText(error.error);
    } else if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = error.error.message;
    } else {
      // Server-side error
      errorMessage = error.error?.details || error.error?.error || error.message;
    }

    console.error('Conversion error:', error);
    return throwError(() => new Error(errorMessage));
  }

  /**
   * Fallback method to generate a simple PDF in the frontend
   * @param file The original file
   * @param observer The Observable observer
   */
  private fallbackToPdfGeneration(file: File, observer: any): void {
    console.log('Falling back to frontend PDF generation...');
    try {
      // Create a simple PDF with information about the file
      const pdfContent = this.createSimplePdf(file.name);
      const pdfBlob = new Blob([pdfContent], { type: 'application/pdf' });

      // Emit the PDF blob
      observer.next(pdfBlob);
      observer.complete();
    } catch (error) {
      console.error('Error in fallback PDF creation:', error);
      observer.error(new Error('Failed to create PDF. Please try again.'));
    }
  }

  /**
   * Creates a simple PDF document
   * @param fileName The name of the original file
   * @returns A Uint8Array containing a valid PDF
   */
  private createSimplePdf(fileName: string): Uint8Array {
    // This is a minimal valid PDF structure
    const pdfHeader = '%PDF-1.7\n';

    // Object 1 - Catalog
    const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';

    // Object 2 - Pages
    const obj2 = '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';

    // Object 3 - Page
    const obj3 = '3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources 4 0 R /MediaBox [0 0 612 792] /Contents 5 0 R >>\nendobj\n';

    // Object 4 - Resources
    const obj4 = '4 0 obj\n<< /Font << /F1 6 0 R >> >>\nendobj\n';

    // Object 5 - Contents
    const content = `PowerPoint to PDF Conversion\n\nOriginal file: ${fileName}\n\nConverted on: ${new Date().toLocaleString()}`;
    const contentStream = `5 0 obj\n<< /Length ${content.length + 100} >>\nstream\nBT\n/F1 12 Tf\n50 700 Td\n(${content.replace(/\n/g, ') Tj\nT* (')}) Tj\nET\nendstream\nendobj\n`;

    // Object 6 - Font
    const obj6 = '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n';

    // xref table
    const xrefPosition = pdfHeader.length + obj1.length + obj2.length + obj3.length + obj4.length + contentStream.length + obj6.length;
    const xref = `xref\n0 7\n0000000000 65535 f\n0000000010 00000 n\n0000000060 00000 n\n0000000120 00000 n\n0000000220 00000 n\n0000000270 00000 n\n0000000${xrefPosition - 100} 00000 n\n`;

    // trailer
    const trailer = `trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xrefPosition}\n%%EOF`;

    // Combine all parts
    const pdfString = pdfHeader + obj1 + obj2 + obj3 + obj4 + contentStream + obj6 + xref + trailer;

    // Convert string to Uint8Array
    const encoder = new TextEncoder();
    return encoder.encode(pdfString);
  }

  /**
   * Downloads a PDF file
   * @param pdfBlob The PDF file as a Blob
   * @param fileName The name to give to the downloaded file
   */
  downloadPdf(pdfBlob: Blob, fileName: string): void {
    // Create a URL for the blob
    const url = URL.createObjectURL(pdfBlob);

    // Create a link element
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName.replace(/\.(ppt|pptx)$/i, '.pdf');

    // Append to the document, click it, and remove it
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Release the URL object
    URL.revokeObjectURL(url);
  }
}
