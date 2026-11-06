import { registerPlugin } from '@capacitor/core';

interface SaveTextPdfOptions {
  filename: string;
  title: string;
  content: string;
}

interface SaveTextPdfResult {
  uri: string;
  location: string;
}

interface NativeDocumentPlugin {
  saveTextPdf(options: SaveTextPdfOptions): Promise<SaveTextPdfResult>;
}

const NativeDocument = registerPlugin<NativeDocumentPlugin>('NativeDocument');

export const nativeDocumentService = {
  saveTextPdf: (options: SaveTextPdfOptions) => NativeDocument.saveTextPdf(options)
};
