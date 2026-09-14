// WebShot Background Service Worker (Manifest V3)
importScripts('editor/storage.js');

// Helper to delay
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Rate-limiting state for Chrome captureVisibleTab quota
// Chrome allows max 2 calls per second (MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND)
let lastCaptureTime = 0;
const MIN_CAPTURE_INTERVAL_MS = 600; // 600ms ensures <= 1.66 calls/sec

async function safeCaptureVisibleTab(windowId, options = { format: 'png' }, maxRetries = 5) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const elapsed = Date.now() - lastCaptureTime;
    if (elapsed < MIN_CAPTURE_INTERVAL_MS) {
      await sleep(MIN_CAPTURE_INTERVAL_MS - elapsed);
    }

    try {
      lastCaptureTime = Date.now();
      return await chrome.tabs.captureVisibleTab(windowId, options);
    } catch (err) {
      const isQuota = err.message && (
        err.message.includes('MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND') ||
        err.message.includes('quota')
      );
      if (isQuota && attempt < maxRetries - 1) {
        console.warn(`Capture quota hit, backing off and retrying (attempt ${attempt + 1}/${maxRetries})...`);
        await sleep(750 * (attempt + 1));
        continue;
      }
      throw err;
    }
  }
}

// Ensure content script is injected into tab
async function ensureContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
  } catch (err) {
    console.warn('Could not inject content script:', err);
    throw new Error('Cannot capture on this page (system or restricted URL).');
  }
}

// Check if URL is capturable
function isCapturableUrl(url) {
  if (!url) return false;
  const restrictedPrefixes = [
    'chrome://',
    'chrome-extension://',
    'edge://',
    'about:',
    'view-source:',
    'chrome.google.com/webstore',
    'chromewebstore.google.com'
  ];
  return !restrictedPrefixes.some((prefix) => url.startsWith(prefix));
}

// Perform Full Page Screenshot
async function captureFullPage(tab) {
  if (!isCapturableUrl(tab.url)) {
    throw new Error('Chrome does not allow capturing internal browser or Web Store pages.');
  }

  await ensureContentScript(tab.id);

  // 1. Get metrics
  const metrics = await chrome.tabs.sendMessage(tab.id, { action: 'PREPARE_FULL_CAPTURE' });
  if (!metrics) {
    throw new Error('Failed to read page dimensions.');
  }

  const { totalHeight, viewportHeight, totalWidth, viewportWidth, devicePixelRatio, title, url } = metrics;
  const chunks = [];

  let currentY = 0;
  const totalSteps = Math.max(1, Math.ceil(totalHeight / viewportHeight));
  let step = 0;

  try {
    while (currentY < totalHeight) {
      step++;
      const isLastStep = currentY + viewportHeight >= totalHeight;
      const targetY = isLastStep ? Math.max(0, totalHeight - viewportHeight) : currentY;

      // Scroll to position
      await chrome.tabs.sendMessage(tab.id, {
        action: 'SCROLL_STEP',
        y: targetY,
        hideSticky: currentY > 0
      });

      // Broadcast progress
      const percent = Math.min(98, Math.round((step / totalSteps) * 100));
      chrome.runtime.sendMessage({
        action: 'CAPTURE_PROGRESS',
        status: `Capturing chunk ${step} of ${totalSteps}...`,
        percent: percent
      }).catch(() => {});

      // Settle delay for animations & lazy rendering
      await sleep(200);

      // Rate-limited capture with automatic retry & backoff
      const dataUrl = await safeCaptureVisibleTab(tab.windowId, { format: 'png' });

      // Determine slice parameters
      if (isLastStep && totalSteps > 1) {
        const overlap = (currentY + viewportHeight) - totalHeight;
        chunks.push({
          y: currentY,
          sliceY: overlap * devicePixelRatio,
          sliceHeight: (viewportHeight - overlap) * devicePixelRatio,
          dataUrl
        });
        break;
      } else {
        chunks.push({
          y: currentY,
          sliceY: 0,
          sliceHeight: viewportHeight * devicePixelRatio,
          dataUrl
        });
      }

      currentY += viewportHeight;
    }
  } finally {
    // Restore page scroll & hidden sticky headers
    await chrome.tabs.sendMessage(tab.id, { action: 'FINISH_CAPTURE' }).catch(() => {});
  }

  // Save to IndexedDB
  const captureId = 'ws_' + Date.now();
  await WebShotStorage.saveCapture({
    id: captureId,
    timestamp: Date.now(),
    title: title || 'Full Page Screenshot',
    url: url || '',
    mode: 'fullpage',
    totalWidth: totalWidth,
    totalHeight: totalHeight,
    viewportWidth: viewportWidth,
    viewportHeight: viewportHeight,
    devicePixelRatio: devicePixelRatio,
    chunks: chunks
  });

  // Open editor studio in new tab
  const editorUrl = chrome.runtime.getURL(`editor/editor.html?id=${captureId}`);
  await chrome.tabs.create({ url: editorUrl });

  chrome.runtime.sendMessage({
    action: 'CAPTURE_COMPLETE',
    id: captureId
  }).catch(() => {});

  return captureId;
}

