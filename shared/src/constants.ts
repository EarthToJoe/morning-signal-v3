import { SectionNames, NewsletterTheme } from './types';

export const DEFAULT_SECTION_NAMES: SectionNames = {
  lead: 'Lead Story',
  briefing: 'Quick Hits',
  watch: 'Watch List',
};

export const DEFAULT_EXCLUDED_DOMAINS = [
  'linkedin.com', 'facebook.com', 'twitter.com', 'youtube.com',
];

export const DEFAULT_THEME: NewsletterTheme = {
  headerColor: '#0f3460',
  accentColor: '#0f3460',
  backgroundColor: '#f4f4f8',
  cardColor: '#ffffff',
  textColor: '#1a1a2e',
  footerColor: '#1a1a2e',
  fontFamily: "Georgia, 'Times New Roman', serif",
};

export const PRESET_THEMES: Record<string, NewsletterTheme> = {
  'professional-dark': { ...DEFAULT_THEME },
  'clean-light': {
    headerColor: '#2563eb', accentColor: '#2563eb', backgroundColor: '#f8fafc',
    cardColor: '#ffffff', textColor: '#334155', footerColor: '#1e293b',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  'bold-crimson': {
    headerColor: '#991b1b', accentColor: '#dc2626', backgroundColor: '#fef2f2',
    cardColor: '#ffffff', textColor: '#1f2937', footerColor: '#450a0a',
    fontFamily: "Georgia, 'Times New Roman', serif",
  },
  'modern-slate': {
    headerColor: '#334155', accentColor: '#6366f1', backgroundColor: '#f1f5f9',
    cardColor: '#ffffff', textColor: '#1e293b', footerColor: '#0f172a',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  'warm-earth': {
    headerColor: '#78350f', accentColor: '#92400e', backgroundColor: '#fefce8',
    cardColor: '#ffffff', textColor: '#422006', footerColor: '#78350f',
    fontFamily: "Georgia, 'Times New Roman', serif",
  },
};

export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-5-nano': { input: 0.05, output: 0.40 },
  'gpt-5-mini': { input: 0.25, output: 2.00 },
  'gpt-5': { input: 1.25, output: 10.00 },
  'gpt-5.1': { input: 1.25, output: 10.00 },
  'gpt-5.2': { input: 1.75, output: 14.00 },
  'gpt-5.4': { input: 1.75, output: 14.00 },
};
