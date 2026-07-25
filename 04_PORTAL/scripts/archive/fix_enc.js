const fs = require('fs');
const tabPath = 'd:/my_work/04_PORTAL/src/app/champions/tabs/MatchupTab.tsx';
let buf = fs.readFileSync(tabPath);
if (buf[0] === 0xff && buf[1] === 0xfe) {
    let str = buf.toString('utf16le');
    fs.writeFileSync(tabPath, str, 'utf8');
}
