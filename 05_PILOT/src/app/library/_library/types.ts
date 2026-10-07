// 攻略ライブラリ（/library）の型。
// 2026-10-07: page.tsx（796行）から分割。

type Freshness = 'fresh' | 'moderate' | 'stale';

export interface ArticleItem {
  id: number | string;
  title: string;
  champion?: string;
  channel?: string;
  char_count?: number;
  source_url?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
  published_at?: string | null;
  patch?: string;
  is_explicit_patch?: boolean;
  freshness?: Freshness;
  is_old_patch?: boolean;
  days_ago?: number;
  freshness_label?: string;
  freshness_color?: { bg: string; text: string; border: string };
}

export interface ArticleDetail {
  id: number | string;
  title: string;
  champion?: string;
  source_url?: string;
  tags?: string[];
  content?: string;
  raw_content?: string;
  created_at: string;
  published_at?: string | null;
  patch?: string;
  is_explicit_patch?: boolean;
  freshness?: Freshness;
  is_old_patch?: boolean;
  days_ago?: number;
  freshness_label?: string;
  freshness_color?: { bg: string; text: string; border: string };
}

export type LibraryCategory = 'lol' | 'general';
export type LibrarySort = 'date_desc' | 'published_desc' | 'volume_desc' | 'date_asc' | 'title_asc';
