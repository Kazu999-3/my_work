const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, '../SYSTEM_DESIGN.md');
const destDir = path.join(__dirname, 'src/app/design');
const destPath = path.join(destDir, 'SYSTEM_DESIGN.md');

try {
  if (fs.existsSync(srcPath)) {
    // ディレクトリが存在しない場合は作成
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(srcPath, destPath);
    console.log('✅ [Sync] SYSTEM_DESIGN.md has been copied to portal src.');
  } else {
    console.log('⚠️ [Sync] Source SYSTEM_DESIGN.md not found. Skipping copy to keep existing file.');
  }
} catch (err) {
  console.error('❌ [Sync] Failed to copy SYSTEM_DESIGN.md:', err.message);
}
