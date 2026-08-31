export interface PreferredSourceButtonOptions {
  lang?: string;
  theme?: 'light' | 'dark' | 'auto';
}

export interface PreferredSourceApi {
  init(options?: PreferredSourceButtonOptions): void;
  addPreferredSource(): void;
}
