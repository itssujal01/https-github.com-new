<?php
require_once('assets/init.php');
decryptConfigData();
$f = '';
$s = '';
if (isset($_GET['f'])) {
    $f = Wo_Secure($_GET['f'], 0);
}

if (isset($_GET['s'])) {
    $s = Wo_Secure($_GET['s'], 0);
}
$hash_id = '';
if (!empty($_POST['hash_id'])) {
    $hash_id = $_POST['hash_id'];
} else if (!empty($_GET['hash_id'])) {
    $hash_id = $_GET['hash_id'];
} else if (!empty($_GET['hash'])) {
    $hash_id = $_GET['hash'];
} else if (!empty($_POST['hash'])) {
    $hash_id = $_POST['hash'];
}
$data = array();
$allow_array = array(
    'upgrade',
    'paystack',
    'cashfree',
    'payment',
    'pay_with_bitcoin',
    'coinpayments_callback',
    'paypro_with_bitcoin',
    'upload-blog-image',
    'wallet',
    'download_user_info',
    'movies',
    'funding',
    'stripe',
    'coinbase',
    'load_more_products',
    'yoomoney',
    'iyzipay',
    'fluttewave',
    'fortumo',
    'aamarpay',
    'pay_with_bitcoin',
);
if ($f == 'certification' && $s == 'download_user_certification' && !empty($_GET['id']) && is_numeric($_GET['id']) && $_GET['id'] > 0) {
    $allow_array[] = 'certification';
}
$non_login_array = array(
    'session_status',
    'open_lightbox',
    'get_welcome_users',
    'load_posts',
    'save_user_location',
    'load-more-groups',
    'load-more-pages',
    'load-more-users',
    'load_profile_posts',
    'confirm_user_unusal_login',
    'confirm_user',
    'confirm_sms_user',
    'resned_code',
    'resned_code_ac',
    'resned_ac_email',
    'contact_us',
    'google_login',
    'login',
    'register',
    'recover',
    'recoversms',
    'reset_password',
    'search',
    'get_search_filter',
    'update_announcement_views',
    'get_more_hashtag_posts',
    'open_album_lightbox',
    'get_next_album_image',
    'get_previous_album_image',
    'get_next_product_image',
    'get_previous_product_image',
    'open_multilightbox',
    'get_next_image',
    'get_previous_image',
    'get_next_video',
    'get_previous_video',
    'load-blogs',
    'load-recent-blogs',
    'get_no_posts_name',
    'search-blog-read',
    'search-blog',
    'coinbase',
    'load_more_products',
    'yoomoney',
    'iyzipay',
    'fluttewave',
    'fortumo',
    'aamarpay',
    'pay_with_bitcoin',
    'resend_two_factor',
    'cashfree',
);
if ($wo['config']['membership_system'] == 1) {
    $non_login_array[] = 'pro_register';
    $non_login_array[] = 'get_payment_method';
    $non_login_array[] = 'cashfree';
    $non_login_array[] = 'paystack';
    $non_login_array[] = 'pay_using_wallet';
    $non_login_array[] = 'get_paypal_url';
    $non_login_array[] = 'stripe_payment';
    $non_login_array[] = 'paypro_with_bitcoin';
    $non_login_array[] = '2checkout_pro';

    $non_login_array[] = 'bank_transfer';
    $non_login_array[] = 'stripe';
}
if (!in_array($f, $allow_array)) {
    if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) {
        if (strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) != 'xmlhttprequest') {
            exit("Restrcited Area");
        }
    } else {
        exit("Restrcited Area");
    }
}
if (!in_array($f, $non_login_array)) {
    if ($wo['loggedin'] == false && ($s != 'load_more_posts' && $s != 'filter_posts')) {
        if ($s != 'load-comments') {
            exit("Please login or signup to continue.");
        }
    }
}
if ($wo['loggedin'] && $wo['user']['banned'] == 1 && !in_array($f, $non_login_array)) {
    exit();
}
// hellofriend: PHP keeps a user's session file locked for the whole request, so the
// notification poll, likes, comments and page loads of one person waited for each other.
// These requests only read the session, so release the lock right away.
$hf_session_readonly = array('update_data', 'load_posts', 'notify_memories', 'get_notifications', 'notifications',
    'get_messages', 'get_follow_requests', 'get_last_notification', 'update_lastseen', 'session_status', 'mention',
    'search', 'get_search_filter', 'load_profile_posts', 'load_poke', 'follow_user', 'get_share_post',
    'get_followers_users', 'get_following_users', 'get_mutual_users', 'get_no_posts_name', 'get_welcome_users');
$hf_posts_readonly = array('register_reaction', 'register_like', 'register_wonder', 'load_more_posts', 'filter_posts',
    'load-comments', 'load_more_comments', 'register_comment_reaction', 'get_post_reactions', 'load_more_reels');
if (session_status() === PHP_SESSION_ACTIVE && (in_array($f, $hf_session_readonly)
    || preg_match('/^(get_more_|get_next_|get_previous_|load-more-|load_more_)/', $f)
    || ($f == 'posts' && in_array($s, $hf_posts_readonly)))) {
    session_write_close();
}
$files = scandir('xhr');
unset($files[0]);
unset($files[1]);
if ($f != 'admin_setting' && $f != 'admincp') {
    if ($wo["loggedin"] && !empty($wo['user']) && $wo['user']['is_pro'] && !empty($wo["pro_packages"][$wo['user']['pro_type']]) && !empty($wo["pro_packages"][$wo['user']['pro_type']]['max_upload'])) {
        $wo['config']['maxUpload'] = $wo["pro_packages"][$wo['user']['pro_type']]['max_upload'];
    }
}
if (file_exists('xhr/' . $f . '.php') && in_array($f . '.php', $files)) {
    include 'xhr/' . $f . '.php';
} elseif (!empty($_GET['mode_type']) && in_array($_GET['mode_type'], array('linkedin', 'instagram'))) {
    include 'xhr/modes/' . Wo_Secure($_GET['mode_type']) . '.php';
}
mysqli_close($sqlConnect);
unset($wo);
exit();