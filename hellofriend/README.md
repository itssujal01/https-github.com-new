# Hello Friend v4 — update for public_html

**Download:** `hellofriend-update-v4.zip` (≈530 KB). The same files, unzipped, are in `source/` for review.

## Install (cPanel)
1. Take a backup first: cPanel → File Manager → select public_html → Compress; plus a database export from phpMyAdmin.
2. Upload `hellofriend-update-v4.zip` into **public_html** and choose **Extract**, overwriting the existing files.
3. Open the site once. An automatic one-time upgrade runs (database indexes, the free-Pro setting, removal of old debug files). Log: `cache/hf-upgrade.log`.
4. Admin panel: `https://hellofriend.in/hf-studio-52wi3bt9`. The old `/admin-cp` and `/admincp` addresses no longer open it.

`config.php` and the `upload/` media are not in the zip and stay untouched.

## What changed
- **New app-style UI** (mobile first): floating tab bar (Home, Watch/Reels, Create, Notifications, Menu), a Create sheet, a full-screen Menu with every feature, story cards, a full-screen composer, new post cards, double-tap to like, pull to refresh, a header that hides while you scroll, page transitions, a redesigned profile header with stats, conversation list first on Messages, full-screen photo and story viewers, a new login and sign-up screen, dark mode, and an installable web app (manifest).
- **Speed**: about 1.8 MB less JavaScript on every page (video-call, map, PDF and Facebook libraries now load only where they are used); the notification poll backs off when the tab is hidden or idle; the language table is cached; profile lookups are reused within a page; 19 database indexes; compressed and cached static files; the 100-second keep-alive header was removed.
- **Security**: private admin address; security headers; nothing in `upload/` can run as code; `.phtml`, `.sql`, `config.php` and other sensitive files are blocked from the browser; a stricter session cookie; public debug files deleted automatically (including `assets/phpinfo.php`); Pro refunds are blocked for members who got Pro for free.
- **All Pro features free** for every signed-in member, given at runtime without writing to the database. To bring the paid plans back, set `hf_free_pro` to `0` in the `Wo_Config` table.

## Change the admin address
Edit the word in `hf-admin-path.php` **and** the two `RewriteRule` lines containing it in `.htaccess`.
