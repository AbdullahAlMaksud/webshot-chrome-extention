// WebShot Popup Script

document.addEventListener('DOMContentLoaded', () => {
  const optionsView = document.getElementById('optionsView');
  const progressView = document.getElementById('progressView');
  const errorView = document.getElementById('errorView');

  const btnFullPage = document.getElementById('btnFullPage');
  const btnVisible = document.getElementById('btnVisible');
  const btnArea = document.getElementById('btnArea');
  const btnRetry = document.getElementById('btnRetry');

  const progressStatus = document.getElementById('progressStatus');
  const progressBar = document.getElementById('progressBar');
  const progressPercent = document.getElementById('progressPercent');
  const errorMessage = document.getElementById('errorMessage');

  function showView(view) {
    optionsView.classList.add('hidden');
    progressView.classList.add('hidden');
    errorView.classList.add('hidden');

    if (view === 'options') optionsView.classList.remove('hidden');
    if (view === 'progress') progressView.classList.remove('hidden');
    if (view === 'error') errorView.classList.remove('hidden');
  }

  function showError(msg) {
    errorMessage.textContent = msg || 'An unexpected error occurred.';
    showView('error');
  }

  // Full Page Capture
  btnFullPage.addEventListener('click', () => {
    showView('progress');
    progressStatus.textContent = 'Initializing full page capture...';
    progressBar.style.width = '5%';
    progressPercent.textContent = '5%';

    chrome.runtime.sendMessage({ action: 'START_FULL_CAPTURE' }, (response) => {
      if (chrome.runtime.lastError) {
        showError(chrome.runtime.lastError.message);
        return;
      }
      if (response && response.error) {
        showError(response.error);
        return;
      }
      // If success, popup closes when editor tab opens
      setTimeout(() => window.close(), 400);
    });
  });

  // Visible Area Capture
  btnVisible.addEventListener('click', () => {
    showView('progress');
    progressStatus.textContent = 'Capturing visible screen...';
    progressBar.style.width = '50%';
    progressPercent.textContent = '50%';

    chrome.runtime.sendMessage({ action: 'START_VISIBLE_CAPTURE' }, (response) => {
      if (chrome.runtime.lastError) {
        showError(chrome.runtime.lastError.message);
        return;
      }
      if (response && response.error) {
        showError(response.error);
        return;
      }
      setTimeout(() => window.close(), 300);
    });
  });

  // Selected Area Capture
  btnArea.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'START_AREA_CAPTURE' }, (response) => {
      if (chrome.runtime.lastError) {
        showError(chrome.runtime.lastError.message);
        return;
      }
      if (response && response.error) {
        showError(response.error);
        return;
      }
      // Close popup immediately to let user interact with overlay on the web page
      window.close();
    });
  });

  // Retry
  btnRetry.addEventListener('click', () => {
    showView('options');
  });

  // Listen for capture progress from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'CAPTURE_PROGRESS') {
      if (message.status) progressStatus.textContent = message.status;
      if (typeof message.percent === 'number') {
        progressBar.style.width = `${message.percent}%`;
        progressPercent.textContent = `${message.percent}%`;
      }
    }
  });
});
