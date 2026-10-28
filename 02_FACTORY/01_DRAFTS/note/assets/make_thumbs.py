import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

font_bold = r"C:\Windows\Fonts\meiryob.ttc"
font_reg = r"C:\Windows\Fonts\meiryo.ttc"

# ==========================================
# 1. パターンA: 新規生成イラスト (1376x768) へのテキスト合成
# ==========================================
def create_pattern_a():
    gen_path = r"d:\my_work\02_FACTORY\01_DRAFTS\note\assets\profile_thumb_generated.jpg"
    base = Image.open(gen_path).convert("RGBA")
    W, H = base.size

    # 左側にモダンなフロストガラス（すりガラス）風の半透明カードを描画
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw_overlay = ImageDraw.Draw(overlay)

    # カード領域
    card_x0, card_y0 = int(W * 0.04), int(H * 0.08)
    card_x1, card_y1 = int(W * 0.54), int(H * 0.92)
    radius = 24

    # 影（ドロップシャドウ）
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw_shadow = ImageDraw.Draw(shadow)
    draw_shadow.rounded_rectangle(
        [card_x0 + 8, card_y0 + 10, card_x1 + 8, card_y1 + 10],
        radius=radius,
        fill=(0, 0, 0, 90)
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(12))
    base = Image.alpha_composite(base, shadow)

    # 白〜淡いオレンジの半透明カード本体
    draw_overlay.rounded_rectangle(
        [card_x0, card_y0, card_x1, card_y1],
        radius=radius,
        fill=(255, 255, 255, 235),
        outline=(255, 140, 0, 180),
        width=3
    )

    # 上部アクセントリボン「4ヶ月の沈黙を経て復帰！」
    ribbon_w, ribbon_h = int((card_x1 - card_x0) * 0.72), 38
    rx0, ry0 = card_x0 + 24, card_y0 + 20
    draw_overlay.rounded_rectangle(
        [rx0, ry0, rx0 + ribbon_w, ry0 + ribbon_h],
        radius=10,
        fill=(255, 107, 0, 240)
    )

    base = Image.alpha_composite(base, overlay)
    draw = ImageDraw.Draw(base)

    # フォント定義
    f_ribbon = ImageFont.truetype(font_bold, 19)
    f_title = ImageFont.truetype(font_bold, 36)
    f_num = ImageFont.truetype(font_bold, 22)
    f_item = ImageFont.truetype(font_bold, 21)
    f_sub = ImageFont.truetype(font_reg, 16)
    f_badge = ImageFont.truetype(font_bold, 20)

    # リボン文字
    draw.text((rx0 + 16, ry0 + 7), "⚡ 4ヶ月の沈黙を経て再始動！", font=f_ribbon, fill=(255, 255, 255, 255))

    # メイン見出し
    draw.text((card_x0 + 26, card_y0 + 70), "はじめまして！かずりんです！", font=f_title, fill=(30, 30, 35, 255))
    
    # 区切り線
    draw.line([(card_x0 + 26, card_y0 + 124), (card_x1 - 26, card_y0 + 124)], fill=(255, 140, 0, 160), width=2)

    # リスト項目 4つ
    items = [
        ("1", "昼はIT社会人 / 夜はプラチナJG", "自作ツールでLoL研究＆メタ分析"),
        ("2", "6月ブロンズ転落 ➔ 10月プラチナ昇格！", "諦めずに挑んだ4ヶ月の軌跡"),
        ("3", "相棒ザイラJG（勝率60.5%）", "129戦で這い上がった魂のメインチャンプ"),
        ("4", "治安重視コミュニティ「KTM」運営", "誰も責めない・安心して楽しめる居場所")
    ]

    curr_y = card_y0 + 140
    for num, title, sub in items:
        # 数字バッジ
        draw.ellipse([card_x0 + 26, curr_y, card_x0 + 60, curr_y + 34], fill=(255, 120, 0, 240))
        draw.text((card_x0 + 36, curr_y + 4), num, font=f_num, fill=(255, 255, 255, 255))
        
        # 項目タイトル
        draw.text((card_x0 + 72, curr_y + 4), title, font=f_item, fill=(35, 35, 40, 255))
        # サブ説明
        draw.text((card_x0 + 72, curr_y + 34), sub, font=f_sub, fill=(100, 100, 110, 255))

        curr_y += 72

    # フッタータグピル
    pills = ["#LoL", "#ザイラJG", "#プラチナ昇格", "#自作ツール"]
    px = card_x0 + 26
    py = card_y1 - 56
    f_pill = ImageFont.truetype(font_bold, 15)
    for p in pills:
        bbox = draw.textbbox((0, 0), p, font=f_pill)
        pw = bbox[2] - bbox[0] + 16
        draw.rounded_rectangle([px, py, px + pw, py + 28], radius=6, fill=(245, 240, 255, 255), outline=(180, 160, 220, 200), width=1)
        draw.text((px + 8, py + 4), p, font=f_pill, fill=(110, 70, 180, 255))
        px += pw + 10

    # 右下バッジ「祝・プラチナ昇格！ 自己紹介記事」
    badge_w, badge_h = 240, 60
    bx0, by0 = W - badge_w - 30, H - badge_h - 30
    draw.rounded_rectangle([bx0, by0, bx0 + badge_w, by0 + badge_h], radius=16, fill=(255, 215, 0, 245), outline=(255, 140, 0, 255), width=3)
    draw.text((bx0 + 24, by0 + 8), "✨ 祝・プラチナ昇格！", font=f_badge, fill=(40, 30, 0, 255))
    f_sub_badge = ImageFont.truetype(font_bold, 15)
    draw.text((bx0 + 44, by0 + 34), "最新 自己紹介記事", font=f_sub_badge, fill=(160, 60, 0, 255))

    out_path = r"d:\my_work\02_FACTORY\01_DRAFTS\note\assets\profile_thumb_pattern_A.jpg"
    base.convert("RGB").save(out_path, quality=95)
    print("Pattern A created:", out_path)

