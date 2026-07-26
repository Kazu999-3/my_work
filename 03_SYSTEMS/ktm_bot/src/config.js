export const CONFIG = {
  // 意図的な二段階権限（バグではない）:
  //   - CONFIG.ADMIN_ID（この単一ID）: 試合結果の書き換え・MMR手動調整・ランク一括同期など
  //     「危険な操作」専用。オーナー本人だけに絞るための固定値。
  //   - env.ADMIN_DISCORD_IDS（utils/recruitPermission.js の getAdminDiscordIds）: 募集の
  //     編集・削除など「日常運用」用。複数のモデレーターに任せられるようカンマ区切りで複数人設定可能。
  // 統合すると、モデレーターに危険な操作の権限まで渡ってしまうため統合しないこと。
  ADMIN_ID: "697220229964759130",
  GAS_URL: "https://script.google.com/macros/s/AKfycbwpSuT-cSMkTHz2iUConeLDjdCE9mAHy0SeGOp_krX5OVjHJumpXq7LxIZ3eXFPuZAv/exec",
  RECRUIT_CHANNEL_ID: "1485995531434987541",
  // 毎週土曜18時に自動投稿する定期カスタム募集の専用チャンネル(#85)
  PERIODIC_RECRUIT_CHANNEL_ID: "1528646515533287497",
  MATCH_CHANNEL_ID: "1528646515533287497",
  STATS_CHANNEL_ID: "1489910822368186468",
  NOTIFICATION_ROLE_ID: "1513531261950492833",
  // ポータルURLのフォールバック値。以前は複数ファイルにバラバラの値
  // (my-work-8jbd.vercel.app / ktm-portal.vercel.app) がハードコードされており、
  // env.PORTAL_API_URL未設定時にファイルごとに違うドメインへ飛ぶ不整合があった。
  // 実際にVercelにデプロイされているのは my-work-8jbd なので、これに統一する。
  PORTAL_URL: "https://my-work-8jbd.vercel.app",
};

/** env.PORTAL_API_URL があればそれを優先し、なければCONFIG.PORTAL_URLにフォールバックする */
export function getPortalUrl(env) {
  return (env && (env.PORTAL_API_URL || env.LOCAL_API_URL)) || CONFIG.PORTAL_URL;
}
