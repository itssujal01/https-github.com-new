<?php
// Hello Friend: security helpers loaded before anything else (see assets/init.php).

function hf_is_https()
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443)
        || (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && strtolower($_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https');
}

// The admin panel lives at a private address instead of the well-known /admin-cp.
// The address is made on the server itself the first time it is needed and kept in
// hf-admin-path.php, so it never appears in an update zip or in the source code.
// Admins find it in the app menu ("Admin panel").
function hf_admin_slug()
{
    static $slug = null;
    if ($slug !== null) {
        return $slug;
    }
    $file = dirname(__DIR__, 2) . '/hf-admin-path.php';
    $value = is_file($file) ? include $file : '';
    // addresses that were ever published (older update packages) are replaced
    $retired = array('hf-studio-52wi3bt9');
    if (is_string($value) && preg_match('/^hfa-[a-z0-9]{24}$/', $value) && !in_array($value, $retired, true)) {
        return $slug = $value;
    }
    // one request makes the address; others wait for it and read the same file
    $root = dirname(__DIR__, 2);
    $lock = @fopen($root . '/cache/hf-admin-path.lock', 'c');
    if ($lock) {
        flock($lock, LOCK_EX);
        clearstatcache(true, $file);
        if (function_exists('opcache_invalidate')) {
            @opcache_invalidate($file, true);
        }
        $again = is_file($file) ? include $file : '';
        if (is_string($again) && preg_match('/^hfa-[a-z0-9]{24}$/', $again) && !in_array($again, $retired, true)) {
            flock($lock, LOCK_UN);
            fclose($lock);
            return $slug = $again;
        }
    }
    $alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
    $new = 'hfa-';
    for ($i = 0; $i < 24; $i++) {
        $new .= $alphabet[random_int(0, 35)];
    }
    $code = "<?php\n// Hello Friend: private address of the admin panel (https://your-site/<this value>).\n"
        . "// Made automatically on this server. Delete this file to get a new address.\nreturn '" . $new . "';\n";
    $tmp = $root . '/cache/hf-admin-path.' . getmypid() . '.tmp';
    $saved = @file_put_contents($tmp, $code, LOCK_EX) !== false && @rename($tmp, $file);
    if ($saved && function_exists('opcache_invalidate')) {
        @opcache_invalidate($file, true);
    }
    if ($lock) {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
    if ($saved) {
        return $slug = $new;
    }
    // could not save it: keep whatever was there so the panel stays reachable
    return $slug = (is_string($value) && preg_match('/^[A-Za-z0-9_-]{6,64}$/', $value)) ? $value : 'hfa-unavailable';
}

function hf_admin_url($link = '')
{
    global $wo, $site_url;
    $base = !empty($wo['config']['site_url']) ? $wo['config']['site_url'] : $site_url;
    return rtrim($base, '/') . '/' . hf_admin_slug() . ($link !== '' ? '/' . ltrim($link, '/') : '');
}

// True when this request came in through the private admin address.
function hf_admin_requested()
{
    $path = parse_url(isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '', PHP_URL_PATH);
    $slug = hf_admin_slug();
    return is_string($path) && preg_match('#(^|/)' . preg_quote($slug, '#') . '(/|$)#', $path) === 1;
}

function hf_not_found()
{
    if (!headers_sent()) {
        http_response_code(404);
        header('Content-Type: text/html; charset=utf-8');
    }
    echo '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>404</title>'
        . '<body style="margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;font:16px -apple-system,Segoe UI,Roboto,sans-serif;background:#F3F4F8;color:#10121A">'
        . '<div style="text-align:center"><div style="font-size:64px;font-weight:800;letter-spacing:-.04em">404</div><p>Page not found.</p><a href="/" style="color:#5B45F5;font-weight:700">Go home</a></div></body>';
    exit();
}

function hf_security_headers()
{
    if (headers_sent() || php_sapi_name() === 'cli') {
        return;
    }
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Permissions-Policy: geolocation=(self), camera=(self), microphone=(self), payment=(self)');
    header('X-XSS-Protection: 0');
    if (hf_is_https()) {
        header('Strict-Transport-Security: max-age=31536000');
    }
    header_remove('X-Powered-By');
}

// Session cookie: never readable by scripts, only sent over HTTPS when the site uses it,
// and not sent along with cross-site form posts.
function hf_session_hardening()
{
    if (session_status() !== PHP_SESSION_NONE || headers_sent()) {
        return;
    }
    @ini_set('session.cookie_httponly', 1);
    @ini_set('session.use_only_cookies', 1);
    @ini_set('session.use_strict_mode', 1);
    if (hf_is_https()) {
        @ini_set('session.cookie_secure', 1);
    }
    @ini_set('session.cookie_samesite', 'Lax');
}

hf_session_hardening();
hf_security_headers();
