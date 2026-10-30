import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

font_bold = r"C:\Windows\Fonts\meiryob.ttc"
font_reg = r"C:\Windows\Fonts\meiryo.ttc"

W, H = 1280, 720

def create_gradient(c_start, c_end):
    base = Image.new("RGBA", (W, H), c_start)
    top = Image.new("RGBA", (W, H), c_end)
    mask = Image.new("L", (W, H))
    mask_draw = ImageDraw.Draw(mask)
    for y in range(H):
        alpha = int(255 * (y / H))
        mask_draw.line([(0, y), (W, y)], fill=alpha)
    base.paste(top, (0, 0), mask)
    return base

def draw_card(base, card_x0, card_y0, card_x1, card_y1, radius=20, bg_color=(255, 255, 255, 245), border_color=(200, 200, 200, 255)):
    # 影
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow)
    s_draw.rounded_rectangle([card_x0+8, card_y0+10, card_x1+8, card_y1+10], radius=radius, fill=(0, 0, 0, 100))
    shadow = shadow.filter(ImageFilter.GaussianBlur(12))
    base = Image.alpha_composite(base, shadow)

    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    o_draw = ImageDraw.Draw(overlay)
    o_draw.rounded_rectangle([card_x0, card_y0, card_x1, card_y1], radius=radius, fill=bg_color, outline=border_color, width=3)
    base = Image.alpha_composite(base, overlay)
    return base

# ----------------------------------------------------
# 1. ザイラJG サムネイル (zyra_thumb.jpg)
# ----------------------------------------------------
def make_zyra_thumb():
    # ディープグリーン ➔ パープルブラック
    base = create_gradient((15, 35, 25, 255), (35, 10, 45, 255))
    
    # 装飾サークル（背景の光）
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    g_draw = ImageDraw.Draw(glow)
    g_draw.ellipse([800, -100, 1400, 500], fill=(120, 20, 160, 60))
    g_draw.ellipse([50, 400, 550, 900], fill=(20, 140, 60, 50))
    glow = glow.filter(ImageFilter.GaussianBlur(50))
    base = Image.alpha_composite(base, glow)

    # カード描画 (X: 60〜800)
    card_x0, card_y0, card_x1, card_y1 = 60, 60, 840, 660
    base = draw_card(base, card_x0, card_y0, card_x1, card_y1, radius=24, bg_color=(255, 255, 255, 248), border_color=(120, 40, 160, 220))
    draw = ImageDraw.Draw(base)

    f_ribbon = ImageFont.truetype(font_bold, 20)
    f_title = ImageFont.truetype(font_bold, 40)
    f_sub = ImageFont.truetype(font_bold, 22)
    f_item_num = ImageFont.truetype(font_bold, 20)
    f_item_text = ImageFont.truetype(font_bold, 21)
    f_item_sub = ImageFont.truetype(font_reg, 16)
    f_badge = ImageFont.truetype(font_bold, 24)

    # リボン帯「味方を捨てて一人で勝つ！」
    draw.rounded_rectangle([card_x0+30, card_y0+25, card_x0+420, card_y0+68], radius=10, fill=(130, 30, 170, 255))
    draw.text((card_x0+45, card_y0+32), "⚔️ 味方を捨てて一人で勝つ！", font=f_ribbon, fill=(255, 255, 255, 255))

    # メインタイトル
    draw.text((card_x0+30, card_y0+85), "ザイラJG 低ランク脱出攻略", font=f_title, fill=(25, 20, 35, 255))
    draw.line([(card_x0+30, card_y0+148), (card_x1-30, card_y0+148)], fill=(130, 30, 170, 180), width=3)

    # リスト項目 3つ
    items = [
        ("1", "0:41種固定 ➔ 2:25爆速フルクリア", "HP100%維持！スカトルに30秒先行する秒単位手順"),
        ("2", "5:00グラブ＆ドラゴンを単独消滅", "味方の寄りを待たずに一人でオブジェクトを削り切る"),
        ("3", "視界外からの「E-W-W-R」トラップ", "狭い通路で固まった敵集団をツルの海で即蒸発させる")
    ]
    curr_y = card_y0 + 170
    for num, title, desc in items:
        draw.ellipse([card_x0+30, curr_y, card_x0+68, curr_y+38], fill=(130, 30, 170, 240))
        draw.text((card_x0+42, curr_y+5), num, font=f_item_num, fill=(255, 255, 255, 255))
        draw.text((card_x0+82, curr_y+4), title, font=f_item_text, fill=(30, 25, 40, 255))
        draw.text((card_x0+82, curr_y+36), desc, font=f_item_sub, fill=(90, 85, 100, 255))
        curr_y += 82

    # フッターピル
    draw.rounded_rectangle([card_x0+30, card_y1-60, card_x0+300, card_y1-22], radius=8, fill=(245, 235, 255, 255), outline=(160, 100, 220, 200), width=1)
    draw.text((card_x0+42, card_y1-53), "⚡ 覇道(電撃/収穫) ✕ 栄華固定", font=ImageFont.truetype(font_bold, 16), fill=(100, 30, 150, 255))

    # 右側：巨大実績バッジパネル (X: 880〜1220)
    bx0, by0, bx1, by1 = 880, 140, 1220, 580
    base = draw_card(base, bx0, by0, bx1, by1, radius=24, bg_color=(255, 255, 255, 245), border_color=(255, 140, 0, 220))
    draw = ImageDraw.Draw(base)

    draw.rounded_rectangle([bx0+20, by0+25, bx1-20, by0+75], radius=12, fill=(255, 120, 0, 255))
    draw.text((bx0+45, by0+34), "🏆 リアル実戦データ", font=ImageFont.truetype(font_bold, 22), fill=(255, 255, 255, 255))

    draw.text((bx0+35, by0+105), "129戦", font=ImageFont.truetype(font_bold, 36), fill=(50, 40, 60, 255))
    draw.text((bx0+35, by0+155), "勝率 60.5%", font=ImageFont.truetype(font_bold, 44), fill=(220, 50, 30, 255))

    draw.line([(bx0+30, by0+230), (bx1-30, by0+230)], fill=(200, 200, 210, 200), width=2)
    draw.text((bx0+35, by0+250), "・KDA : 4.30", font=f_sub, fill=(40, 40, 50, 255))
    draw.text((bx0+35, by0+295), "・CS/m : 7.4", font=f_sub, fill=(40, 40, 50, 255))
    draw.text((bx0+35, by0+340), "・ブロンズ ➔ プラチナ昇格", font=f_sub, fill=(130, 30, 170, 255))

    out_p = r"d:\my_work\02_FACTORY\01_DRAFTS\note\assets\zyra_jg_thumb.jpg"
    base.convert("RGB").save(out_p, quality=95)
    print("Zyra thumb created:", out_p)

