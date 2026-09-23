// The package ships no TypeScript types (no `types` field in its package.json),
// so this ambient declaration describes the small surface we actually use.
declare module 'google-news-url-decoder' {
  export interface GoogleNewsDecodeResult {
    status: boolean;
    decoded_url?: string;
    source_url?: string;
    message?: string;
  }

  export class GoogleDecoder {
    constructor(proxy?: string | null);
    decode(url: string): Promise<GoogleNewsDecodeResult>;
    decodeBatch(urls: string[]): Promise<GoogleNewsDecodeResult[]>;
  }
}
