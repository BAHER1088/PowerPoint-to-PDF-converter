import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class FileUploadService {
  private readonly maxFileSize = 10 * 1024 * 1024; // 10MB in bytes
  private readonly validFileTypes = [
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ];

  constructor() { }

  /**
   * Validates if the file is a PowerPoint file (.ppt or .pptx)
   * @param file The file to validate
   * @returns True if the file is valid, false otherwise
   */
  validateFileType(file: File): boolean {
    return this.validFileTypes.includes(file.type) ||
           file.name.endsWith('.ppt') ||
           file.name.endsWith('.pptx');
  }

  /**
   * Validates if the file size is within the allowed limit
   * @param file The file to validate
   * @returns True if the file size is valid, false otherwise
   */
  validateFileSize(file: File): boolean {
    return file.size <= this.maxFileSize;
  }

  /**
   * Gets the file size in a human-readable format
   * @param bytes The file size in bytes
   * @returns The file size in a human-readable format (e.g., "2.5 MB")
   */
  getReadableFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Byte';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