# ----------------------------------------------------
# 2. ウーコンJG サムネイル (wukong_thumb.jpg)
# ----------------------------------------------------
def make_wukong_thumb():
    # バーニングオレンジ ➔ ディープチャコール
    base = create_gradient((45, 20, 10, 255), (20, 20, 25, 255))
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    g_draw = ImageDraw.Draw(glow)
    g_draw.ellipse([750, 100, 1350, 700], fill=(240, 100, 20, 70))
    glow = glow.filter(ImageFilter.GaussianBlur(60))
    base = Image.alpha_composite(base, glow)

    card_x0, card_y0, card_x1, card_y1 = 60, 60, 840, 660
    base = draw_card(base, card_x0, card_y0, card_x1, card_y1, radius=24, bg_color=(255, 255, 255, 248), border_color=(255, 120, 0, 220))
    draw = ImageDraw.Draw(base)

    f_ribbon = ImageFont.truetype(font_bold, 20)
    f_title = ImageFont.truetype(font_bold, 40)
    f_sub = ImageFont.truetype(font_bold, 22)
    f_item_num = ImageFont.truetype(font_bold, 20)
    f_item_text = ImageFont.truetype(font_bold, 21)
    f_item_sub = ImageFont.truetype(font_reg, 16)

    # リボン帯
    draw.rounded_rectangle([card_x0+30, card_y0+25, card_x0+440, card_y0+68], radius=10, fill=(230, 85, 0, 255))
    draw.text((card_x0+45, card_y0+32), "🐒 味方がAP過多なら猿を出せ！", font=f_ribbon, fill=(255, 255, 255, 255))

    draw.text((card_x0+30, card_y0+85), "ウーコンJG 集団戦破壊論", font=f_title, fill=(35, 25, 20, 255))
    draw.line([(card_x0+30, card_y0+148), (card_x1-30, card_y0+148)], fill=(230, 85, 0, 180), width=3)

    items = [
        ("1", "Wデコイで敵スキルを空振りさせる", "ステルス接近から安全に敵キャリーの真横へ滑り込む"),
        ("2", "Rの「2回ノックアップ」という暴力", "1回目で跳ね上げ、Qを挟んで2回目で全員を完全機能停止"),
        ("3", "征服者 ✕ トリニティフォースAD型", "硬気功パッシブとサンダードスカイで殴り負けゼロ")
    ]
    curr_y = card_y0 + 170
    for num, title, desc in items:
        draw.ellipse([card_x0+30, curr_y, card_x0+68, curr_y+38], fill=(230, 85, 0, 240))
        draw.text((card_x0+42, curr_y+5), num, font=f_item_num, fill=(255, 255, 255, 255))
        draw.text((card_x0+82, curr_y+4), title, font=f_item_text, fill=(40, 30, 25, 255))
        draw.text((card_x0+82, curr_y+36), desc, font=f_item_sub, fill=(100, 90, 85, 255))
        curr_y += 82

    draw.rounded_rectangle([card_x0+30, card_y1-60, card_x0+320, card_y1-22], radius=8, fill=(255, 245, 235, 255), outline=(230, 120, 50, 200), width=1)
    draw.text((card_x0+42, card_y1-53), "⚡ 征服者 ✕ サンダードスカイ", font=ImageFont.truetype(font_bold, 16), fill=(180, 60, 0, 255))

    # 右側：バッジパネル
    bx0, by0, bx1, by1 = 880, 140, 1220, 580
    base = draw_card(base, bx0, by0, bx1, by1, radius=24, bg_color=(255, 255, 255, 245), border_color=(230, 85, 0, 220))
    draw = ImageDraw.Draw(base)

    draw.rounded_rectangle([bx0+20, by0+25, bx1-20, by0+75], radius=12, fill=(230, 85, 0, 255))
    draw.text((bx0+45, by0+34), "🏆 リアル実戦データ", font=ImageFont.truetype(font_bold, 22), fill=(255, 255, 255, 255))

    draw.text((bx0+35, by0+105), "34戦", font=ImageFont.truetype(font_bold, 36), fill=(50, 40, 30, 255))
    draw.text((bx0+35, by0+155), "勝率 55.9%", font=ImageFont.truetype(font_bold, 44), fill=(210, 60, 20, 255))

    draw.line([(bx0+30, by0+230), (bx1-30, by0+230)], fill=(200, 200, 210, 200), width=2)
    draw.text((bx0+35, by0+250), "・KDA : 4.00", font=f_sub, fill=(40, 40, 50, 255))
    draw.text((bx0+35, by0+295), "・GD@15 : +267", font=ImageFont.truetype(font_bold, 22), fill=(190, 50, 10, 255))
    draw.text((bx0+35, by0+340), "・15分リードで試合破壊", font=f_sub, fill=(100, 90, 80, 255))

    out_p = r"d:\my_work\02_FACTORY\01_DRAFTS\note\assets\wukong_jg_thumb.jpg"
    base.convert("RGB").save(out_p, quality=95)
    print("Wukong thumb created:", out_p)

