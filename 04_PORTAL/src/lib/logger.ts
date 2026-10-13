/**
 * 📢 Sovereign OS 統一ロガー (Logger Utility)
 *
 * あすらぼ氏の「Talker」思想に基づく、クライアント/サーバー両対応の統一ロギング基盤。
 * - 開発環境: コンソールに視認性の高いログを出力
 * - 本番環境: デバッグログ (debug) を自動抑制し、内部情報の露出を防止
 * - サーバーサイドのエラー: Discord #エラーログ (notifyPortalError) と自動連携
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerOptions {
  app?: '04' | '05';
  source?: 'API' | 'CLIENT' | 'CRON' | 'SERVER_ACTION' | 'TASK';
  context?: Record<string, any>;
}

class Logger {
  private app: '04' | '05';
  private isProd: boolean;

  constructor(app: '04' | '05' = '04') {
    this.app = app;
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
   * 🚨 エラーログ（サーバー環境ではDiscord #エラーログ へ自動連携）
   */
  error(message: string, error?: any, options?: LoggerOptions): void {
    const formatted = this.formatMessage('🚨 [ERROR]', message);
    console.error(formatted, error ?? '');

    // サーバーサイドかつNode.js環境の場合のみ、Discordへの転送を試みる
    if (typeof window === 'undefined') {
      try {
        // 循環依存を避けるため動的import
        import('./discordNotify')
          .then(({ notifyPortalError }) => {
            notifyPortalError({
              error: error || new Error(message),
              app: options?.app || this.app,
              source: options?.source || 'SERVER_ACTION',
              path: typeof error === 'object' && error?.path ? error.path : message,
              context: {
                ...(options?.context || {}),
                loggedMessage: message,
              },
            }).catch(() => {
              // Discord通知失敗時は二次エラーを出さず静かにフォールバック
            });
          })
          .catch(() => {
            // モジュール読み込み失敗時は無視
          });
      } catch {
        // フォールバック
      }
    }
  }
}

export const logger = new Logger('04');
