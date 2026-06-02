FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy

# タイムゾーンとロケール設定
ENV TZ=Asia/Tokyo
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

WORKDIR /app

# 依存関係のインストール
COPY 03_SYSTEMS/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Chromiumのインストール (Playwright用)
RUN playwright install chromium

# ソースコードをコピー
COPY 01_INTEL/ ./01_INTEL/
COPY 03_SYSTEMS/ ./03_SYSTEMS/
COPY .env ./

# 永続化用のデータディレクトリ（外部からマウントすることを推奨）
# COPY .agent/playwright_data/ ./ .agent/playwright_data/

# デフォルトの起動コマンド
CMD ["python", "03_SYSTEMS/v2_CORE/monetization_loop.py"]
