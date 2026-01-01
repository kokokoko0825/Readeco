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

  // icon.pngをfaviconとapple-touch-iconとしてもルートにコピー
  const iconPng = path.join(assetsDir, 'icon.png');
  const faviconIco = path.join(distDir, 'favicon.ico');
  const faviconPngDest = path.join(distDir, 'favicon.png');
  const appleTouchIconDest = path.join(distDir, 'apple-touch-icon.png');

  // icon.pngが存在する場合は、faviconとapple-touch-iconとしてもコピー
  if (fs.existsSync(iconPng)) {
    // favicon.pngとしてコピー
    fs.copyFileSync(iconPng, faviconPngDest);
    console.log('✓ Copied icon.png as favicon.png to dist/');
    
    // apple-touch-icon.pngとしてコピー（iPhoneなどでホームスクリーンに追加する際に使用）
    fs.copyFileSync(iconPng, appleTouchIconDest);
    console.log('✓ Copied icon.png as apple-touch-icon.png to dist/');
    
    // favicon.icoとしてもコピー（既に存在する場合は上書き）
    // 注意: 実際の.icoファイルが必要な場合は、別途変換が必要です
    // ブラウザはPNGもfaviconとして認識します
    if (!fs.existsSync(faviconIco)) {
      fs.copyFileSync(iconPng, faviconIco);
      console.log('✓ Copied icon.png as favicon.ico to dist/');
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
        iconTags.push('<link rel="icon" type="image/png" href="/assets/images/icon.png" />');
        iconTags.push('<link rel="icon" type="image/x-icon" href="/favicon.ico" />');
      } else {
        // 既存のfavicon参照を更新（複数のfavicon参照を統合）
        content = content.replace(
          /<link\s+rel=["']icon["'][^>]*>/gi,
          ''
        );
        iconTags.push('<link rel="icon" type="image/png" href="/assets/images/icon.png" />');
        iconTags.push('<link rel="icon" type="image/x-icon" href="/favicon.ico" />');
      }
      
      // apple-touch-icon参照を追加（iPhoneなどでホームスクリーンに追加する際に使用）
      if (!hasAppleTouchIcon) {
        iconTags.push('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />');
        iconTags.push('<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />');
      } else {
        // 既存のapple-touch-icon参照を更新
        content = content.replace(
          /<link\s+rel=["']apple-touch-icon["'][^>]*>/gi,
          ''
        );
        iconTags.push('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />');
        iconTags.push('<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />');
      }
      
      // PWA用のマニフェストアイコンも追加（Androidでホームスクリーンに追加する際に使用）
      const hasManifest = /<link\s+rel=["']manifest["'][^>]*>/i.test(content);
      if (!hasManifest) {
        iconTags.push('<link rel="manifest" href="/manifest.json" />');
      }
      
      // Android向けのtheme-colorメタタグを追加
      const hasThemeColor = /<meta\s+name=["']theme-color["'][^>]*>/i.test(content);
      if (!hasThemeColor) {
        iconTags.push('<meta name="theme-color" content="#6A4028" />');
      } else {
        // 既存のtheme-colorを更新
        content = content.replace(
          /<meta\s+name=["']theme-color["'][^>]*>/gi,
          '<meta name="theme-color" content="#6A4028" />'
        );
      }
      
      // Android向けのmobile-web-app-capableメタタグを追加
      const hasMobileWebApp = /<meta\s+name=["']mobile-web-app-capable["'][^>]*>/i.test(content);
      if (!hasMobileWebApp) {
        iconTags.push('<meta name="mobile-web-app-capable" content="yes" />');
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

/**
 * manifest.jsonファイルのアイコンパスを更新する
 * AndroidでWebアプリをホームスクリーンに追加する際に使用される
 */
function updateManifest() {
  const distDir = path.join(__dirname, '..', 'dist');
  const manifestPath = path.join(distDir, 'manifest.json');
  
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      let modified = false;
      
      // アイコンをすべてicon.pngに統一
      // Android Chromeで必要なサイズ: 192x192, 512x512
      const requiredIcons = [
        {
          src: '/assets/images/icon.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any maskable'
        },
        {
          src: '/assets/images/icon.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable'
        }
      ];
      
      // 既存のアイコンをすべて置き換え
      if (manifest.icons && Array.isArray(manifest.icons)) {
        manifest.icons = requiredIcons;
        modified = true;
      } else {
        // アイコンが存在しない場合は追加
        manifest.icons = requiredIcons;
        modified = true;
      }
      
      // start_urlとdisplayも確認（PWAとして動作するために必要）
      if (!manifest.start_url) {
        manifest.start_url = '/';
        modified = true;
      }
      
      if (!manifest.display) {
        manifest.display = 'standalone';
        modified = true;
      }
      
      if (modified) {
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
        console.log('✓ Updated manifest.json with icon.png for Android PWA');
      }
    } catch (error) {
      console.warn(`⚠ Warning: Could not update manifest.json: ${error.message}`);
    }
  } else {
    console.warn('⚠ Warning: manifest.json not found in dist/');
  }
}

// スクリプトを実行
try {
  copyAssets();
  updateHtmlFiles();
  updateManifest();
  console.log('✓ All assets and HTML files updated!');
} catch (error) {
  console.error('Error copying assets:', error);
  process.exit(1);
}

