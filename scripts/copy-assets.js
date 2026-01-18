const fs = require('fs');
const path = require('path');

// SEO設定
const SEO_CONFIG = {
  siteUrl: 'https://readeco.org',
  siteName: 'Readeco（リデコ）',
  // タイトル: 主要キーワード「本の管理アプリ」を含める（32文字以内推奨）
  title: 'Readeco - 本の管理アプリ｜バーコードで簡単に蔵書管理',
  // ディスクリプション: 120-160文字、キーワードを自然に含める
  description: '【無料】本の管理アプリReadeco。バーコードをスキャンするだけで簡単に蔵書管理。読んだ本の記録、読書メモ、本棚の整理がこれ1つで完結。友達と読書体験を共有して、新しい本との出会いを見つけよう。',
  // キーワード: 検索ボリュームの高い関連キーワードを優先
  keywords: '本の管理アプリ, 蔵書管理アプリ, 読書管理アプリ, 本棚アプリ, 読書記録アプリ, バーコード 本 登録, 読んだ本 記録, 本 管理 無料, ブックログ, 読書ノート, ISBN検索, 積読管理, 本の整理',
  author: 'Readeco',
  themeColor: '#6A4028',
  backgroundColor: '#FCFAF2',
  locale: 'ja_JP',
  twitterCard: 'summary_large_image',
  ogImage: '/assets/images/icon.png',
};

/**
 * ビルド後にアイコンファイルをdistフォルダにコピーするスクリプト
 */
function copyAssets() {
  const distDir = path.join(__dirname, '..', 'dist');
  const assetsDir = path.join(__dirname, '..', 'assets', 'images');
  const webDir = path.join(__dirname, '..', 'web');
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
    if (!fs.existsSync(faviconIco)) {
      fs.copyFileSync(iconPng, faviconIco);
      console.log('✓ Copied icon.png as favicon.ico to dist/');
    }
  }

  console.log('✓ Asset copy completed!');

  // PWA用のファイルをコピー（webフォルダにある場合）
  ['manifest.json', 'service-worker.js'].forEach((file) => {
    const srcPath = path.join(webDir, file);
    const destPath = path.join(distDir, file);

    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`✓ Copied ${file} to dist/`);
    }
  });
}

/**
 * SEO用メタタグを生成
 */
function generateSeoMetaTags(pagePath = '/') {
  const pageUrl = `${SEO_CONFIG.siteUrl}${pagePath}`;
  const ogImageUrl = `${SEO_CONFIG.siteUrl}${SEO_CONFIG.ogImage}`;

  return `
<!-- Primary Meta Tags -->
<meta name="title" content="${SEO_CONFIG.title}" />
<meta name="description" content="${SEO_CONFIG.description}" />
<meta name="keywords" content="${SEO_CONFIG.keywords}" />
<meta name="author" content="${SEO_CONFIG.author}" />
<meta name="robots" content="index, follow" />
<meta name="language" content="Japanese" />
<meta name="revisit-after" content="7 days" />

<!-- Canonical URL -->
<link rel="canonical" href="${pageUrl}" />

<!-- Open Graph / Facebook -->
<meta property="og:type" content="website" />
<meta property="og:url" content="${pageUrl}" />
<meta property="og:title" content="${SEO_CONFIG.title}" />
<meta property="og:description" content="${SEO_CONFIG.description}" />
<meta property="og:image" content="${ogImageUrl}" />
<meta property="og:image:width" content="512" />
<meta property="og:image:height" content="512" />
<meta property="og:site_name" content="${SEO_CONFIG.siteName}" />
<meta property="og:locale" content="${SEO_CONFIG.locale}" />

<!-- Twitter -->
<meta name="twitter:card" content="${SEO_CONFIG.twitterCard}" />
<meta name="twitter:url" content="${pageUrl}" />
<meta name="twitter:title" content="${SEO_CONFIG.title}" />
<meta name="twitter:description" content="${SEO_CONFIG.description}" />
<meta name="twitter:image" content="${ogImageUrl}" />

<!-- Favicon & Icons -->
<link rel="icon" type="image/png" href="/assets/images/icon.png" />
<link rel="icon" type="image/x-icon" href="/favicon.ico" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />

<!-- PWA -->
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="${SEO_CONFIG.themeColor}" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="apple-mobile-web-app-title" content="${SEO_CONFIG.siteName}" />
<meta name="application-name" content="${SEO_CONFIG.siteName}" />
<meta name="msapplication-TileColor" content="${SEO_CONFIG.themeColor}" />
`.trim();
}