# ----------------------------------------------------
# 3. シヴァーナJG サムネイル (shyvana_thumb.jpg)
# ----------------------------------------------------
def make_shyvana_thumb():
    # クリムゾンレッド ➔ ダークネイビー
    base = create_gradient((45, 10, 15, 255), (15, 20, 30, 255))
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    g_draw = ImageDraw.Draw(glow)
    g_draw.ellipse([800, 50, 1400, 650], fill=(220, 30, 50, 70))
    glow = glow.filter(ImageFilter.GaussianBlur(60))
    base = Image.alpha_composite(base, glow)

    card_x0, card_y0, card_x1, card_y1 = 60, 60, 840, 660
    base = draw_card(base, card_x0, card_y0, card_x1, card_y1, radius=24, bg_color=(255, 255, 255, 248), border_color=(210, 30, 50, 220))
    draw = ImageDraw.Draw(base)

    f_ribbon = ImageFont.truetype(font_bold, 20)
    f_title = ImageFont.truetype(font_bold, 40)
    f_sub = ImageFont.truetype(font_bold, 22)
    f_item_num = ImageFont.truetype(font_bold, 20)
    f_item_text = ImageFont.truetype(font_bold, 21)
    f_item_sub = ImageFont.truetype(font_reg, 16)

    # リボン帯
    draw.rounded_rectangle([card_x0+30, card_y0+25, card_x0+450, card_y0+68], radius=10, fill=(200, 25, 45, 255))
    draw.text((card_x0+45, card_y0+32), "🐉 味方ガチャ拒絶のファーム王者！", font=f_ribbon, fill=(255, 255, 255, 255))

    draw.text((card_x0+30, card_y0+85), "シヴァーナJG ドラゴン独占論", font=f_title, fill=(35, 20, 25, 255))
    draw.line([(card_x0+30, card_y0+148), (card_x1-30, card_y0+148)], fill=(200, 25, 45, 180), width=3)

    items = [
        ("1", "パッシブ対ドラゴン+20%で秒殺", "5:00ジャストの湧きと同時に一人で安全に独占"),
        ("2", "驚異の周回力「CS毎分7.2」", "無駄なガンクを全カットし、敵JGをレベル差で轢殺"),
        ("3", "征服者 ✕ ADブルーザーの結論", "トリニティフォース＋ショウジンで近接殴り合いを圧倒")
    ]
    curr_y = card_y0 + 170
    for num, title, desc in items:
        draw.ellipse([card_x0+30, curr_y, card_x0+68, curr_y+38], fill=(200, 25, 45, 240))
        draw.text((card_x0+42, curr_y+5), num, font=f_item_num, fill=(255, 255, 255, 255))
        draw.text((card_x0+82, curr_y+4), title, font=f_item_text, fill=(40, 25, 30, 255))
        draw.text((card_x0+82, curr_y+36), desc, font=f_item_sub, fill=(100, 85, 90, 255))
        curr_y += 82

    draw.rounded_rectangle([card_x0+30, card_y1-60, card_x0+330, card_y1-22], radius=8, fill=(255, 235, 240, 255), outline=(210, 50, 70, 200), width=1)
    draw.text((card_x0+42, card_y1-53), "⚡ 征服者 ✕ トリニティ・ショウジン", font=ImageFont.truetype(font_bold, 16), fill=(170, 20, 40, 255))

    # 右側：バッジパネル
    bx0, by0, bx1, by1 = 880, 140, 1220, 580
    base = draw_card(base, bx0, by0, bx1, by1, radius=24, bg_color=(255, 255, 255, 245), border_color=(200, 25, 45, 220))
    draw = ImageDraw.Draw(base)

    draw.rounded_rectangle([bx0+20, by0+25, bx1-20, by0+75], radius=12, fill=(200, 25, 45, 255))
    draw.text((bx0+45, by0+34), "🏆 リアル実戦データ", font=ImageFont.truetype(font_bold, 22), fill=(255, 255, 255, 255))

    draw.text((bx0+35, by0+105), "37戦", font=ImageFont.truetype(font_bold, 36), fill=(50, 30, 35, 255))
    draw.text((bx0+35, by0+155), "CS/m : 7.2", font=ImageFont.truetype(font_bold, 44), fill=(200, 25, 45, 255))

    draw.line([(bx0+30, by0+230), (bx1-30, by0+230)], fill=(200, 200, 210, 200), width=2)
    draw.text((bx0+35, by0+250), "・KDA : 3.85", font=f_sub, fill=(40, 40, 50, 255))
    draw.text((bx0+35, by0+295), "・GD@15 : +160", font=ImageFont.truetype(font_bold, 22), fill=(180, 20, 40, 255))
    draw.text((bx0+35, by0+340), "・全ドラゴンを単独管理", font=f_sub, fill=(90, 80, 85, 255))

    out_p = r"d:\my_work\02_FACTORY\01_DRAFTS\note\assets\shyvana_jg_thumb.jpg"
    base.convert("RGB").save(out_p, quality=95)
    print("Shyvana thumb created:", out_p)

make_zyra_thumb()
make_wukong_thumb()
make_shyvana_thumb()
