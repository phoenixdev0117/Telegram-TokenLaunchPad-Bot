import fs from 'fs';
import PDFDocument from 'pdfkit';

class PDFLogger {
  private doc: PDFKit.PDFDocument; // PDF Document instance
  private stream: fs.WriteStream; // Write stream for the PDF file
  private filePath: string;       // Path to save the PDF file

  constructor(filePath: string) {
    this.filePath = filePath;

    // Ensure the directory exists
    const dir = this.filePath.substring(0, this.filePath.lastIndexOf('/'));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true }); // Create directories if they don't exist
    }

    // Create a PDF document
    this.doc = new PDFDocument();
    this.stream = fs.createWriteStream(this.filePath);

    // Pipe the PDF document to the file stream
    this.doc.pipe(this.stream);
    this.doc.fontSize(12).text('Log File for Balances\n\n', { underline: true });
  }

  // Method to log a message
  log(message: string): void {
    // const timestamp = new Date().toISOString(); // Add timestamp
    this.doc.fontSize(10).text(`${message}`);
    console.log(`[LOG]: ${message}`); // Optional: Console log for debugging
  }

  // Method to finalize and save the PDF
  end(): void {
    this.doc.end(); // Finalize the PDF file
    this.stream.end(); // Close the stream
  }
}

export default PDFLogger;