/**
 * HTMLファイルにSEOメタタグを追加する
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

    // ページのパスを取得
    const relativePath = path.relative(distDir, htmlFile);
    const pagePath = '/' + relativePath.replace(/index\.html$/, '').replace(/\.html$/, '');

    // 既存のメタタグを削除
    const metaTagPatterns = [
      /<meta\s+name=["'](?:title|description|keywords|author|robots|language|revisit-after|twitter:[^"']+)["'][^>]*>/gi,
      /<meta\s+property=["']og:[^"']+["'][^>]*>/gi,
      /<meta\s+name=["']theme-color["'][^>]*>/gi,
      /<meta\s+name=["'](?:mobile-web-app-capable|apple-mobile-web-app-capable|apple-mobile-web-app-status-bar-style|apple-mobile-web-app-title|application-name|msapplication-TileColor)["'][^>]*>/gi,
      /<link\s+rel=["'](?:icon|apple-touch-icon|manifest|canonical)["'][^>]*>/gi,
    ];

    metaTagPatterns.forEach(pattern => {
      content = content.replace(pattern, '');
    });

    // titleタグを更新
    if (!content.includes(`<title>${SEO_CONFIG.title}</title>`)) {
      content = content.replace(/<title>[^<]*<\/title>/i, `<title>${SEO_CONFIG.title}</title>`);
    }

    // </head>の直前にSEOメタタグを挿入
    const headEndIndex = content.indexOf('</head>');
    if (headEndIndex !== -1) {
      const seoTags = generateSeoMetaTags(pagePath);
      content = content.replace('</head>', `${seoTags}\n</head>`);
    }

    // サービスワーカー登録スクリプトを追加（</body>の直前）
    const hasServiceWorker = /navigator\.serviceWorker/i.test(content);
    if (!hasServiceWorker && content.includes('</body>')) {
      const swScript = `<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/service-worker.js')
      .then(function(registration) {
        console.log('ServiceWorker registered:', registration.scope);
      })
      .catch(function(error) {
        console.log('ServiceWorker registration failed:', error);
      });
  });
}
</script>`;
      content = content.replace('</body>', `${swScript}\n</body>`);
    }

    // 構造化データ（JSON-LD）を追加 - 複数のスキーマタイプで検索結果を強化
    if (!content.includes('application/ld+json')) {
      const structuredData = `<script type="application/ld+json">
[
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "${SEO_CONFIG.siteName}",
    "alternateName": ["Readeco", "リデコ", "本の管理アプリ"],
    "description": "${SEO_CONFIG.description}",
    "url": "${SEO_CONFIG.siteUrl}",
    "applicationCategory": "LifestyleApplication",
    "operatingSystem": "Web, Android, iOS",
    "browserRequirements": "Requires JavaScript. Requires HTML5.",
    "softwareVersion": "1.0.0",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "JPY",
      "availability": "https://schema.org/InStock"
    },
    "author": {
      "@type": "Organization",
      "name": "${SEO_CONFIG.author}",
      "url": "${SEO_CONFIG.siteUrl}"
    },
    "featureList": [
      "バーコードスキャンで本を簡単登録",
      "蔵書管理・本棚整理",
      "読書記録・読書メモ",
      "友達との読書体験共有",
      "ISBN検索",
      "積読管理"
    ],
    "screenshot": "${SEO_CONFIG.siteUrl}/assets/images/icon.png",
    "inLanguage": "ja"
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "${SEO_CONFIG.siteName}",
    "url": "${SEO_CONFIG.siteUrl}",
    "logo": "${SEO_CONFIG.siteUrl}/assets/images/icon.png",
    "sameAs": []
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "${SEO_CONFIG.siteName}",
    "alternateName": "本の管理アプリ Readeco",
    "url": "${SEO_CONFIG.siteUrl}",
    "inLanguage": "ja",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "${SEO_CONFIG.siteUrl}/search?q={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  }
]
</script>`;
      content = content.replace('</head>', `${structuredData}\n</head>`);
    }

    fs.writeFileSync(htmlFile, content, 'utf8');
    console.log(`✓ Updated ${path.relative(distDir, htmlFile)} with SEO tags`);
  });
}

/**
 * manifest.jsonファイルを更新
 */
