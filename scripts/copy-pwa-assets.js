const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const assetNames = [
  'icon.png',
  'adaptive-icon.png',
  'splash-icon.png',
  'favicon.png',
  'notification-icon.png',
];

const manifest = {
  name: 'MamiApp',
  short_name: 'MamiApp',
  description: 'Aplicatia ta pentru maternitate, sarcina, bebelus si mai mult.',
  lang: 'ro',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'portrait',
  launch_handler: {
    client_mode: 'navigate-existing',
  },
  theme_color: '#E8997A',
  background_color: '#FDF6F0',
  icons: [
    { src: '/assets/favicon.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/assets/pwa-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/assets/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFileRobust(source, destination) {
  try {
    if (fs.existsSync(destination)) {
      fs.rmSync(destination, { force: true });
    }
    fs.copyFileSync(source, destination);
  } catch (error) {
    try {
      const bytes = fs.readFileSync(source);
      fs.writeFileSync(destination, bytes);
    } catch {
      throw error;
    }
  }
}

async function createOptimizedPwaIcons(targetAssets) {
  await sharp(path.join(root, 'assets', 'icon.png'))
    .resize(512, 512)
    .png({ compressionLevel: 9, palette: true })
    .toFile(path.join(targetAssets, 'pwa-icon-512.png'));

  await sharp(path.join(root, 'assets', 'adaptive-icon.png'))
    .resize(512, 512)
    .png({ compressionLevel: 9, palette: true })
    .toFile(path.join(targetAssets, 'pwa-maskable-512.png'));
}

async function copyAssets(targetBase) {
  const targetAssets = path.join(targetBase, 'assets');
  ensureDir(targetAssets);

  for (const name of assetNames) {
    const source = path.join(root, 'assets', name);
    if (!fs.existsSync(source)) {
      throw new Error(`Missing PWA asset: ${source}`);
    }
    copyFileRobust(source, path.join(targetAssets, name));
  }

  await createOptimizedPwaIcons(targetAssets);

  fs.writeFileSync(
    path.join(targetBase, 'manifest.webmanifest'),
    JSON.stringify(manifest, null, 2),
    'utf8'
  );
}

function upsertHeadLink(html, marker, tag) {
  if (html.includes(marker)) return html;
  return html.replace('</head>', `${tag}\n</head>`);
}

/**
 * Script de recovery injectat inline în <head> — rulează ÎNAINTE de orice bundle Expo.
 * Prinde erorile fatale de bundle (Unexpected token, Requiring unknown module etc.),
 * curăță cache-urile SW + IndexedDB Firebase și reîncarcă automat.
 * După 3 reîncercări automate, afișează un buton de reset manual.
 */
const RECOVERY_SCRIPT = `<script>(function(){
  var KEY='__mami_rec__',MAX=3;
  function rc(){try{return parseInt(sessionStorage.getItem(KEY)||'0',10)}catch(e){return 0}}
  function sc(n){try{sessionStorage.setItem(KEY,String(n))}catch(e){}}
  function overlay(msg,spin){
    var o=document.getElementById('__mami_ov__');
    if(o)o.remove();
    o=document.createElement('div');
    o.id='__mami_ov__';
    o.style.cssText='position:fixed;inset:0;background:#FDF6F0;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:2147483647;font-family:-apple-system,sans-serif;padding:32px;box-sizing:border-box';
    o.innerHTML='<div style="font-size:52px;margin-bottom:20px">🌸<\\/div>'
      +'<div style="font-size:20px;font-weight:700;color:#1E2A4A;margin-bottom:8px;text-align:center">'+msg+'<\\/div>'
      +(spin
        ?'<div style="font-size:14px;color:#888;margin-bottom:32px">O nouă versiune este disponibilă<\\/div>'
          +'<div style="width:44px;height:44px;border:4px solid #E8997A;border-top-color:transparent;border-radius:50%;animation:ms 0.8s linear infinite"><\\/div>'
          +'<style>@keyframes ms{to{transform:rotate(360deg)}}<\\/style>'
        :'<div style="font-size:14px;color:#888;margin-bottom:32px;text-align:center;max-width:320px;line-height:1.5">Apasă butonul pentru a reseta aplicația și a reveni la normal.<\\/div>'
          +'<button id="__mami_rst__" style="background:#E8997A;color:#fff;border:none;padding:14px 32px;border-radius:100px;font-size:16px;font-weight:600;cursor:pointer">🔄 Resetează aplicația<\\/button>');
    (document.body||document.documentElement).appendChild(o);
    if(!spin)setTimeout(function(){var b=document.getElementById('__mami_rst__');if(b)b.onclick=recover},100);
  }
  function clearAll(cb){
    var tasks=[];
    if(typeof caches!=='undefined')tasks.push(caches.keys().then(function(ks){return Promise.all(ks.map(function(k){return caches.delete(k)}))}));
    if(navigator.serviceWorker&&navigator.serviceWorker.controller)navigator.serviceWorker.controller.postMessage({type:'CLEAR_ALL_CACHES'});
    ['firebaseLocalStorageDb','firebase-installations-database','firebase-messaging-database'].forEach(function(n){try{indexedDB.deleteDatabase(n)}catch(e){}});
    Promise.all(tasks).then(cb).catch(cb);
  }
  function recover(){
    var n=rc();
    if(n>=MAX){sc(0);overlay('Ceva nu a mers bine',false);return}
    sc(n+1);
    overlay('Se actualizează MamiApp...',true);
    clearAll(function(){setTimeout(function(){location.reload(true)},900)});
  }
  function isBundleErr(msg,src){
    if(!msg)return false;
    if(msg.indexOf('Requiring unknown module')!==-1)return true;
    if(msg.indexOf('ChunkLoadError')!==-1)return true;
    if(src&&src.indexOf('.js')!==-1){
      if(msg.indexOf('Unexpected token')!==-1)return true;
      if(msg.indexOf('SyntaxError')!==-1)return true;
    }
    return false;
  }
  window.addEventListener('error',function(e){
    if(isBundleErr(e.message,e.filename)){e.preventDefault();recover()}
  },true);
  window.addEventListener('unhandledrejection',function(e){
    var m=e.reason&&(e.reason.message||String(e.reason));
    if(isBundleErr(m,'')){e.preventDefault();recover()}
  });
  if('serviceWorker' in navigator){
    navigator.serviceWorker.addEventListener('message',function(e){
      if(e.data&&e.data.type==='MAMI_NEW_BUILD'){
        overlay('Se actualizează MamiApp...',true);
        setTimeout(function(){location.reload(true)},1200);
      }
    });
  }
  window.addEventListener('load',function(){setTimeout(function(){sc(0)},5000)});
}());<\\/script>`;

function patchDistHtml() {
  const indexPath = path.join(root, 'dist', 'index.html');
  if (!fs.existsSync(indexPath)) return;

  let html = fs.readFileSync(indexPath, 'utf8');
  html = upsertHeadLink(
    html,
    'href="/manifest.webmanifest"',
    '<link rel="manifest" href="/manifest.webmanifest">'
  );
  html = upsertHeadLink(
    html,
    'href="/assets/favicon.png"',
    '<link rel="icon" type="image/png" sizes="192x192" href="/assets/favicon.png">'
  );
  html = upsertHeadLink(
    html,
    'rel="apple-touch-icon"',
    '<link rel="apple-touch-icon" href="/assets/pwa-icon-512.png">'
  );

  // Injectăm recovery script-ul primul în <head> (înainte de orice bundle)
  if (!html.includes('__mami_rec__')) {
    html = html.replace('<head>', '<head>\n' + RECOVERY_SCRIPT.replace(/\\\//g, '/'));
  }

  fs.writeFileSync(indexPath, html, 'utf8');

  const spaRoutes = ['email-action', 'email-confirmed', 'family-invite', 'manage-subscription', 'privacy', 'terms'];
  for (const route of spaRoutes) {
    const routeDir = path.join(root, 'dist', route);
    ensureDir(routeDir);
    fs.writeFileSync(path.join(routeDir, 'index.html'), html, 'utf8');
  }

  fs.writeFileSync(path.join(root, 'dist', '_redirects'), '/* /index.html 200\n', 'utf8');

  const htaccess = [
    '# MamiApp PWA - Apache/LiteSpeed .htaccess',
    '',
    '<IfModule mod_deflate.c>',
    '  AddOutputFilterByType DEFLATE text/html text/plain text/css text/javascript application/javascript application/json application/manifest+json image/svg+xml',
    '</IfModule>',
    '',
    '<IfModule mod_brotli.c>',
    '  AddOutputFilterByType BROTLI_COMPRESS text/html text/plain text/css text/javascript application/javascript application/json application/manifest+json image/svg+xml',
    '</IfModule>',
    '',
    '<IfModule mod_mime.c>',
    '  AddType application/javascript .js',
    '  AddType text/css .css',
    '  AddType application/json .json',
    '  AddType application/manifest+json .webmanifest',
    '  AddType image/svg+xml .svg',
    '</IfModule>',
    '',
    '<IfModule mod_headers.c>',
    '',
    '  # Service Worker-e - niciodata cache-uite',
    '  <FilesMatch "^(sw-custom\\.js|firebase-messaging-sw\\.js)$">',
    '    Header set Cache-Control "no-cache, no-store, must-revalidate"',
    '    Header set Pragma "no-cache"',
    '    Header set Expires "0"',
    '    Header set Service-Worker-Allowed "/"',
    '  </FilesMatch>',
    '',
    '  # HTML si manifest - mereu verificate',
    '  <FilesMatch "\\.(html|webmanifest|json)$">',
    '    Header set Cache-Control "no-cache, no-store, must-revalidate"',
    '    Header set Pragma "no-cache"',
    '    Header set Expires "0"',
    '  </FilesMatch>',
    '',
    '  # Assets generate de Expo/Metro (nume cu hash) - cache imutabil',
    '  SetEnvIfNoCase Request_URI "^/(_expo|assets)/.*\\.(js|css|png|jpg|jpeg|gif|webp|svg|ico|woff|woff2)$" MAMIAPP_IMMUTABLE=1',
    '  Header set Cache-Control "public, max-age=31536000, immutable" env=MAMIAPP_IMMUTABLE',
    '',
    '  # Favicon',
    '  <FilesMatch "^favicon\\.ico$">',
    '    Header set Cache-Control "public, max-age=31536000, immutable"',
    '  </FilesMatch>',
    '',
    '</IfModule>',
    '',
    '<IfModule mod_rewrite.c>',
    '  RewriteEngine On',
    '  RewriteBase /',
    '  RewriteCond %{REQUEST_FILENAME} -f [OR]',
    '  RewriteCond %{REQUEST_FILENAME} -d',
    '  RewriteRule ^ - [L]',
    '  RewriteRule ^ index.html [L]',
    '</IfModule>',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(root, 'dist', '.htaccess'), htaccess, 'utf8');

  const webConfig = `<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="MamiApp SPA fallback" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <action type="Rewrite" url="/index.html" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
`;
  fs.writeFileSync(path.join(root, 'dist', 'web.config'), webConfig, 'utf8');

  const nginxConfig = [
    '# Include this inside your server/location block if you host MamiApp on Nginx:',
    '# try_files $uri $uri/ /index.html;',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(root, 'dist', 'nginx-spa-fallback.conf'), nginxConfig, 'utf8');
}

const args = new Set(process.argv.slice(2));
const syncPublic = args.size === 0 || args.has('--public');
const syncDist = args.size === 0 || args.has('--dist');

async function main() {
  if (syncPublic) {
    await copyAssets(path.join(root, 'public'));
    fs.writeFileSync(path.join(root, 'public', '_redirects'), '/* /index.html 200\n', 'utf8');
    console.log('PWA assets copied to public/assets');
  }

  if (syncDist && fs.existsSync(path.join(root, 'dist'))) {
    await copyAssets(path.join(root, 'dist'));
    patchDistHtml();
    console.log('PWA assets copied to dist/assets and dist/index.html patched');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
