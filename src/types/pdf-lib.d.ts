declare module "pdf-lib" {
  export class PDFDocument {
    static create(): Promise<PDFDocument>;
    static load(data: ArrayBuffer | Uint8Array, options?: { ignoreEncryption?: boolean }): Promise<PDFDocument>;
    getPageCount(): number;
    getPageIndices(): number[];
    copyPages(src: PDFDocument, indices: number[]): Promise<any[]>;
    addPage(page?: any): any;
    save(): Promise<Uint8Array<ArrayBuffer>>;
  }
}
