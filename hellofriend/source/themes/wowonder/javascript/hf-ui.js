/* Hello Friend UI v4 — app behaviour on top of WoWonder.
   Every action here either navigates, opens our own sheets, or clicks WoWonder's
   own controls, so its loaders, counters, permissions and sockets keep working. */
(function ($) {
  'use strict';
  if (!$) { return; }
  var html = document.documentElement, body = document.body;
  var phone = window.matchMedia('(max-width: 767px)');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var cfg = window.hfCfg || {};

  // WoWonder's sticky-sidebar plugin recalculated on every scroll; CSS sticky does the same job
  if ($.fn) { $.fn.theiaStickySidebar = function () { return this.addClass('hf-sticky'); }; }

  function buzz(ms) { try { if (navigator.vibrate && phone.matches) { navigator.vibrate(ms || 8); } } catch (e) {} }
  var toastTimer = null;
  window.hfToast = function (text) {
    var t = document.getElementById('hf-toast');
    if (!t) { return; }
    t.textContent = text;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('on'); }, 2200);
  };

  /* ---------- current page ---------- */
  function currentPage() {
    try { var v = $('#json-data').last().val(); if (v) { return JSON.parse(v).page || ''; } } catch (e) {}
    return body.getAttribute('data-hf-page') || '';
  }
  function setPage() {
    var page = currentPage();
    body.className = body.className.replace(/\bhf-p-[\w-]+/g, '').trim();
    if (page) { body.classList.add('hf-p-' + page); }
    var map = { home: 'home', reels: 'reels', watch: 'watch', search: 'search' };
    $('.hf-tab').removeClass('is-active');
    if (map[page]) { $('.hf-tab[data-hf-tab="' + map[page] + '"]').addClass('is-active'); }
    watchLoadMore();
    decorateComposer();
    pendingCompose();
    messagesStart(page);
    settingsStart(page);
  }
  // phones: Settings shows the list first; tapping an item shows only that form, with a Back button
  function settingsStart(page) {
    body.classList.remove('hf-set-list', 'hf-set-detail');
    if (page !== 'setting' || !phone.matches || !document.getElementById('wo_main_sett_side')) { return; }
    var detail = /[?&]page=/.test(location.search) || /\/setting\/[^\/?#]+/.test(location.pathname);
    body.classList.add(detail ? 'hf-set-detail' : 'hf-set-list');
    var mid = document.getElementById('wo_main_sett_mid');
    if (detail && mid && !mid.querySelector('.hf-back')) {
      var b = document.createElement('a');
      b.className = 'hf-back';
      b.href = (cfg.home || '') + '/setting';
      b.setAttribute('data-ajax', '?link1=setting');
      b.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>' + (cfg.settings || 'Settings');
      mid.insertBefore(b, mid.firstChild);
    }
  }
  // phones: Messages opens on the conversation list (WoWonder opened an empty chat pane over it)
  function messagesStart(page) {
    if (page !== 'messages' || !phone.matches) { return; }
    var withUser = /\/messages\/[^\/?#]+/.test(location.pathname) || /[?&](user|page)=/.test(location.search);
    if (!withUser) { $('.mobileleftpane').hide(); }
  }

  /* ---------- overlays: sheets, menu screen, header dropdowns ---------- */
  var openEl = null;
  function closeHeaderMenus() {
    $('#head_menu_rght > li.open, .wow_hdr_innr_left li.open').each(function () {
      $(this).removeClass('open').children('.dropdown-toggle').attr('aria-expanded', 'false');
    });
  }
  function closeAll(fromHistory) {
    if (openEl) {
      var el = openEl; openEl = null;
      el.classList.remove('on');
      setTimeout(function () { if (!el.classList.contains('on')) { el.hidden = true; } }, 450);
    }
    closeHeaderMenus();
    body.classList.remove('hf-overlay', 'hf-create-open');
    $('.hf-tab').removeClass('is-open');
  }
  function openOverlay(id, tab) {
    var el = document.getElementById(id);
    if (!el) { return; }
    if (openEl === el) { closeAll(); return; }
    closeAll(true);
    el.hidden = false;
    // next frame so the transition runs
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('on'); }); });
    openEl = el;
    body.classList.add('hf-overlay');
    if (id === 'hf-create') { body.classList.add('hf-create-open'); }
    if (tab) { $(tab).addClass('is-open'); }
    buzz(6);
  }
  function openBell(tab) {
    var li = $('#head_menu_rght > li.notification-container');
    if (!li.length) { return; }
    var menu = li.children('.dropdown-menu');
    if (!menu.children('.hf-dd-title').length) { var t = $('<li class="hf-dd-title"><span></span><button type="button" class="hf-icon-btn" data-hf-close aria-label="Close"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button></li>'); t.children('span').text(cfg.notifications || 'Notifications'); menu.prepend(t); }
    if (li.hasClass('open')) { closeAll(); return; }
    closeAll(true);
    li.children('.dropdown-toggle').trigger('click');
    if (!li.hasClass('open')) { li.addClass('open'); }
    body.classList.add('hf-overlay');
    $(tab).addClass('is-open');
    buzz(6);
  }
  // note: no history entries for sheets — WoWonder reloads the whole page on every popstate

  /* ---------- notification badge mirrors the header counter ---------- */
  function syncBadge() {
    var src = document.querySelector('.notification-container .new-update-alert');
    var b = document.getElementById('hf-bell-badge');
    if (!src || !b) { return; }
    var n = parseInt(src.textContent, 10) || 0;
    var visible = n > 0 && !src.classList.contains('hidden') && src.style.display !== 'none';
    if (visible) { var txt = n > 99 ? '99+' : String(n); if (b.textContent !== txt) { b.textContent = txt; } b.hidden = false; } else { b.hidden = true; }
  }

  /* ---------- hide bars while reading, show when scrolling up ---------- */
  var lastY = 0, ticking = false;
  function onScroll() {
    var y = window.pageYOffset || 0;
    var down = y > lastY + 6 && y > 140;
    var up = y < lastY - 6 || y < 80;
    if (down) { body.classList.add('hf-scrolled-down'); } else if (up) { body.classList.remove('hf-scrolled-down'); }
    lastY = y;
    watchLoadMore();
  }

  /* ---------- phones: load more posts automatically ---------- */
  var loadObs = null, loadBtn = null;
  function watchLoadMore() {
    var btn = document.getElementById('load-more-posts');
    if (!window.IntersectionObserver || btn === loadBtn) { return; }
    if (loadObs) { loadObs.disconnect(); }
    loadBtn = btn;
    if (!btn) { return; }
    loadObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && btn.offsetParent !== null && !body.hasAttribute('no-more-posts') && typeof window.Wo_GetMorePosts === 'function') {
          window.Wo_GetMorePosts();
        }
      });
    }, { rootMargin: '0px 0px 900px 0px' });
    loadObs.observe(btn);
  }

  /* ---------- composer ---------- */
  function decorateComposer() {
    var box = document.getElementById('publisher-box-focus');
    if (!box || box.getAttribute('data-hf-ready')) { return; }
    box.setAttribute('data-hf-ready', '1');
    box.setAttribute('data-hf-title', cfg.createPost || 'Create post');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hf-icon-btn hf-compose-close';
    btn.setAttribute('aria-label', 'Close');
    btn.innerHTML = '<svg class="hf-i" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
    btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); $('#focus-overlay').trigger('click'); body.classList.remove('pub-focus'); });
    box.appendChild(btn);
  }
  var composeTargets = { photo: '#publisher-photos', video: '#publisher-video', reel: '#publisher-reels' };
  function compose(kind) {
    var box = document.getElementById('publisher-box-focus');
    if (!box) {
      try { sessionStorage.setItem('hf-compose', kind); } catch (e) {}
      window.location.href = cfg.home || '/';
      return;
    }
    closeAll();
    if (kind === 'product') {
      var modal = $('#create-product-modal');
      if (modal.length) { modal.modal('show'); return; }
    }
    if (composeTargets[kind]) {
      var input = $(composeTargets[kind]).first();
      if (input.length) { input.trigger('click'); return; }
    }
    if (typeof window.Wo_ShowPosInfo === 'function') { window.Wo_ShowPosInfo(); }
    $('.postText').first().trigger('focus');
  }
  function pendingCompose() {
    var kind = null;
    try { kind = sessionStorage.getItem('hf-compose'); if (kind) { sessionStorage.removeItem('hf-compose'); } } catch (e) {}
    if (kind === 'product' && $('#create-product-modal').length) {
      setTimeout(function () { $('#create-product-modal').modal('show'); }, 350);
      return;
    }
    if (kind && document.getElementById('publisher-box-focus')) {
      // file pickers need a tap, so for media just open the composer
      setTimeout(function () { if (typeof window.Wo_ShowPosInfo === 'function') { window.Wo_ShowPosInfo(); } }, 350);
    }
  }

  /* ---------- likes: pop + double-tap on media ---------- */
  var heartSvg = '<svg viewBox="0 0 24 24"><defs><linearGradient id="hfhg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF5FA2"/><stop offset="1" stop-color="#F7706A"/></linearGradient></defs><path fill="url(#hfhg)" d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
  function burst(container) {
    if (reduce.matches) { return; }
    var h = document.createElement('div');
    h.className = 'hf-heart-burst';
    h.innerHTML = heartSvg;
    if (getComputedStyle(container).position === 'static') { container.style.position = 'relative'; }
    container.appendChild(h);
    setTimeout(function () { h.remove(); }, 950);
  }
  function likePost(postEl) {
    var btn = postEl.querySelector('#wo_post_stat_button .like-btn-post');
    if (!btn) { return; }
    // only like; never un-like on a double tap
    if (btn.getAttribute('data_react') === '1' || btn.querySelector('img')) { return; }
    btn.click();
  }
  // phones: a single tap still opens the photo, but only after a short wait so a
  // second tap can turn it into a like (the Instagram gesture); desktop: double-click
  var passThrough = window.WeakSet ? new WeakSet() : null;
  var pending = null;
  function mediaOf(t) { return t && t.closest ? t.closest('.post .post-file, .post [class*="album-image"], .post .wo_imgs_albm') : null; }
  function doLike(media) {
    var post = media.closest('.post');
    burst(media); buzz(12);
    if (post) { likePost(post); }
  }
  function mediaTap(e) {
    if (!phone.matches || !passThrough) { return; }
    if (passThrough.has(e)) { return; }
    var media = mediaOf(e.target);
    if (!media) { return; }
    e.preventDefault(); e.stopPropagation();
    if (pending && pending.media === media) {
      clearTimeout(pending.timer); pending = null;
      doLike(media);
      return;
    }
    if (pending) { clearTimeout(pending.timer); }
    var target = e.target;
    pending = { media: media, timer: setTimeout(function () {
      pending = null;
      var ev = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
      passThrough.add(ev);
      target.dispatchEvent(ev);
    }, 260) };
  }
  function mediaDbl(e) {
    if (phone.matches) { return; }
    var media = mediaOf(e.target);
    if (media) { e.preventDefault(); doLike(media); }
  }

  /* ---------- pull to refresh (home feed) ---------- */
  var ptr = { y0: 0, active: false, el: null, d: 0 };
  function ptrStart(e) {
    if (!phone.matches || window.pageYOffset > 0 || body.classList.contains('hf-overlay') || body.classList.contains('pub-focus')) { return; }
    if (currentPage() !== 'home') { return; }
    ptr.y0 = e.touches[0].clientY; ptr.active = true; ptr.d = 0;
  }
  function ptrMove(e) {
    if (!ptr.active) { return; }
    ptr.d = Math.max(0, e.touches[0].clientY - ptr.y0);
    if (ptr.d > 8 && window.pageYOffset <= 0) {
      if (!ptr.el) { ptr.el = $('<div class="hf-ptr"><span></span></div>').appendTo(body)[0]; }
      var p = Math.min(ptr.d / 90, 1);
      ptr.el.style.transform = 'translate(-50%,' + Math.min(ptr.d * .5, 70) + 'px) rotate(' + (p * 270) + 'deg)';
      ptr.el.style.opacity = p;
      ptr.el.classList.toggle('ready', p >= 1);
    }
  }
  function ptrEnd() {
    if (!ptr.active) { return; }
    ptr.active = false;
    var el = ptr.el;
    if (!el) { return; }
    if (ptr.d >= 90) {
      el.classList.add('spin');
      buzz(10);
      if (typeof window.loadposts === 'function') {
        $('#posts-laoded').html('<div class="wo_loading_post"></div>');
        window.loadposts();
        setTimeout(done, 900);
      } else { window.location.reload(); }
    } else { done(); }
    function done() { el.style.opacity = 0; el.style.transform = 'translate(-50%,0)'; setTimeout(function () { el.remove(); }, 250); ptr.el = null; }
  }

  /* ---------- page transitions ---------- */
  var progress = null;
  function showProgress() {
    if (!progress) { progress = $('<div class="hf-progress"></div>').appendTo(body)[0]; }
    progress.classList.add('on');
    clearTimeout(progress._t);
    progress._t = setTimeout(hideProgress, 8000);
  }
  function hideProgress() { if (progress) { progress.classList.remove('on'); } }

  /* ---------- videos: pause when scrolled away ---------- */
  var vidObs = window.IntersectionObserver ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { if (!en.isIntersecting && !en.target.paused) { try { en.target.pause(); } catch (e) {} } });
  }, { threshold: 0.15 }) : null;
  function watchVideos(root) {
    if (!vidObs) { return; }
    $(root || document).find('.post video').each(function () {
      if (this._hfv) { return; }
      this._hfv = 1; vidObs.observe(this);
      this.setAttribute('playsinline', '');
      if (!this.getAttribute('preload')) { this.setAttribute('preload', 'metadata'); }
    });
  }
  function lazyImages(root) {
    $(root || document).find('.post img:not([loading]), .comment img:not([loading])').attr('loading', 'lazy').attr('decoding', 'async');
  }

  function syncDark() { html.classList.toggle('hf-dark', !!document.getElementById('night-mode-css')); }

  $(function () {
    setPage(); syncDark(); syncBadge(); watchVideos(); lazyImages();

    $(document).on('click', '[data-hf-open]', function (e) { e.preventDefault(); openOverlay(this.getAttribute('data-hf-open'), this); });
    $(document).on('click', '[data-hf-close], #hf-scrim', function (e) { e.preventDefault(); closeAll(); });
    $(document).on('click', '#hf-tab-bell', function (e) { e.preventDefault(); e.stopPropagation(); openBell(this); });
    $(document).on('click', '[data-hf-compose]', function (e) { e.preventDefault(); compose(this.getAttribute('data-hf-compose')); });
    // phones: the header search icon opened a search box that is hidden there; go to Search instead
    $(document).on('click', '.wow_new_search_bbtn > a', function (e) {
      if (!phone.matches) { return; }
      e.preventDefault(); e.stopImmediatePropagation();
      var link = $('<a data-ajax="?link1=search"></a>').attr('href', (cfg.home || '') + '/search').appendTo(body);
      link.trigger('click');
      setTimeout(function () { link.remove(); }, 0);
    });
    // comments open with a small slide; the count row opens them too
    $(document).on('click', '#wo_post_stat_button [onclick^="Wo_ShowComments"], .post-description .stats [onclick^="Wo_ShowComments"]', function () {
      var id = (this.getAttribute('onclick').match(/\d+/) || [])[0];
      var box = id && document.getElementById('post-comments-' + id);
      if (box && !box.classList.contains('hidden')) { box.classList.remove('hf-open-anim'); void box.offsetWidth; box.classList.add('hf-open-anim'); }
    });
    // the composer turns full screen on focus, which moves it under the finger before the tap
    // finishes; make sure WoWonder's own "open composer" step still runs
    $(document).on('focusin', '#publisher-box-focus .postText', function () {
      var ta = this;
      setTimeout(function () {
        if (ta.getAttribute('opened') !== '1' && typeof window.Wo_ShowPosInfo === 'function') { window.Wo_ShowPosInfo(); }
      }, 0);
    });
    $(document).on('keydown', function (e) { if (e.key === 'Escape' && body.classList.contains('hf-overlay')) { closeAll(); } });
    // links inside overlays navigate: close first
    $(document).on('click', '.hf-screen a[href], .hf-sheet a[href], #head_menu_rght .dropdown-menu a[data-ajax]', function () {
      if (phone.matches) { setTimeout(function () { closeAll(true); }, 10); }
    });
    $(document).on('hidden.bs.dropdown', function () {
      if (!$('#head_menu_rght > li.open').length && !openEl) { body.classList.remove('hf-overlay'); $('.hf-tab').removeClass('is-open'); }
    });
    $(document).on('shown.bs.dropdown', '#head_menu_rght > li', function () { if (phone.matches) { body.classList.add('hf-overlay'); } });
    $(document).on('click', '#hf-dark-row', function (e) {
      e.preventDefault();
      var t = document.getElementById('night_mode_toggle');
      if (t) { t.click(); }
      html.classList.toggle('hf-dark');
      setTimeout(syncDark, 400);
      buzz(8);
    });
    $(document).on('click', '#night_mode_toggle', function () { setTimeout(syncDark, 400); });

    // tabs + nav feedback
    $(document).on('click', '.hf-tab[data-ajax], .hf-tab[href]', function () {
      if (this.getAttribute('data-hf-tab') === currentPage() && window.pageYOffset > 0) {
        window.scrollTo({ top: 0, behavior: reduce.matches ? 'auto' : 'smooth' });
      }
      $('.hf-tab').removeClass('is-active'); $(this).addClass('is-active'); buzz(6);
    });
    $(document).on('click', 'a[data-ajax]', function () { showProgress(); });
    $(document).on('click', '#wo_post_stat_button .like-btn-post, .reactions-box .reaction', function () {
      var p = $(this).closest('.wo-reaction'); p.removeClass('hf-pop'); void p[0].offsetWidth; p.addClass('hf-pop'); buzz(10);
    });
    document.addEventListener('click', mediaTap, true);
    document.addEventListener('dblclick', mediaDbl, true);

    // content swaps (WoWonder's ajax navigation and feed loading)
    var box = document.getElementById('contnet');
    if (box && window.MutationObserver) {
      new MutationObserver(function (muts) {
        var changedPage = muts.some(function (m) { return m.target === box && m.addedNodes.length; });
        if (changedPage) {
          hideProgress(); closeAll(true); setPage();
          if (!reduce.matches) { box.classList.remove('hf-enter'); void box.offsetWidth; box.classList.add('hf-enter'); setTimeout(function () { box.classList.remove('hf-enter'); }, 600); }
          body.classList.remove('hf-scrolled-down');
        }
        watchVideos(box); lazyImages(box);
      }).observe(box, { childList: true, subtree: true });
    }
    var alert = document.querySelector('.notification-container .new-update-alert');
    if (alert && window.MutationObserver) { new MutationObserver(syncBadge).observe(alert, { childList: true, attributes: true, characterData: true, subtree: true }); }
    if (window.MutationObserver) { new MutationObserver(syncDark).observe(document.head, { childList: true }); }

    window.addEventListener('scroll', function () {
      if (ticking) { return; }
      ticking = true;
      requestAnimationFrame(function () { ticking = false; onScroll(); });
    }, { passive: true });
    document.addEventListener('touchstart', ptrStart, { passive: true });
    document.addEventListener('touchmove', ptrMove, { passive: true });
    document.addEventListener('touchend', ptrEnd, { passive: true });
  });
})(window.jQuery);
