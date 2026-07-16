export const CONFIG = {
  ADMIN_ID: "697220229964759130",
  GAS_URL: "https://script.google.com/macros/s/AKfycbwpSuT-cSMkTHz2iUConeLDjdCE9mAHy0SeGOp_krX5OVjHJumpXq7LxIZ3eXFPuZAv/exec",
  RECRUIT_CHANNEL_ID: "1485995531434987541",
  MATCH_CHANNEL_ID: "1487077567939743995",
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
