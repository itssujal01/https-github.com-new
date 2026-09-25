<?php
// Hello Friend: security helpers loaded before anything else (see assets/init.php).

function hf_is_https()
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443)
        || (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && strtolower($_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https');
}

// The admin panel lives at a private address instead of the well-known /admin-cp.
function hf_admin_slug()
{
    static $slug = null;
    if ($slug === null) {
        $file = dirname(__DIR__, 2) . '/hf-admin-path.php';
        $value = is_file($file) ? include $file : '';
        $slug = (is_string($value) && preg_match('/^[A-Za-z0-9_-]{6,64}$/', $value)) ? $value : 'admin-cp';
    }
    return $slug;
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