// Perform Visible Viewport Screenshot
async function captureVisible(tab) {
  if (!isCapturableUrl(tab.url)) {
    throw new Error('Chrome does not allow capturing internal browser or Web Store pages.');
  }

  const dataUrl = await safeCaptureVisibleTab(tab.windowId, { format: 'png' });
  const captureId = 'ws_' + Date.now();

  await WebShotStorage.saveCapture({
    id: captureId,
    timestamp: Date.now(),
    title: tab.title || 'Visible Screenshot',
    url: tab.url || '',
    mode: 'visible',
    chunks: [{ y: 0, dataUrl }]
  });

  const editorUrl = chrome.runtime.getURL(`editor/editor.html?id=${captureId}`);
  await chrome.tabs.create({ url: editorUrl });

  return captureId;
}

// Perform Selected Area Screenshot
async function startAreaCapture(tab) {
  if (!isCapturableUrl(tab.url)) {
    throw new Error('Chrome does not allow capturing internal browser or Web Store pages.');
  }
  await ensureContentScript(tab.id);
  await chrome.tabs.sendMessage(tab.id, { action: 'START_AREA_SELECTION' });
}

async function handleAreaSelected(tab, area) {
  await sleep(150);
  const dataUrl = await safeCaptureVisibleTab(tab.windowId, { format: 'png' });
  const captureId = 'ws_' + Date.now();

  await WebShotStorage.saveCapture({
    id: captureId,
    timestamp: Date.now(),
    title: area.title || 'Area Screenshot',
    url: area.url || '',
    mode: 'area',
    area: area,
    chunks: [{ y: 0, dataUrl }]
  });

  const editorUrl = chrome.runtime.getURL(`editor/editor.html?id=${captureId}`);
  await chrome.tabs.create({ url: editorUrl });
}

// Message Dispatcher
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'START_FULL_CAPTURE') {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (!tab) return sendResponse({ error: 'No active tab found.' });
      captureFullPage(tab)
        .then((id) => sendResponse({ success: true, id }))
        .catch((err) => sendResponse({ error: err.message }));
    });
    return true;
  }

  if (message.action === 'START_VISIBLE_CAPTURE') {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (!tab) return sendResponse({ error: 'No active tab found.' });
      captureVisible(tab)
        .then((id) => sendResponse({ success: true, id }))
        .catch((err) => sendResponse({ error: err.message }));
    });
    return true;
  }

  if (message.action === 'START_AREA_CAPTURE') {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (!tab) return sendResponse({ error: 'No active tab found.' });
      startAreaCapture(tab)
        .then(() => sendResponse({ success: true }))
        .catch((err) => sendResponse({ error: err.message }));
    });
    return true;
  }

  if (message.action === 'AREA_SELECTED') {
    const tab = sender.tab;
    if (tab) {
      handleAreaSelected(tab, message.area);
    }
  }
});
