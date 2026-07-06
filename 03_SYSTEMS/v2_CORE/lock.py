import socket
import sys
import logging

logger = logging.getLogger("SocketLock")

class SocketLock:
    def __init__(self, port: int, name: str = "Process"):
        self.port = port
        self.name = name
        self.lock_socket = None

    def acquire(self) -> bool:
        try:
            # TCP ソケットを作成してループバックアドレスの特定ポートにバインド
            self.lock_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            # SO_REUSEADDRは設定しないことで、完全に排他的にバインドする
            self.lock_socket.bind(("127.0.0.1", self.port))
            # 接続待ち(listen)はせず、ソケットを保持し続けるだけで排他ロックとなる
            logger.info(f"🔒 {self.name} の排他ロック（ポート: {self.port}）を確保しました。")
            return True
        except socket.error:
            logger.error(f"❌ 多重起動を検知しました: {self.name} はすでに起動しています（ポート {self.port} が使用中）。プロセスを終了します。")
            self.lock_socket = None
            return False

    def release(self):
        if self.lock_socket:
            try:
                self.lock_socket.close()
                logger.info(f"🔓 {self.name} の排他ロック（ポート: {self.port}）を解放しました。")
            except Exception:
                pass
            self.lock_socket = None