# ==========================================
# 2. パターンB: 元画像 (1024x571) の完全キャラ維持＋テキストカード刷新
# ==========================================
def create_pattern_b():
    orig_path = r"d:\my_work\02_FACTORY\01_DRAFTS\note\assets\profile_thumb_original.jpg"
    base = Image.open(orig_path).convert("RGBA")
    W, H = base.size  # 1024 x 571

    # 元画像の左側カード（概ね X: 30〜520, Y: 35〜535）をリフレッシュ
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw_overlay = ImageDraw.Draw(overlay)

    card_x0, card_y0 = 36, 40
    card_x1, card_y1 = 515, H - 40
    radius = 20

    # 既存の左側テキストカード部分を滑らかなホワイト〜淡いオレンジカードで覆う
    # まず周囲にソフトシャドウ
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw_shadow = ImageDraw.Draw(shadow)
    draw_shadow.rounded_rectangle([card_x0 + 6, card_y0 + 8, card_x1 + 6, card_y1 + 8], radius=radius, fill=(0, 0, 0, 70))
    shadow = shadow.filter(ImageFilter.GaussianBlur(10))
    base = Image.alpha_composite(base, shadow)

    # カード本体（高不透明度ホワイトで旧テキストを完全にカバー）
    draw_overlay.rounded_rectangle([card_x0, card_y0, card_x1, card_y1], radius=radius, fill=(255, 255, 255, 248), outline=(255, 140, 0, 200), width=3)

    # 上部オレンジ帯
    rx0, ry0 = card_x0 + 18, card_y0 + 16
    rw, rh = 340, 32
    draw_overlay.rounded_rectangle([rx0, ry0, rx0 + rw, ry0 + rh], radius=8, fill=(255, 107, 0, 245))

    base = Image.alpha_composite(base, overlay)
    draw = ImageDraw.Draw(base)

    f_ribbon = ImageFont.truetype(font_bold, 16)
    f_title = ImageFont.truetype(font_bold, 28)
    f_num = ImageFont.truetype(font_bold, 18)
    f_item = ImageFont.truetype(font_bold, 17)
    f_sub = ImageFont.truetype(font_reg, 13)

    # リボン
    draw.text((rx0 + 14, ry0 + 5), "⚡ 4ヶ月の沈黙を経て再始動！", font=f_ribbon, fill=(255, 255, 255, 255))

    # タイトル
    draw.text((card_x0 + 20, card_y0 + 56), "はじめまして！かずりんです！", font=f_title, fill=(25, 25, 30, 255))
    draw.line([(card_x0 + 20, card_y0 + 98), (card_x1 - 20, card_y0 + 98)], fill=(255, 140, 0, 180), width=2)

    # 4つのリスト項目
    items = [
        ("1", "昼はIT社会人 / 夜はプラチナJG", "自作ツールでLoL研究＆メタ分析"),
        ("2", "6月ブロンズ転落 ➔ プラチナ昇格！", "4ヶ月間諦めずに這い上がった軌跡"),
        ("3", "相棒ザイラJG（勝率60.5%）", "129戦で証明した魂のメインチャンプ"),
        ("4", "治安重視コミュニティ「KTM」運営", "誰も責めない・安心して楽しめる居場所")
    ]

    curr_y = card_y0 + 110
    for num, title, sub in items:
        draw.ellipse([card_x0 + 20, curr_y, card_x0 + 48, curr_y + 28], fill=(255, 120, 0, 240))
        draw.text((card_x0 + 28, curr_y + 3), num, font=f_num, fill=(255, 255, 255, 255))

        draw.text((card_x0 + 58, curr_y + 3), title, font=f_item, fill=(30, 30, 35, 255))
        draw.text((card_x0 + 58, curr_y + 28), sub, font=f_sub, fill=(90, 90, 100, 255))

        curr_y += 58

    # タグピル
    pills = ["#LoL", "#ザイラJG", "#プラチナ昇格", "#自作ツール"]
    px = card_x0 + 20
    py = card_y1 - 42
    f_pill = ImageFont.truetype(font_bold, 13)
    for p in pills:
        bbox = draw.textbbox((0, 0), p, font=f_pill)
        pw = bbox[2] - bbox[0] + 12
        draw.rounded_rectangle([px, py, px + pw, py + 24], radius=6, fill=(245, 240, 255, 255), outline=(180, 160, 220, 180), width=1)
        draw.text((px + 6, py + 3), p, font=f_pill, fill=(110, 70, 180, 255))
        px += pw + 8

    # 右下のバッジ（元画像の黄色バッジ位置を「最新 自己紹介記事！」に更新）
    # 元画像の右下バッジ位置：X: 800〜980, Y: 460〜530
    bx0, by0, bx1, by1 = 790, 470, 990, 535
    draw.rounded_rectangle([bx0, by0, bx1, by1], radius=14, fill=(255, 215, 0, 245), outline=(255, 140, 0, 255), width=2)
    f_badge1 = ImageFont.truetype(font_bold, 16)
    f_badge2 = ImageFont.truetype(font_bold, 13)
    draw.text((bx0 + 16, by0 + 8), "✨ 祝・プラチナ昇格！", font=f_badge1, fill=(40, 30, 0, 255))
    draw.text((bx0 + 28, by0 + 32), "最新 自己紹介記事", font=f_badge2, fill=(160, 60, 0, 255))

    out_path = r"d:\my_work\02_FACTORY\01_DRAFTS\note\assets\profile_thumb_pattern_B.jpg"
    base.convert("RGB").save(out_path, quality=95)
    print("Pattern B created:", out_path)

create_pattern_a()
create_pattern_b()

