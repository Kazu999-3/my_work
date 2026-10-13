/**
 * 📢 Sovereign OS 統一ロガー (Logger Utility) - 05_PILOT版
 *
 * あすらぼ氏の「Talker」思想に基づく、クライアント/サーバー両対応の統一ロギング基盤。
 * - 開発環境: コンソールに視認性の高いログを出力
 * - 本番環境: デバッグログ (debug) を自動抑制し、内部情報の露出を防止
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerOptions {
  source?: string;
  context?: Record<string, any>;
}

class Logger {
  private app = '05';
  private isProd: boolean;

  constructor() {
    this.isProd = process.env.NODE_ENV === 'production';
  }

  private formatMessage(prefix: string, message: string): string {
    const timestamp = new Date().toLocaleTimeString('ja-JP', { hour12: false });
    return `[${timestamp}] [${this.app}] ${prefix} ${message}`;
  }

  /**
   * 🔍 デバッグログ（本番環境では自動サプレス）
   */
  debug(message: string, ...args: any[]): void {
    if (this.isProd) return;
    console.debug(this.formatMessage('🔍 [DEBUG]', message), ...args);
  }

  /**
   * ℹ️ 通常インフォメーションログ
   */
  info(message: string, ...args: any[]): void {
    console.info(this.formatMessage('ℹ️ [INFO]', message), ...args);
  }

  /**
   * ⚠️ 警告ログ
   */
  warn(message: string, ...args: any[]): void {
    console.warn(this.formatMessage('⚠️ [WARN]', message), ...args);
  }

  /**
   * 🚨 エラーログ
   */
  error(message: string, error?: any, options?: LoggerOptions): void {
    const formatted = this.formatMessage('🚨 [ERROR]', message);
    console.error(formatted, error ?? '');

    // 将来的な外部通知（04ポータルAPI転送等）の拡張スロット
    if (typeof window === 'undefined') {
      const webhookUrl = process.env.DISCORD_ERROR_WEBHOOK_URL;
      if (webhookUrl) {
        try {
          fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              embeds: [
                {
                  title: `🚨 [05_PILOT] ${message.slice(0, 200)}`,
                  description: error instanceof Error ? `\`\`\`\n${error.stack?.slice(0, 1000)}\n\`\`\`` : String(error || ''),
                  color: 0xef4444,
                  footer: { text: options?.source || 'LOGGER' },
                  timestamp: new Date().toISOString(),
                },
              ],
            }),
          }).catch(() => {});
        } catch {
          // フォールバック
        }
      }
    }
  }
}

export const logger = new Logger();
