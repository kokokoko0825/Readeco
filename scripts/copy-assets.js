const fs = require('fs');
const path = require('path');

/**
 * ビルド後にアイコンファイルをdistフォルダにコピーするスクリプト
 */
function copyAssets() {
  const distDir = path.join(__dirname, '..', 'dist');
  const assetsDir = path.join(__dirname, '..', 'assets', 'images');
  const distAssetsDir = path.join(distDir, 'assets', 'images');

  // dist/assets/imagesディレクトリが存在しない場合は作成
  if (!fs.existsSync(distAssetsDir)) {
    fs.mkdirSync(distAssetsDir, { recursive: true });
  }

  // コピーするアイコンファイルのリスト
  const iconFiles = [
    'icon.png',
    'favicon.png',
    'splash-icon.png',
    'android-icon-foreground.png',
    'android-icon-background.png',
    'android-icon-monochrome.png',
  ];

  // アイコンファイルをコピー
  iconFiles.forEach((file) => {
    const srcPath = path.join(assetsDir, file);
    const destPath = path.join(distAssetsDir, file);

    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`✓ Copied ${file} to dist/assets/images/`);
    } else {
      console.warn(`⚠ Warning: ${file} not found in assets/images/`);
    }
  });

  // favicon.icoもルートにコピー（既に存在する場合は上書き）
  const faviconPng = path.join(assetsDir, 'favicon.png');
  const faviconIco = path.join(distDir, 'favicon.ico');

  // favicon.pngが存在する場合は、favicon.icoとしてもコピー
  // 注意: 実際の.icoファイルが必要な場合は、別途変換が必要です
  if (fs.existsSync(faviconPng)) {
    // PNGファイルをそのままコピー（ブラウザはPNGもfaviconとして認識します）
    const faviconPngDest = path.join(distDir, 'favicon.png');
    if (!fs.existsSync(faviconIco)) {
      fs.copyFileSync(faviconPng, faviconPngDest);
      console.log('✓ Copied favicon.png to dist/');
    }
  }

  console.log('✓ Asset copy completed!');
}

/**
 * HTMLファイルにアイコン参照を追加する
 */
function updateHtmlFiles() {
  const distDir = path.join(__dirname, '..', 'dist');
  
  // すべてのHTMLファイルを検索
  const htmlFiles = [];
  function findHtmlFiles(dir) {
    const files = fs.readdirSync(dir);
    files.forEach((file) => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        findHtmlFiles(filePath);
      } else if (file.endsWith('.html')) {
        htmlFiles.push(filePath);
      }
    });
  }
  
  findHtmlFiles(distDir);
  
  htmlFiles.forEach((htmlFile) => {
    let content = fs.readFileSync(htmlFile, 'utf8');
    let modified = false;
    
    // 既存のfavicon参照を確認
    const hasIcon = /<link\s+rel=["']icon["'][^>]*>/i.test(content);
    const hasAppleTouchIcon = /<link\s+rel=["']apple-touch-icon["'][^>]*>/i.test(content);
    
    // </head>の前にアイコン参照を追加/更新
    const headEndIndex = content.indexOf('</head>');
    if (headEndIndex !== -1) {
      const iconTags = [];
      
      // favicon参照を追加/更新
      if (!hasIcon) {
        iconTags.push('<link rel="icon" type="image/png" href="/assets/images/favicon.png" />');
        iconTags.push('<link rel="icon" type="image/x-icon" href="/favicon.ico" />');
      } else {
        // 既存のfavicon参照を更新（複数のfavicon参照を統合）
        content = content.replace(
          /<link\s+rel=["']icon["'][^>]*>/gi,
          ''
        );
        iconTags.push('<link rel="icon" type="image/png" href="/assets/images/favicon.png" />');
        iconTags.push('<link rel="icon" type="image/x-icon" href="/favicon.ico" />');
      }
      
      // apple-touch-icon参照を追加
      if (!hasAppleTouchIcon) {
        iconTags.push('<link rel="apple-touch-icon" href="/assets/images/icon.png" />');
      } else {
        // 既存のapple-touch-icon参照を更新
        content = content.replace(
          /<link\s+rel=["']apple-touch-icon["'][^>]*>/gi,
          ''
        );
        iconTags.push('<link rel="apple-touch-icon" href="/assets/images/icon.png" />');
      }
      
      if (iconTags.length > 0) {
        const iconTagsString = iconTags.join('\n');
        content = content.slice(0, headEndIndex) + iconTagsString + '\n' + content.slice(headEndIndex);
        modified = true;
      }
    }
    
    if (modified) {
      fs.writeFileSync(htmlFile, content, 'utf8');
      console.log(`✓ Updated ${path.relative(distDir, htmlFile)}`);
    }
  });
}

// スクリプトを実行
try {
  copyAssets();
  updateHtmlFiles();
  console.log('✓ All assets and HTML files updated!');
} catch (error) {
  console.error('Error copying assets:', error);
  process.exit(1);
}