function updateManifest() {
  const distDir = path.join(__dirname, '..', 'dist');
  const manifestPath = path.join(distDir, 'manifest.json');

  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

      // SEO設定を反映
      manifest.name = SEO_CONFIG.siteName;
      manifest.short_name = SEO_CONFIG.siteName;
      manifest.description = SEO_CONFIG.description;
      manifest.theme_color = SEO_CONFIG.themeColor;
      manifest.background_color = SEO_CONFIG.backgroundColor;
      manifest.start_url = '/';
      manifest.display = 'standalone';
      manifest.scope = '/';
      manifest.orientation = 'portrait';
      manifest.lang = 'ja';
      manifest.dir = 'ltr';
      manifest.categories = ['books', 'lifestyle', 'social'];

      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
      console.log('✓ Updated manifest.json with SEO settings');
    } catch (error) {
      console.warn(`⚠ Warning: Could not update manifest.json: ${error.message}`);
    }
  } else {
    console.warn('⚠ Warning: manifest.json not found in dist/');
  }
}

/**
 * robots.txtを生成
 */
function createRobotsTxt() {
  const distDir = path.join(__dirname, '..', 'dist');
  const robotsPath = path.join(distDir, 'robots.txt');

  const robotsContent = `# Readeco robots.txt
User-agent: *
Allow: /

# Sitemap
Sitemap: ${SEO_CONFIG.siteUrl}/sitemap.xml

# Crawl-delay for polite crawling
Crawl-delay: 1
`;

  fs.writeFileSync(robotsPath, robotsContent, 'utf8');
  console.log('✓ Created robots.txt');
}

/**
 * sitemap.xmlを生成
 */
function createSitemap() {
  const distDir = path.join(__dirname, '..', 'dist');
  const sitemapPath = path.join(distDir, 'sitemap.xml');

  const today = new Date().toISOString().split('T')[0];

  // HTMLファイルからURLを生成
  const htmlFiles = [];
  function findHtmlFiles(dir, baseDir = dir) {
    const files = fs.readdirSync(dir);
    files.forEach((file) => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        findHtmlFiles(filePath, baseDir);
      } else if (file.endsWith('.html')) {
        const relativePath = path.relative(baseDir, filePath);
        const urlPath = '/' + relativePath.replace(/index\.html$/, '').replace(/\.html$/, '');
        htmlFiles.push(urlPath);
      }
    });
  }

  findHtmlFiles(distDir);

  const urlEntries = htmlFiles.map(urlPath => {
    const priority = urlPath === '/' ? '1.0' : '0.8';
    const changefreq = urlPath === '/' ? 'daily' : 'weekly';
    return `  <url>
    <loc>${SEO_CONFIG.siteUrl}${urlPath}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
  }).join('\n');

  const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>
`;

  fs.writeFileSync(sitemapPath, sitemapContent, 'utf8');
  console.log('✓ Created sitemap.xml');
}

// スクリプトを実行
try {
  copyAssets();
  updateHtmlFiles();
  updateManifest();
  createRobotsTxt();
  createSitemap();
  console.log('✓ All assets, SEO tags, and files updated!');
} catch (error) {
  console.error('Error:', error);
  process.exit(1);
}
