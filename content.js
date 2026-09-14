// WebShot Content Script
// Handles page dimensions, precise scrolling, header de-duplication, and area selection overlay

(function () {
  // Prevent multiple injections
  if (window.__WEBSHOT_INJECTED__) return;
  window.__WEBSHOT_INJECTED__ = true;

  let originalScrollX = 0;
  let originalScrollY = 0;
  let hiddenElements = [];
  let areaOverlay = null;

  function injectNoScrollbarStyle() {
    if (document.getElementById('__webshot_style__')) return;
    const style = document.createElement('style');
    style.id = '__webshot_style__';
    style.textContent = `
      ::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
      html, body {
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function removeNoScrollbarStyle() {
    const style = document.getElementById('__webshot_style__');
    if (style) style.remove();
  }

  // Identify and hide position:fixed / sticky elements that stay pinned to top/bottom
  // to avoid repeated duplicates when scrolling
  function hideStickyHeaders() {
    hiddenElements = [];
    const all = document.querySelectorAll('header, nav, div, section, aside');
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      try {
        const style = window.getComputedStyle(el);
        if (style.position === 'fixed' || style.position === 'sticky') {
          const rect = el.getBoundingClientRect();
          // Hide fixed bars near top or bottom
          if (rect.top <= 120 || rect.bottom >= window.innerHeight - 80) {
            const prevVis = el.style.visibility;
            el.setAttribute('data-webshot-prev-vis', prevVis);
            el.style.visibility = 'hidden';
            hiddenElements.push(el);
          }
        }
      } catch (e) {
        // Ignore cross-origin stylesheet errors
      }
    }
  }

  function restoreStickyHeaders() {
    for (const el of hiddenElements) {
      const prev = el.getAttribute('data-webshot-prev-vis');
      el.style.visibility = prev || '';
      el.removeAttribute('data-webshot-prev-vis');
    }
    hiddenElements = [];
  }

  // Get accurate page metrics
  function getMetrics() {
    const body = document.body || { scrollHeight: 0, offsetHeight: 0, clientHeight: 0, scrollWidth: 0 };
    const html = document.documentElement || { scrollHeight: 0, offsetHeight: 0, clientHeight: 0, scrollWidth: 0 };

    const totalHeight = Math.max(
      body.scrollHeight,
      body.offsetHeight,
      html.clientHeight,
      html.scrollHeight,
      html.offsetHeight
    );

    const totalWidth = Math.max(
      body.scrollWidth,
      body.offsetWidth,
      html.clientWidth,
      html.scrollWidth,
      html.offsetWidth
    );

    const viewportWidth = window.innerWidth || html.clientWidth;
    const viewportHeight = window.innerHeight || html.clientHeight;
    const dpr = window.devicePixelRatio || 1;

    originalScrollX = window.scrollX || window.pageXOffset || 0;
    originalScrollY = window.scrollY || window.pageYOffset || 0;

    return {
      totalWidth,
      totalHeight,
      viewportWidth,
      viewportHeight,
      devicePixelRatio: dpr,
      title: document.title || 'Screenshot',
      url: window.location.href
    };
  }

  // Area Selection Tool
  function startAreaSelection() {
    if (areaOverlay) areaOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = '__webshot_area_overlay__';
    overlay.style.cssText = `
      position: fixed !important;
      inset: 0 !important;
      z-index: 2147483647 !important;
      cursor: crosshair !important;
      user-select: none !important;
      background: rgba(15, 23, 42, 0.45) !important;
      backdrop-filter: blur(1px) !important;
      display: flex !important;
      overflow: hidden !important;
    `;

    // Tooltip instructions
    const tip = document.createElement('div');
    tip.style.cssText = `
      position: absolute !important;
      top: 24px !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      background: #0f172a !important;
      color: #f8fafc !important;
      padding: 8px 16px !important;
      border-radius: 9999px !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 13px !important;
      font-weight: 500 !important;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1) !important;
      pointer-events: none !important;
      letter-spacing: 0.2px !important;
    `;
    tip.textContent = 'Drag to select capture area • Press ESC to cancel';
    overlay.appendChild(tip);

    // Crop box
    const box = document.createElement('div');
    box.style.cssText = `
      position: absolute !important;
      border: 2px solid #6366f1 !important;
      background: rgba(99, 102, 241, 0.12) !important;
      box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.55), 0 0 15px rgba(99, 102, 241, 0.4) !important;
      display: none !important;
      pointer-events: none !important;
      border-radius: 4px !important;
    `;
    overlay.appendChild(box);

    // Dimension badge
    const badge = document.createElement('div');
    badge.style.cssText = `
      position: absolute !important;
      bottom: -30px !important;
      right: 0 !important;
      background: #4f46e5 !important;
      color: #ffffff !important;
      padding: 3px 8px !important;
      border-radius: 6px !important;
      font-family: -apple-system, BlinkMacSystemFont, monospace !important;
      font-size: 11px !important;
      font-weight: 600 !important;
      white-space: nowrap !important;
    `;
    box.appendChild(badge);

    let isDrawing = false;
    let startX = 0;
    let startY = 0;

    function cleanup() {
      if (overlay.parentNode) overlay.remove();
      areaOverlay = null;
      window.removeEventListener('keydown', onKeyDown);
    }

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        cleanup();
        chrome.runtime.sendMessage({ action: 'AREA_SELECTION_CANCELLED' });
      }
    }

    overlay.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      isDrawing = true;
      startX = e.clientX;
      startY = e.clientY;
      box.style.left = `${startX}px`;
      box.style.top = `${startY}px`;
      box.style.width = '0px';
      box.style.height = '0px';
      box.style.display = 'block';
    });

    overlay.addEventListener('mousemove', (e) => {
      if (!isDrawing) return;
      const currentX = e.clientX;
      const currentY = e.clientY;

      const left = Math.min(startX, currentX);
      const top = Math.min(startY, currentY);
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);

      box.style.left = `${left}px`;
      box.style.top = `${top}px`;
      box.style.width = `${width}px`;
      box.style.height = `${height}px`;
      badge.textContent = `${Math.round(width)} × ${Math.round(height)} px`;
    });

    overlay.addEventListener('mouseup', (e) => {
      if (!isDrawing) return;
      isDrawing = false;

      const currentX = e.clientX;
      const currentY = e.clientY;
      const left = Math.min(startX, currentX);
      const top = Math.min(startY, currentY);
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);

      cleanup();

      // Minimum box threshold
      if (width > 10 && height > 10) {
        chrome.runtime.sendMessage({
          action: 'AREA_SELECTED',
          area: {
            x: left,
            y: top,
            width: width,
            height: height,
            devicePixelRatio: window.devicePixelRatio || 1,
            title: document.title || 'Area Capture',
            url: window.location.href
          }
        });
      }
    });

    window.addEventListener('keydown', onKeyDown);
    document.documentElement.appendChild(overlay);
    areaOverlay = overlay;
  }

  // Message listener from background/popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case 'PREPARE_FULL_CAPTURE':
        injectNoScrollbarStyle();
        sendResponse(getMetrics());
        break;

      case 'SCROLL_STEP':
        if (message.hideSticky) {
          hideStickyHeaders();
        }
        window.scrollTo({
          left: 0,
          top: message.y,
          behavior: 'instant'
        });
        // Allow time for DOM rendering & lazy images
        setTimeout(() => {
          sendResponse({ scrolled: true, currentY: window.scrollY });
        }, 160);
        return true; // Keep channel open for async response

      case 'FINISH_CAPTURE':
        removeNoScrollbarStyle();
        restoreStickyHeaders();
        window.scrollTo({
          left: originalScrollX,
          top: originalScrollY,
          behavior: 'instant'
        });
        sendResponse({ finished: true });
        break;

      case 'START_AREA_SELECTION':
        startAreaSelection();
        sendResponse({ started: true });
        break;

      default:
        break;
    }
  });
})();
