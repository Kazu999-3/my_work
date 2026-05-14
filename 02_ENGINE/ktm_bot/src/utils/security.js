/** セキュリティ: Discordからのリクエスト署名検証 */
export async function verifySignature(body, signature, timestamp, publicKey) {
  try {
    if (!signature || !timestamp || !publicKey) return false;
    const hexToUint8Array = (hex) => {
      const arr = new Uint8Array(hex.length / 2);
      for (let i = 0; i < arr.length; i++) arr[i] = parseInt(hex.substr(i * 2, 2), 16);
      return arr;
    };
    const encoder = new TextEncoder();
    const timestampData = encoder.encode(timestamp);
    const bodyData = encoder.encode(body);
    const messageData = new Uint8Array(timestampData.length + bodyData.length);
    messageData.set(timestampData);
    messageData.set(bodyData, timestampData.length);
    
    const key = await crypto.subtle.importKey(
      'raw', hexToUint8Array(publicKey),
      { name: 'Ed25519', namedCurve: 'Ed25519' },
      false, ['verify']
    );
    return await crypto.subtle.verify('Ed25519', key, hexToUint8Array(signature), messageData);
  } catch (err) {
    return false;
  }
}
