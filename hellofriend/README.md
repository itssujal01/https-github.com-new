# Hello Friend v4.1 — update for public_html

**Download:** `hellofriend-update-v4.1.zip` (≈600 KB). The same files, unzipped, are in `source/` for review.
It works on top of v4.0 or on the original site.

## Install (cPanel)
1. Take a backup first: cPanel → File Manager → select public_html → Compress; plus a database export from phpMyAdmin.
2. Upload `hellofriend-update-v4.1.zip` into **public_html** and choose **Extract**, overwriting the existing files.
3. Open the site once. A one-time upgrade runs (caches cleared, database indexes checked, admin address created). Log: `cache/hf-upgrade.log`.
4. **Admin panel:** sign in with an admin account and open **Menu → Admin panel**. The address is made on your own server
   and is never part of this repository or the zip. The address used by v4.0 no longer works.
   To get a new one, delete `hf-admin-path.php`; the next visit makes a fresh address.

`config.php` and the `upload/` media are not in the zip and stay untouched.

## New in v4.1
- Comments stay closed until you tap **Comment**; they open with a short animation.
- Colour and visibility fixes in light and dark mode: search and filter fields, group and page headers, active tabs,
  chat bubbles, settings list, placeholders, reaction counts, online status, notification sheet (now has a close button).
- Settings on phones: a list first, then one settings screen with a Back button.
- Group list rows, page header, group header and the search icon on phones redesigned.
- Speed:
  - requests that only read data release the PHP session lock, so parallel actions no longer wait in line;
  - start-up data (Pro plans, genders, categories, reactions) is cached;
  - "time ago" labels are set once (before, each one gained another timer every second);
  - each post no longer adds its own page-wide click handler, tooltip scan and @mention setup
    (page-wide click handlers stay at 45 instead of growing by ~10 per post);
  - chat messages no longer re-scan every tooltip on the page.
- Fixes: the Pages list crashed with a PHP error (also on the live site before); a missing date/time-picker script no longer stops the page script.

## Still true from v4.0
New app-style UI, dark mode, installable web app, lazy-loaded heavy libraries, 19 database indexes,
security headers, locked `upload/` folder, blocked sensitive files, and all Pro features free
(set `hf_free_pro` to `0` in `Wo_Config` to bring paid plans back).
