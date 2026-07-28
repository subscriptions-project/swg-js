export interface PreferredSourceButtonOptions {
  lang?: string;
  theme?: 'light' | 'dark';
}

export interface PreferredSourceApi {
  init(options?: PreferredSourceButtonOptions): void;
  addPreferredSource(): void;
}
