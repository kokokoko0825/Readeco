const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

/** 最終的な配信ファイルの内容からキャッシュ識別子を決める。SHAの環境変数は不要。 */
function writeServiceWorker(distDir, templatePath) {
  const template = fs.readFileSync(templatePath, 'utf8');
  if (!template.includes('__READECO_BUILD_ID__')) throw new Error('Service Worker build placeholder is missing');
  const hash = createHash('sha256').update(template);
  function addDirectory(dir) {
    for (const name of fs.readdirSync(dir).sort()) {
      const file = path.join(dir, name);
      if (fs.statSync(file).isDirectory()) addDirectory(file);
      else if (file !== path.join(distDir, 'service-worker.js')) {
        hash.update(path.relative(distDir, file).split(path.sep).join('/'));
        hash.update('\0');
        hash.update(fs.readFileSync(file));
        hash.update('\0');
      }
    }
  }
  addDirectory(distDir);
  const buildId = hash.digest('hex').slice(0, 16);
  fs.writeFileSync(path.join(distDir, 'service-worker.js'), template.replaceAll('__READECO_BUILD_ID__', buildId));
  return buildId;
}

module.exports = { writeServiceWorker };
