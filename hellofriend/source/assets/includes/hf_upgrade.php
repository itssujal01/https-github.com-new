<?php
// Hello Friend: one-time upgrade steps, run automatically on the first visit after the
// new files are uploaded. Each step is safe to run again. The version stored in
// Wo_Config (hf_version) makes sure the whole thing only runs once per release.

define('HF_VERSION', '4.1.0');

function hf_upgrade_log($msg)
{
    $dir = dirname(__DIR__, 2) . '/cache';
    @file_put_contents($dir . '/hf-upgrade.log', '[' . gmdate('Y-m-d H:i:s') . '] ' . $msg . "\n", FILE_APPEND | LOCK_EX);
}

function hf_upgrade_config_set($name, $value, $only_if_missing)
{
    global $sqlConnect;
    $n = mysqli_real_escape_string($sqlConnect, $name);
    $v = mysqli_real_escape_string($sqlConnect, $value);
    $q = mysqli_query($sqlConnect, "SELECT COUNT(*) AS c FROM " . T_CONFIG . " WHERE `name` = '{$n}'");
    $exists = $q && ($r = mysqli_fetch_assoc($q)) && $r['c'] > 0;
    if ($exists && $only_if_missing) {
        return;
    }
    if ($exists) {
        mysqli_query($sqlConnect, "UPDATE " . T_CONFIG . " SET `value` = '{$v}' WHERE `name` = '{$n}'");
    } else {
        mysqli_query($sqlConnect, "INSERT INTO " . T_CONFIG . " (`name`, `value`) VALUES ('{$n}', '{$v}')");
    }
}

function hf_upgrade_index($table, $name, $cols)
{
    global $sqlConnect;
    $t = mysqli_real_escape_string($sqlConnect, $table);
    $q = mysqli_query($sqlConnect, "SHOW TABLES LIKE '{$t}'");
    if (!$q || mysqli_num_rows($q) == 0) {
        return;
    }
    $q = mysqli_query($sqlConnect, "SHOW INDEX FROM `{$t}` WHERE Key_name = '" . mysqli_real_escape_string($sqlConnect, $name) . "'");
    if ($q && mysqli_num_rows($q) > 0) {
        return;
    }
    // every column must exist, otherwise skip quietly (older databases)
    foreach ($cols as $c) {
        $q = mysqli_query($sqlConnect, "SHOW COLUMNS FROM `{$t}` LIKE '" . mysqli_real_escape_string($sqlConnect, $c) . "'");
        if (!$q || mysqli_num_rows($q) == 0) {
            return;
        }
    }
    $list = '`' . implode('`,`', $cols) . '`';
    if (!mysqli_query($sqlConnect, "ALTER TABLE `{$t}` ADD INDEX `{$name}` ({$list})")) {
        hf_upgrade_log("index {$table}.{$name} failed: " . mysqli_error($sqlConnect));
    }
}

function hf_upgrade_rrmdir($dir)
{
    if (!is_dir($dir) || is_link($dir)) {
        return;
    }
    foreach (scandir($dir) as $f) {
        if ($f === '.' || $f === '..') {
            continue;
        }
        $p = $dir . '/' . $f;
        if (is_dir($p) && !is_link($p)) {
            hf_upgrade_rrmdir($p);
        } else {
            @unlink($p);
        }
    }
    @rmdir($dir);
}

function hf_upgrade_run()
{
    global $wo, $sqlConnect;
    if (empty($sqlConnect) || !defined('T_CONFIG')) {
        return;
    }
    $current = isset($wo['config']['hf_version']) ? $wo['config']['hf_version'] : '';
    if ($current === HF_VERSION) {
        return;
    }
    $root = dirname(__DIR__, 2);
    $lock = @fopen($root . '/cache/hf-upgrade.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) {
        return; // another request is already doing it
    }
    @set_time_limit(300);
    hf_upgrade_log('upgrade ' . ($current ?: 'none') . ' -> ' . HF_VERSION);

    // 1. indexes for the queries every feed, profile and chat screen runs
    $indexes = array(
        array(T_POSTS, 'hf_user_type', array('user_id', 'postType', 'id')),
        array(T_FOLLOWERS, 'hf_pair', array('following_id', 'follower_id', 'active')),
        array(T_FOLLOWERS, 'hf_pair_rev', array('follower_id', 'following_id', 'active')),
        array('Wo_AppsSessions', 'hf_user_time', array('user_id', 'time')),
        array(T_BLOCKS, 'hf_pair', array('blocker', 'blocked')),
        array(T_REPORTS, 'hf_profile_user', array('profile_id', 'user_id')),
        array(T_REPORTS, 'hf_post_user', array('post_id', 'user_id')),
        array(T_LIKES, 'hf_post_user', array('post_id', 'user_id')),
        array(T_WONDERS, 'hf_post_user', array('post_id', 'user_id')),
        array(T_SAVED_POSTS, 'hf_post_user', array('post_id', 'user_id')),
        array(T_REACTIONS, 'hf_post_user', array('post_id', 'user_id')),
        array(T_REACTIONS, 'hf_comment_user', array('comment_id', 'user_id')),
        array(T_COMMENT_LIKES, 'hf_comment_user', array('comment_id', 'user_id')),
        array(T_COMMENT_WONDERS, 'hf_comment_user', array('comment_id', 'user_id')),
        array(T_COMMENTS_REPLIES, 'hf_comment', array('comment_id')),
        array(T_NOTIFICATION, 'hf_recipient_seen', array('recipient_id', 'seen')),
        array(T_MESSAGES, 'hf_to_seen', array('to_id', 'seen')),
        array(T_MESSAGES, 'hf_from_to', array('from_id', 'to_id')),
        array(T_PINNED_POSTS, 'hf_post_active', array('post_id', 'active')),
    );
    foreach ($indexes as $ix) {
        hf_upgrade_index($ix[0], $ix[1], $ix[2]);
    }

    // 2. settings (added only when missing, so an admin's later choice is kept)
    hf_upgrade_config_set('hf_free_pro', '1', true);

    // 3. files that must not stay on a live server (debug pages, installers, old copies)
    $remove_files = array(
        'assets/phpinfo.php', 'system_status.php', 'hf-server-check.php', 'hf-setup.php',
        'hf-demo-seed.php', 'hf-demo-cleanup.php', 'README-HF-CHECK.txt', 'wowonder.sql',
        'htaccess.txt', 'nginx.conf', 'error_log', 'updater.php',
        'themes/wowonder/stylesheet/hf-app.css', 'themes/wowonder/javascript/hf-app.js',
        'cache/hf-setup-backup.json',
    );
    foreach ($remove_files as $f) {
        if (is_file($root . '/' . $f)) {
            @unlink($root . '/' . $f);
        }
    }
    foreach (array('Update Guide', 'Script', 'Documentation') as $d) {
        hf_upgrade_rrmdir($root . '/' . $d);
    }

    // 4. make sure the admin panel has its own private address on this server
    if (function_exists('hf_admin_slug')) {
        hf_admin_slug();
    }

    // 5. drop cached copies so every page is rebuilt with the new code
    if (function_exists('hf_lang_cache_clear')) {
        hf_lang_cache_clear();
    }

    hf_upgrade_config_set('hf_version', HF_VERSION, false);
    $wo['config']['hf_version'] = HF_VERSION;
    hf_upgrade_log('done');
    flock($lock, LOCK_UN);
    fclose($lock);
}
