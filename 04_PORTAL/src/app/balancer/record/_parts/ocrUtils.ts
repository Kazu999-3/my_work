import type { PlayerPoolItem, ChampionItem } from './types';

export const OCR_ALIAS_STORAGE_KEY = 'ktm_ocr_player_aliases_v1';

// OCR誤認識の別名マッピングを取得
export const getOcrAliases = (): Record<string, string> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(OCR_ALIAS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

// OCR誤認識の別名マッピングを保存・学習
export const saveOcrAlias = (ocrExtractedName: string, registeredName: string) => {
  if (typeof window === 'undefined' || !ocrExtractedName || !registeredName) return;
  const cleanExtracted = ocrExtractedName.toLowerCase().replace(/[^a-z0-9ぁ-んァ-ヶ一-龠]/g, '');
  if (!cleanExtracted) return;
  try {
    const current = getOcrAliases();
    current[cleanExtracted] = registeredName;
    localStorage.setItem(OCR_ALIAS_STORAGE_KEY, JSON.stringify(current));
    // クラウド（DB）へも非同期で自動同期
    fetch('/api/admin/ocr-aliases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: cleanExtracted, target: registeredName }),
    }).catch(() => {});
  } catch (err) {
    console.warn('OCRエイリアスの保存に失敗:', err);
  }
};

/** "28:14" / "28" → 秒。空・不正・現実的でない値（3分未満・2時間超）は undefined（＝送らない） */
export const parseDurationText = (text: string): number | undefined => {
  const t = text.trim();
  if (!t) return undefined;
  const m = t.match(/^(\d{1,3})(?::(\d{1,2}))?$/);
  if (!m) return undefined;
  const sec = Number(m[1]) * 60 + (m[2] ? Number(m[2]) : 0);
  return sec >= 180 && sec <= 7200 ? sec : undefined;
};

// プレイヤー名曖昧マッチング（学習済みエイリアス辞書 ➔ 完全一致 ➔ 部分一致）
export const matchPlayer = (extractedName: string, pool: PlayerPoolItem[]): string => {
  if (!extractedName) return '';
  const cleanExtracted = extractedName.toLowerCase().replace(/[^a-z0-9ぁ-んァ-ヶ一-龠]/g, '');
  if (!cleanExtracted) return '';

  // 0. 学習済みOCR誤認識辞書（過去の修正履歴）から最優先で解決
  const aliases = getOcrAliases();
  if (aliases[cleanExtracted]) {
    const aliasTarget = aliases[cleanExtracted];
    if (pool.some((p) => p.name === aliasTarget)) {
      return aliasTarget;
    }
  }

  // 1. 完全一致（記号除外後）
  for (const p of pool) {
    const cleanName = p.name.toLowerCase().replace(/[^a-z0-9ぁ-んァ-ヶ一-龠]/g, '');
    const cleanIgn = (p.ign || '').toLowerCase().replace(/[^a-z0-9ぁ-んァ-ヶ一-龠]/g, '');

    if (cleanName === cleanExtracted || (p.ign && cleanIgn === cleanExtracted)) {
      return p.name;
    }
  }

  // 2. 部分一致
  for (const p of pool) {
    const cleanName = p.name.toLowerCase().replace(/[^a-z0-9ぁ-んァ-ヶ一-龠]/g, '');
    const cleanIgn = (p.ign || '').toLowerCase().replace(/[^a-z0-9ぁ-んァ-ヶ一-龠]/g, '');

    if (
      cleanName.includes(cleanExtracted) ||
      cleanExtracted.includes(cleanName) ||
      (p.ign && (cleanIgn.includes(cleanExtracted) || cleanExtracted.includes(cleanIgn)))
    ) {
      return p.name;
    }
  }

  return '';
};

// チャンピオン曖昧マッチング
export const matchChampion = (extractedChamp: string, list: ChampionItem[]): string => {
  if (!extractedChamp) return '';
  const cleanExtracted = extractedChamp.toLowerCase().replace(/[^a-z0-9ぁ-んァ-ヶ一-龠]/g, '');

  // 1. Ddragon ID (id) との一致を検索
  for (const c of list) {
    const cleanId = c.id.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanId === cleanExtracted) {
      return c.id;
    }
  }

  // 2. 日本語名 (name) との一致を検索
  for (const c of list) {
    const cleanName = c.name.toLowerCase().replace(/[^a-z0-9ぁ-んァ-ヶ一-龠]/g, '');
    if (cleanName === cleanExtracted) {
      return c.id;
    }
  }

  return '';
};

// 画像をCanvasで最大幅1280pxにリサイズ＆圧縮してBase64文字列を生成
export const resizeAndCompressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new window.Image();
      img.onerror = reject;
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const maxW = 1280;
          let w = img.width;
          let h = img.height;
          if (w > maxW) {
            h = Math.round((h * maxW) / w);
            w = maxW;
          }
          canvas.width = w;
          canvas.height = h;

          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        } catch (err) {
          reject(err);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};
