// WebShot Studio - Interactive Canvas Annotation Engine

(function () {
  // State
  let currentCapture = null;
  let currentTool = 'select'; // 'select' | 'rectangle' | 'ellipse' | 'arrow' | 'line' | 'highlighter' | 'pen' | 'text' | 'blur' | 'step'
  let currentColor = '#ef4444';
  let currentStrokeWidth = 4;
  let isFilled = false;
  let currentFontSize = 28;
  let stepCounter = 1;
  let selectedFormat = 'png';

  // Canvas & Zoom State
  let zoomLevel = 1.0;
  let isSpacePressed = false;
  let isPanning = false;
  let panStartX = 0;
  let panStartY = 0;
  let scrollStartX = 0;
  let scrollStartY = 0;

  // Annotations & History
  let annotations = [];
  let undoStack = [];
  let redoStack = [];
  let selectedAnnotation = null;
  let isDraggingAnnotation = false;
  let dragOffset = { x: 0, y: 0 };

  // Active drawing state
  let isDrawing = false;
  let drawStartX = 0;
  let drawStartY = 0;
  let currentPathPoints = [];

  // DOM Elements
  const viewport = document.getElementById('viewport');
  const stage = document.getElementById('stage');
  const baseCanvas = document.getElementById('baseCanvas');
  const baseCtx = baseCanvas.getContext('2d');
  const annotationCanvas = document.getElementById('annotationCanvas');
  const annotationCtx = annotationCanvas.getContext('2d');

  const docTitle = document.getElementById('docTitle');
  const docDimensions = document.getElementById('docDimensions');
  const zoomLevelText = document.getElementById('zoomLevelText');
  const loadingOverlay = document.getElementById('loadingOverlay');
  const loadingText = document.getElementById('loadingText');
  const loadingSubtext = document.getElementById('loadingSubtext');

  const btnZoomIn = document.getElementById('btnZoomIn');
  const btnZoomOut = document.getElementById('btnZoomOut');
  const btnZoomFit = document.getElementById('btnZoomFit');
  const btnZoom100 = document.getElementById('btnZoom100');

  const btnUndo = document.getElementById('btnUndo');
  const btnRedo = document.getElementById('btnRedo');
  const btnClear = document.getElementById('btnClear');
  const btnCopy = document.getElementById('btnCopy');
  const btnDownload = document.getElementById('btnDownload');
  const btnDownloadMenu = document.getElementById('btnDownloadMenu');
  const downloadMenu = document.getElementById('downloadMenu');

  const dockButtons = document.querySelectorAll('.dock-btn');
  const colorSwatches = document.querySelectorAll('.color-swatch');
  const customColorInput = document.getElementById('customColorInput');
  const strokeButtons = document.querySelectorAll('.stroke-btn');
  const checkFill = document.getElementById('checkFill');
  const fillSection = document.getElementById('fillSection');
  const fontSection = document.getElementById('fontSection');
  const selectFontSize = document.getElementById('selectFontSize');
  const deleteSection = document.getElementById('deleteSection');
  const btnDeleteSelected = document.getElementById('btnDeleteSelected');
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');

  // Helper: show toast notification
  function showToast(message, duration = 2500) {
    toastMessage.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => {
      toast.classList.add('hidden');
    }, duration);
  }

  // Load capture from IndexedDB or generate interactive demo preview
  async function loadCaptureData() {
    const params = new URLSearchParams(window.location.search);
    const captureId = params.get('id');

    if (!captureId) {
      loadingText.textContent = 'Loading demo playground...';
      renderDemoCanvas();
      return;
    }

    try {
      loadingText.textContent = 'Loading screenshot...';
      const record = await WebShotStorage.getCapture(captureId);
      if (!record) {
        loadingText.textContent = 'Capture not found';
        loadingSubtext.textContent = 'The screenshot could not be loaded from storage.';
        return;
      }

      currentCapture = record;
      docTitle.textContent = record.title || 'Screenshot';
      document.title = `${record.title || 'Screenshot'} - WebShot Studio`;

      await assembleScreenshot(record);
    } catch (err) {
      console.error('Error loading capture:', err);
      loadingText.textContent = 'Error loading capture';
      loadingSubtext.textContent = err.message;
    }
  }

  // Generate interactive demo webpage canvas for instant testing
  function renderDemoCanvas() {
    const w = 1200;
    const h = 2000;

    baseCanvas.width = w;
    baseCanvas.height = h;
    annotationCanvas.width = w;
    annotationCanvas.height = h;

    // Background gradient
    baseCtx.fillStyle = '#0f172a';
    baseCtx.fillRect(0, 0, w, h);

    // Grid dots
    baseCtx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    for (let x = 20; x < w; x += 30) {
      for (let y = 20; y < h; y += 30) {
        baseCtx.fillRect(x, y, 2, 2);
      }
    }

    // Header bar
    baseCtx.fillStyle = '#1e293b';
    baseCtx.fillRect(0, 0, w, 70);
    baseCtx.fillStyle = '#ffffff';
    baseCtx.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
    baseCtx.fillText('Acme SaaS Analytics', 60, 44);

    // Nav links
    baseCtx.fillStyle = '#94a3b8';
    baseCtx.font = '500 15px "Plus Jakarta Sans", sans-serif';
    baseCtx.fillText('Overview', 650, 42);
    baseCtx.fillText('Features', 760, 42);
    baseCtx.fillText('Customers', 870, 42);
    baseCtx.fillText('Documentation', 990, 42);

    // Hero Section
    baseCtx.fillStyle = '#6366f1';
    baseCtx.beginPath();
    baseCtx.roundRect(60, 120, 160, 32, 16);
    baseCtx.fill();
    baseCtx.fillStyle = '#ffffff';
    baseCtx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
    baseCtx.fillText('RELEASE V2.4 NOW LIVE', 78, 141);

    baseCtx.fillStyle = '#f8fafc';
    baseCtx.font = 'bold 52px "Plus Jakarta Sans", sans-serif';
    baseCtx.fillText('High Performance Analytics', 60, 220);
    baseCtx.fillText('Built for Fast Engineering Teams', 60, 280);

    baseCtx.fillStyle = '#94a3b8';
    baseCtx.font = '400 20px "Plus Jakarta Sans", sans-serif';
    baseCtx.fillText('Capture, analyze, and collaborate with precision. Use the tools above to test', 60, 335);
    baseCtx.fillText('drawing rectangles, arrows, text, highlighters, and blur redact masks!', 60, 365);

    // CTA Button
    baseCtx.fillStyle = '#4f46e5';
    baseCtx.beginPath();
    baseCtx.roundRect(60, 410, 180, 50, 8);
    baseCtx.fill();
    baseCtx.fillStyle = '#ffffff';
    baseCtx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
    baseCtx.fillText('Get Started Free', 90, 441);

    // Secondary CTA
    baseCtx.strokeStyle = '#334155';
    baseCtx.lineWidth = 2;
    baseCtx.beginPath();
    baseCtx.roundRect(260, 410, 160, 50, 8);
    baseCtx.stroke();
    baseCtx.fillStyle = '#f8fafc';
    baseCtx.fillText('View Live Demo', 285, 441);

    // Stat Cards
    const stats = [
      { label: 'Active Deployments', val: '24,850', change: '+18.4%' },
      { label: 'Api Requests / min', val: '1.42M', change: '+9.2%' },
      { label: 'Global Latency', val: '24ms', change: '-4.1ms' }
    ];

    stats.forEach((s, idx) => {
      const cardX = 60 + idx * 370;
      const cardY = 510;
      baseCtx.fillStyle = '#1e293b';
      baseCtx.beginPath();
      baseCtx.roundRect(cardX, cardY, 340, 140, 12);
      baseCtx.fill();

      baseCtx.strokeStyle = '#334155';
      baseCtx.lineWidth = 1;
      baseCtx.stroke();

      baseCtx.fillStyle = '#94a3b8';
      baseCtx.font = '500 14px "Plus Jakarta Sans", sans-serif';
      baseCtx.fillText(s.label, cardX + 24, cardY + 38);

      baseCtx.fillStyle = '#ffffff';
      baseCtx.font = 'bold 36px "Plus Jakarta Sans", sans-serif';
      baseCtx.fillText(s.val, cardX + 24, cardY + 86);

      baseCtx.fillStyle = '#10b981';
      baseCtx.font = '600 14px "Plus Jakarta Sans", sans-serif';
      baseCtx.fillText(s.change, cardX + 24, cardY + 118);
    });

    // Content Section / Table
    const tableY = 700;
    baseCtx.fillStyle = '#1e293b';
    baseCtx.beginPath();
    baseCtx.roundRect(60, tableY, 1080, 520, 12);
    baseCtx.fill();
    baseCtx.strokeStyle = '#334155';
    baseCtx.stroke();

    baseCtx.fillStyle = '#ffffff';
    baseCtx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
    baseCtx.fillText('Recent System Activity & Sensitive User Logs', 90, tableY + 45);

    baseCtx.fillStyle = '#64748b';
    baseCtx.font = '500 14px "Plus Jakarta Sans", sans-serif';
    baseCtx.fillText('USER / EMAIL', 90, tableY + 90);
    baseCtx.fillText('ENDPOINT', 420, tableY + 90);
    baseCtx.fillText('STATUS', 750, tableY + 90);
    baseCtx.fillText('LATENCY', 950, tableY + 90);

    const rows = [
      { email: 'alex.morgan@company.com', endpoint: '/api/v1/auth/verify', status: '200 OK', latency: '18ms' },
      { email: 'sarah.jenkins@enterprise.io', endpoint: '/api/v2/payment/charge', status: '201 Created', latency: '42ms' },
      { email: 'admin_security_key=xyz98234', endpoint: '/admin/credentials/export', status: '200 OK', latency: '12ms' },
      { email: 'david.beck@startup.tech', endpoint: '/api/v1/projects/list', status: '200 OK', latency: '24ms' },
      { email: 'customer_secret_token=a9f7b1', endpoint: '/api/v1/webhook/stripe', status: '200 OK', latency: '31ms' }
    ];

    rows.forEach((r, i) => {
      const rowY = tableY + 135 + i * 65;
      baseCtx.fillStyle = '#334155';
      baseCtx.fillRect(90, rowY - 25, 1020, 1);

      baseCtx.fillStyle = '#f1f5f9';
      baseCtx.font = '500 15px monospace';
      baseCtx.fillText(r.email, 90, rowY + 5);

      baseCtx.fillStyle = '#cbd5e1';
      baseCtx.font = '500 14px "Plus Jakarta Sans", sans-serif';
      baseCtx.fillText(r.endpoint, 420, rowY + 5);

      baseCtx.fillStyle = '#10b981';
      baseCtx.font = '600 13px "Plus Jakarta Sans", sans-serif';
      baseCtx.fillText(r.status, 750, rowY + 5);

      baseCtx.fillStyle = '#94a3b8';
      baseCtx.font = '500 14px "Plus Jakarta Sans", sans-serif';
      baseCtx.fillText(r.latency, 950, rowY + 5);
    });

    // Lower Feature Showcase
    const featY = 1270;
    baseCtx.fillStyle = '#1e293b';
    baseCtx.beginPath();
    baseCtx.roundRect(60, featY, 1080, 560, 12);
    baseCtx.fill();
    baseCtx.strokeStyle = '#334155';
    baseCtx.stroke();

    baseCtx.fillStyle = '#ffffff';
    baseCtx.font = 'bold 24px "Plus Jakarta Sans", sans-serif';
    baseCtx.fillText('Full Page Capture Technology', 90, featY + 55);

    baseCtx.fillStyle = '#94a3b8';
    baseCtx.font = '400 16px "Plus Jakarta Sans", sans-serif';
    baseCtx.fillText('Automatically captures long scrollable documents, handles sticky headers, and stitches seamless lossless PNGs.', 90, featY + 95);

    docTitle.textContent = 'Demo Webpage Preview (Ready for Annotations)';
    docDimensions.textContent = `${w} × ${h} px`;
    loadingOverlay.classList.add('hidden');
    fitToViewport();
  }

  // Helper to load HTMLImageElement
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  // Assemble slices or single chunk
  async function assembleScreenshot(record) {
    const chunks = record.chunks || [];
    if (chunks.length === 0) throw new Error('No image chunks available.');

    if (record.mode === 'fullpage') {
      loadingText.textContent = 'Stitching full page chunks...';
      const firstImg = await loadImage(chunks[0].dataUrl);
      const dpr = record.devicePixelRatio || 1;
      const fullWidth = firstImg.width;
      const fullHeight = Math.round(record.totalHeight * dpr);

      baseCanvas.width = fullWidth;
      baseCanvas.height = fullHeight;
      annotationCanvas.width = fullWidth;
      annotationCanvas.height = fullHeight;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        loadingSubtext.textContent = `Rendering chunk ${i + 1} of ${chunks.length}...`;
        const img = (i === 0) ? firstImg : await loadImage(chunk.dataUrl);

        const sy = chunk.sliceY || 0;
        const sh = chunk.sliceHeight || img.height;
        const dy = Math.round(chunk.y * dpr);

        baseCtx.drawImage(
          img,
          0, sy, img.width, sh,
          0, dy, img.width, sh
        );
      }
    } else if (record.mode === 'area') {
      loadingText.textContent = 'Cropping selected area...';
      const img = await loadImage(chunks[0].dataUrl);
      const area = record.area;
      const dpr = area.devicePixelRatio || 1;

      const cropX = Math.round(area.x * dpr);
      const cropY = Math.round(area.y * dpr);
      const cropW = Math.round(area.width * dpr);
      const cropH = Math.round(area.height * dpr);

      baseCanvas.width = cropW;
      baseCanvas.height = cropH;
      annotationCanvas.width = cropW;
      annotationCanvas.height = cropH;

      baseCtx.drawImage(
        img,
        cropX, cropY, cropW, cropH,
        0, 0, cropW, cropH
      );
    } else {
      // Visible screen
      loadingText.textContent = 'Preparing image...';
      const img = await loadImage(chunks[0].dataUrl);
      baseCanvas.width = img.width;
      baseCanvas.height = img.height;
      annotationCanvas.width = img.width;
      annotationCanvas.height = img.height;

      baseCtx.drawImage(img, 0, 0);
    }

    docDimensions.textContent = `${baseCanvas.width} × ${baseCanvas.height} px`;
    loadingOverlay.classList.add('hidden');

    // Default zoom to fit viewport width
    fitToViewport();
  }

  // Zoom management
  function setZoom(newZoom) {
    zoomLevel = Math.max(0.15, Math.min(3.0, newZoom));
    const percent = Math.round(zoomLevel * 100);
    zoomLevelText.textContent = `${percent}%`;

    stage.style.width = `${baseCanvas.width * zoomLevel}px`;
    stage.style.height = `${baseCanvas.height * zoomLevel}px`;

    // Visual scale style
    baseCanvas.style.width = '100%';
    baseCanvas.style.height = '100%';
    annotationCanvas.style.width = '100%';
    annotationCanvas.style.height = '100%';
  }

  function fitToViewport() {
    const availableWidth = viewport.clientWidth - 80;
    if (baseCanvas.width > 0 && availableWidth > 0) {
      const fitZoom = Math.min(1.0, availableWidth / baseCanvas.width);
      setZoom(fitZoom);
    } else {
      setZoom(1.0);
    }
  }

  btnZoomIn.addEventListener('click', () => setZoom(zoomLevel + 0.15));
  btnZoomOut.addEventListener('click', () => setZoom(zoomLevel - 0.15));
  btnZoomFit.addEventListener('click', fitToViewport);
  btnZoom100.addEventListener('click', () => setZoom(1.0));

  // Convert mouse event coordinates to internal Canvas coordinates
  function getCanvasCoords(e) {
    const rect = annotationCanvas.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;

    const scaleX = baseCanvas.width / rect.width;
    const scaleY = baseCanvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  // History & Undo/Redo
  function saveState() {
    undoStack.push(JSON.stringify(annotations));
    redoStack = []; // Clear redo
    updateUndoRedoButtons();
  }

  function updateUndoRedoButtons() {
    btnUndo.disabled = undoStack.length === 0;
    btnRedo.disabled = redoStack.length === 0;
  }

  btnUndo.addEventListener('click', () => {
    if (undoStack.length === 0) return;
    redoStack.push(JSON.stringify(annotations));
    const previous = undoStack.pop();
    annotations = JSON.parse(previous);
    selectedAnnotation = null;
    updateSelectionUI();
    redrawAnnotations();
    updateUndoRedoButtons();
  });

  btnRedo.addEventListener('click', () => {
    if (redoStack.length === 0) return;
    undoStack.push(JSON.stringify(annotations));
    const next = redoStack.pop();
    annotations = JSON.parse(next);
    selectedAnnotation = null;
    updateSelectionUI();
    redrawAnnotations();
    updateUndoRedoButtons();
  });

  btnClear.addEventListener('click', () => {
    if (annotations.length === 0) return;
    saveState();
    annotations = [];
    selectedAnnotation = null;
    stepCounter = 1;
    updateSelectionUI();
    redrawAnnotations();
    showToast('Annotations cleared');
  });

  // Tool Switching
  dockButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      dockButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentTool = btn.dataset.tool;
      selectedAnnotation = null;
      updateSelectionUI();
      updateToolPropertiesVisibility();
      redrawAnnotations();
    });
  });

  function updateToolPropertiesVisibility() {
    if (currentTool === 'text') {
      fontSection.classList.remove('hidden');
      fillSection.classList.add('hidden');
    } else if (currentTool === 'rectangle' || currentTool === 'ellipse') {
      fontSection.classList.add('hidden');
      fillSection.classList.remove('hidden');
    } else {
      fontSection.classList.add('hidden');
      fillSection.classList.add('hidden');
    }
  }

  // Color selection
  colorSwatches.forEach((swatch) => {
    swatch.addEventListener('click', () => {
      colorSwatches.forEach((s) => s.classList.remove('active'));
      swatch.classList.add('active');
      currentColor = swatch.dataset.color;
      if (selectedAnnotation) {
        saveState();
        selectedAnnotation.color = currentColor;
        redrawAnnotations();
      }
    });
  });

  customColorInput.addEventListener('input', (e) => {
    colorSwatches.forEach((s) => s.classList.remove('active'));
    currentColor = e.target.value;
    if (selectedAnnotation) {
      saveState();
      selectedAnnotation.color = currentColor;
      redrawAnnotations();
    }
  });

  // Stroke selection
  strokeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      strokeButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentStrokeWidth = parseInt(btn.dataset.width, 10);
      if (selectedAnnotation) {
        saveState();
        selectedAnnotation.strokeWidth = currentStrokeWidth;
        redrawAnnotations();
      }
    });
  });

  checkFill.addEventListener('change', (e) => {
    isFilled = e.target.checked;
    if (selectedAnnotation && (selectedAnnotation.type === 'rectangle' || selectedAnnotation.type === 'ellipse')) {
      saveState();
      selectedAnnotation.filled = isFilled;
      redrawAnnotations();
    }
  });

  selectFontSize.addEventListener('change', (e) => {
    currentFontSize = parseInt(e.target.value, 10);
    if (selectedAnnotation && selectedAnnotation.type === 'text') {
      saveState();
      selectedAnnotation.fontSize = currentFontSize;
      redrawAnnotations();
    }
  });

  btnDeleteSelected.addEventListener('click', () => {
    if (!selectedAnnotation) return;
    saveState();
    annotations = annotations.filter((a) => a !== selectedAnnotation);
    selectedAnnotation = null;
    updateSelectionUI();
    redrawAnnotations();
  });

  function updateSelectionUI() {
    if (selectedAnnotation) {
      deleteSection.classList.remove('hidden');
    } else {
      deleteSection.classList.add('hidden');
    }
  }

  // Drawing Engine
  function drawArrow(ctx, fromX, fromY, toX, toY, color, strokeWidth) {
    const headLength = Math.max(14, strokeWidth * 3.5);
    const angle = Math.atan2(toY - fromY, toX - fromX);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Main arrow shaft
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    // Arrowhead
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(
      toX - headLength * Math.cos(angle - Math.PI / 6),
      toY - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      toX - headLength * Math.cos(angle + Math.PI / 6),
      toY - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawPixelatedArea(ctx, x, y, width, height) {
    const minX = Math.max(0, Math.min(x, x + width));
    const minY = Math.max(0, Math.min(y, y + height));
    const w = Math.min(baseCanvas.width - minX, Math.abs(width));
    const h = Math.min(baseCanvas.height - minY, Math.abs(height));
    if (w <= 0 || h <= 0) return;

    // Redaction: sample down to 10% and upscale with smoothing disabled
    const blockSize = Math.max(8, Math.round(Math.min(w, h) / 12));
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = Math.max(1, Math.floor(w / blockSize));
    tempCanvas.height = Math.max(1, Math.floor(h / blockSize));
    const tempCtx = tempCanvas.getContext('2d');

    tempCtx.drawImage(baseCanvas, minX, minY, w, h, 0, 0, tempCanvas.width, tempCanvas.height);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height, minX, minY, w, h);

    // Subtle redaction border
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(minX, minY, w, h);
    ctx.restore();
  }

  function drawStepBadge(ctx, x, y, number, color) {
    const radius = 18;
    ctx.save();
    // Shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;

    // Circle background
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // White outline ring
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // Number text
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(number), x, y + 1);
    ctx.restore();
  }

  function drawTextAnnotation(ctx, item) {
    ctx.save();
    ctx.font = `bold ${item.fontSize}px "Plus Jakarta Sans", sans-serif`;
    ctx.textBaseline = 'top';

    const padding = 6;
    const lines = String(item.text).split('\n');
    let maxWidth = 0;
    lines.forEach((line) => {
      const w = ctx.measureText(line).width;
      if (w > maxWidth) maxWidth = w;
    });
    const lineHeight = item.fontSize * 1.3;
    const totalHeight = lineHeight * lines.length;

    // Backdrop for high legibility
    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    ctx.beginPath();
    ctx.roundRect(item.x - padding, item.y - padding, maxWidth + padding * 2, totalHeight + padding * 2, 6);
    ctx.fill();

    ctx.strokeStyle = item.color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Text content
    ctx.fillStyle = '#ffffff';
    lines.forEach((line, index) => {
      ctx.fillText(line, item.x, item.y + index * lineHeight);
    });
    ctx.restore();
  }

  // Master Render of All Annotations
  function renderAnnotations(ctx, isExport = false) {
    ctx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);

    for (const item of annotations) {
      ctx.save();

      switch (item.type) {
        case 'rectangle':
          ctx.strokeStyle = item.color;
          ctx.lineWidth = item.strokeWidth;
          ctx.beginPath();
          ctx.roundRect(item.x, item.y, item.width, item.height, 6);
          if (item.filled) {
            ctx.fillStyle = hexToRgba(item.color, 0.25);
            ctx.fill();
          }
          ctx.stroke();
          break;

        case 'ellipse':
          ctx.strokeStyle = item.color;
          ctx.lineWidth = item.strokeWidth;
          ctx.beginPath();
          const cx = item.x + item.width / 2;
          const cy = item.y + item.height / 2;
          const rx = Math.abs(item.width / 2);
          const ry = Math.abs(item.height / 2);
          ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          if (item.filled) {
            ctx.fillStyle = hexToRgba(item.color, 0.25);
            ctx.fill();
          }
          ctx.stroke();
          break;

        case 'arrow':
          drawArrow(ctx, item.x1, item.y1, item.x2, item.y2, item.color, item.strokeWidth);
          break;

        case 'line':
          ctx.strokeStyle = item.color;
          ctx.lineWidth = item.strokeWidth;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(item.x1, item.y1);
          ctx.lineTo(item.x2, item.y2);
          ctx.stroke();
          break;

        case 'highlighter':
          ctx.save();
          ctx.strokeStyle = item.color;
          ctx.lineWidth = item.strokeWidth || 24;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.globalAlpha = 0.38;
          ctx.beginPath();
          if (item.points && item.points.length > 0) {
            ctx.moveTo(item.points[0].x, item.points[0].y);
            for (let i = 1; i < item.points.length; i++) {
              ctx.lineTo(item.points[i].x, item.points[i].y);
            }
          }
          ctx.stroke();
          ctx.restore();
          break;

        case 'pen':
          ctx.strokeStyle = item.color;
          ctx.lineWidth = item.strokeWidth;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          if (item.points && item.points.length > 0) {
            ctx.moveTo(item.points[0].x, item.points[0].y);
            for (let i = 1; i < item.points.length; i++) {
              ctx.lineTo(item.points[i].x, item.points[i].y);
            }
          }
          ctx.stroke();
          break;

        case 'text':
          drawTextAnnotation(ctx, item);
          break;

        case 'blur':
          drawPixelatedArea(ctx, item.x, item.y, item.width, item.height);
          break;

        case 'step':
          drawStepBadge(ctx, item.x, item.y, item.number, item.color);
          break;
      }

      ctx.restore();

      // Draw Selection Bounding Box
      if (!isExport && item === selectedAnnotation) {
        drawSelectionBox(ctx, item);
      }
    }
  }

  function hexToRgba(hex, alpha) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map((x) => x + x).join('');
    const num = parseInt(c, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function getBounds(item) {
    if (item.type === 'rectangle' || item.type === 'ellipse' || item.type === 'blur') {
      const x = Math.min(item.x, item.x + item.width);
      const y = Math.min(item.y, item.y + item.height);
      const w = Math.abs(item.width);
      const h = Math.abs(item.height);
      return { x, y, w, h };
    }
    if (item.type === 'arrow' || item.type === 'line') {
      const x = Math.min(item.x1, item.x2);
      const y = Math.min(item.y1, item.y2);
      const w = Math.max(20, Math.abs(item.x2 - item.x1));
      const h = Math.max(20, Math.abs(item.y2 - item.y1));
      return { x, y, w, h };
    }
    if (item.type === 'step') {
      return { x: item.x - 18, y: item.y - 18, w: 36, h: 36 };
    }
    if (item.type === 'text') {
      annotationCtx.font = `bold ${item.fontSize}px "Plus Jakarta Sans", sans-serif`;
      const lines = String(item.text).split('\n');
      let maxW = 50;
      lines.forEach((l) => {
        const w = annotationCtx.measureText(l).width;
        if (w > maxW) maxW = w;
      });
      const h = item.fontSize * 1.3 * lines.length + 12;
      return { x: item.x - 6, y: item.y - 6, w: maxW + 12, h };
    }
    if (item.points && item.points.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      item.points.forEach((p) => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      });
      return { x: minX - 10, y: minY - 10, w: (maxX - minX) + 20, h: (maxY - minY) + 20 };
    }
    return null;
  }

  function drawSelectionBox(ctx, item) {
    const b = getBounds(item);
    if (!b) return;

    ctx.save();
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);

    // Corner handle dots
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2;

    const handles = [
      { x: b.x - 4, y: b.y - 4 },
      { x: b.x + b.w + 4, y: b.y - 4 },
      { x: b.x - 4, y: b.y + b.h + 4 },
      { x: b.x + b.w + 4, y: b.y + b.h + 4 }
    ];

    handles.forEach((h) => {
      ctx.beginPath();
      ctx.arc(h.x, h.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    ctx.restore();
  }

  function redrawAnnotations() {
    renderAnnotations(annotationCtx);
  }

  // Hit test for selection
  function hitTest(x, y) {
    for (let i = annotations.length - 1; i >= 0; i--) {
      const item = annotations[i];
      const b = getBounds(item);
      if (b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        return item;
      }
    }
    return null;
  }

  // Panning with Spacebar / Middle Mouse
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !isSpacePressed && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      isSpacePressed = true;
      viewport.classList.add('panning');
      e.preventDefault();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      btnUndo.click();
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
      e.preventDefault();
      btnRedo.click();
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedAnnotation && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        btnDeleteSelected.click();
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      isSpacePressed = false;
      if (!isPanning) viewport.classList.remove('panning');
    }
  });

  viewport.addEventListener('mousedown', (e) => {
    if (e.button === 1 || (e.button === 0 && isSpacePressed)) {
      isPanning = true;
      panStartX = e.clientX;
      panStartY = e.clientY;
      scrollStartX = viewport.scrollLeft;
      scrollStartY = viewport.scrollTop;
      viewport.classList.add('panning');
      e.preventDefault();
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (isPanning) {
      const dx = e.clientX - panStartX;
      const dy = e.clientY - panStartY;
      viewport.scrollLeft = scrollStartX - dx;
      viewport.scrollTop = scrollStartY - dy;
    }
  });

  window.addEventListener('mouseup', () => {
    if (isPanning) {
      isPanning = false;
      if (!isSpacePressed) viewport.classList.remove('panning');
    }
  });

  // Canvas Mouse Interactions
  annotationCanvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || isSpacePressed) return;
    const { x, y } = getCanvasCoords(e);

    if (currentTool === 'select') {
      const hit = hitTest(x, y);
      if (hit) {
        selectedAnnotation = hit;
        isDraggingAnnotation = true;
        dragOffset = { x: x - (hit.x || hit.x1 || 0), y: y - (hit.y || hit.y1 || 0) };
        saveState();
      } else {
        selectedAnnotation = null;
      }
      updateSelectionUI();
      redrawAnnotations();
      return;
    }

    if (currentTool === 'text') {
      createTextPrompt(x, y);
      return;
    }

    if (currentTool === 'step') {
      saveState();
      annotations.push({
        type: 'step',
        x,
        y,
        number: stepCounter++,
        color: currentColor
      });
      redrawAnnotations();
      return;
    }

    // Start drawing shape/brush
    isDrawing = true;
    drawStartX = x;
    drawStartY = y;
    currentPathPoints = [{ x, y }];
  });

  annotationCanvas.addEventListener('mousemove', (e) => {
    const { x, y } = getCanvasCoords(e);

    if (isDraggingAnnotation && selectedAnnotation) {
      const dx = x - drawStartX;
      const dy = y - drawStartY;
      if (selectedAnnotation.type === 'arrow' || selectedAnnotation.type === 'line') {
        const lenX = selectedAnnotation.x2 - selectedAnnotation.x1;
        const lenY = selectedAnnotation.y2 - selectedAnnotation.y1;
        selectedAnnotation.x1 = x - dragOffset.x;
        selectedAnnotation.y1 = y - dragOffset.y;
        selectedAnnotation.x2 = selectedAnnotation.x1 + lenX;
        selectedAnnotation.y2 = selectedAnnotation.y1 + lenY;
      } else if (selectedAnnotation.points) {
        // move all points
        const offsetX = x - dragOffset.x - selectedAnnotation.points[0].x;
        const offsetY = y - dragOffset.y - selectedAnnotation.points[0].y;
        selectedAnnotation.points.forEach((p) => {
          p.x += offsetX;
          p.y += offsetY;
        });
      } else {
        selectedAnnotation.x = x - dragOffset.x;
        selectedAnnotation.y = y - dragOffset.y;
      }
      redrawAnnotations();
      return;
    }

    if (!isDrawing) return;

    if (currentTool === 'pen' || currentTool === 'highlighter') {
      currentPathPoints.push({ x, y });
      redrawAnnotations();

      // Live stroke preview
      annotationCtx.save();
      annotationCtx.strokeStyle = currentColor;
      annotationCtx.lineWidth = (currentTool === 'highlighter') ? 24 : currentStrokeWidth;
      annotationCtx.lineCap = 'round';
      annotationCtx.lineJoin = 'round';
      if (currentTool === 'highlighter') annotationCtx.globalAlpha = 0.38;
      annotationCtx.beginPath();
      annotationCtx.moveTo(currentPathPoints[0].x, currentPathPoints[0].y);
      for (let i = 1; i < currentPathPoints.length; i++) {
        annotationCtx.lineTo(currentPathPoints[i].x, currentPathPoints[i].y);
      }
      annotationCtx.stroke();
      annotationCtx.restore();
      return;
    }

    // Shapes live preview
    redrawAnnotations();
    annotationCtx.save();

    if (currentTool === 'rectangle') {
      annotationCtx.strokeStyle = currentColor;
      annotationCtx.lineWidth = currentStrokeWidth;
      annotationCtx.beginPath();
      annotationCtx.roundRect(drawStartX, drawStartY, x - drawStartX, y - drawStartY, 6);
      if (isFilled) {
        annotationCtx.fillStyle = hexToRgba(currentColor, 0.25);
        annotationCtx.fill();
      }
      annotationCtx.stroke();
    } else if (currentTool === 'ellipse') {
      annotationCtx.strokeStyle = currentColor;
      annotationCtx.lineWidth = currentStrokeWidth;
      annotationCtx.beginPath();
      const w = x - drawStartX;
      const h = y - drawStartY;
      annotationCtx.ellipse(drawStartX + w / 2, drawStartY + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
      if (isFilled) {
        annotationCtx.fillStyle = hexToRgba(currentColor, 0.25);
        annotationCtx.fill();
      }
      annotationCtx.stroke();
    } else if (currentTool === 'arrow') {
      drawArrow(annotationCtx, drawStartX, drawStartY, x, y, currentColor, currentStrokeWidth);
    } else if (currentTool === 'line') {
      annotationCtx.strokeStyle = currentColor;
      annotationCtx.lineWidth = currentStrokeWidth;
      annotationCtx.lineCap = 'round';
      annotationCtx.beginPath();
      annotationCtx.moveTo(drawStartX, drawStartY);
      annotationCtx.lineTo(x, y);
      annotationCtx.stroke();
    } else if (currentTool === 'blur') {
      drawPixelatedArea(annotationCtx, drawStartX, drawStartY, x - drawStartX, y - drawStartY);
    }

    annotationCtx.restore();
  });

  annotationCanvas.addEventListener('mouseup', (e) => {
    if (isDraggingAnnotation) {
      isDraggingAnnotation = false;
      return;
    }

    if (!isDrawing) return;
    isDrawing = false;
    const { x, y } = getCanvasCoords(e);

    saveState();

    if (currentTool === 'rectangle') {
      annotations.push({
        type: 'rectangle',
        x: Math.min(drawStartX, x),
        y: Math.min(drawStartY, y),
        width: Math.abs(x - drawStartX),
        height: Math.abs(y - drawStartY),
        color: currentColor,
        strokeWidth: currentStrokeWidth,
        filled: isFilled
      });
    } else if (currentTool === 'ellipse') {
      annotations.push({
        type: 'ellipse',
        x: Math.min(drawStartX, x),
        y: Math.min(drawStartY, y),
        width: Math.abs(x - drawStartX),
        height: Math.abs(y - drawStartY),
        color: currentColor,
        strokeWidth: currentStrokeWidth,
        filled: isFilled
      });
    } else if (currentTool === 'arrow') {
      annotations.push({
        type: 'arrow',
        x1: drawStartX,
        y1: drawStartY,
        x2: x,
        y2: y,
        color: currentColor,
        strokeWidth: currentStrokeWidth
      });
    } else if (currentTool === 'line') {
      annotations.push({
        type: 'line',
        x1: drawStartX,
        y1: drawStartY,
        x2: x,
        y2: y,
        color: currentColor,
        strokeWidth: currentStrokeWidth
      });
    } else if (currentTool === 'highlighter') {
      annotations.push({
        type: 'highlighter',
        points: currentPathPoints,
        color: currentColor,
        strokeWidth: 24
      });
    } else if (currentTool === 'pen') {
      annotations.push({
        type: 'pen',
        points: currentPathPoints,
        color: currentColor,
        strokeWidth: currentStrokeWidth
      });
    } else if (currentTool === 'blur') {
      annotations.push({
        type: 'blur',
        x: Math.min(drawStartX, x),
        y: Math.min(drawStartY, y),
        width: Math.abs(x - drawStartX),
        height: Math.abs(y - drawStartY)
      });
    }

    redrawAnnotations();
  });

  // Text Prompt Modal / Inline Input
  function createTextPrompt(x, y) {
    const text = prompt('Enter annotation text:', '');
    if (text && text.trim()) {
      saveState();
      annotations.push({
        type: 'text',
        x,
        y,
        text: text.trim(),
        color: currentColor,
        fontSize: currentFontSize
      });
      redrawAnnotations();
    }
  }

  // ==========================================
  // EXPORT ENGINE: CLIPBOARD & DOWNLOAD
  // ==========================================
  function generateMergedCanvas() {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = baseCanvas.width;
    exportCanvas.height = baseCanvas.height;
    const exportCtx = exportCanvas.getContext('2d');

    // 1. Draw base screenshot
    exportCtx.drawImage(baseCanvas, 0, 0);

    // 2. Draw all vector annotations cleanly on top
    for (const item of annotations) {
      exportCtx.save();
      switch (item.type) {
        case 'rectangle':
          exportCtx.strokeStyle = item.color;
          exportCtx.lineWidth = item.strokeWidth;
          exportCtx.beginPath();
          exportCtx.roundRect(item.x, item.y, item.width, item.height, 6);
          if (item.filled) {
            exportCtx.fillStyle = hexToRgba(item.color, 0.25);
            exportCtx.fill();
          }
          exportCtx.stroke();
          break;

        case 'ellipse':
          exportCtx.strokeStyle = item.color;
          exportCtx.lineWidth = item.strokeWidth;
          exportCtx.beginPath();
          const cx = item.x + item.width / 2;
          const cy = item.y + item.height / 2;
          exportCtx.ellipse(cx, cy, Math.abs(item.width / 2), Math.abs(item.height / 2), 0, 0, Math.PI * 2);
          if (item.filled) {
            exportCtx.fillStyle = hexToRgba(item.color, 0.25);
            exportCtx.fill();
          }
          exportCtx.stroke();
          break;

        case 'arrow':
          drawArrow(exportCtx, item.x1, item.y1, item.x2, item.y2, item.color, item.strokeWidth);
          break;

        case 'line':
          exportCtx.strokeStyle = item.color;
          exportCtx.lineWidth = item.strokeWidth;
          exportCtx.lineCap = 'round';
          exportCtx.beginPath();
          exportCtx.moveTo(item.x1, item.y1);
          exportCtx.lineTo(item.x2, item.y2);
          exportCtx.stroke();
          break;

        case 'highlighter':
          exportCtx.save();
          exportCtx.strokeStyle = item.color;
          exportCtx.lineWidth = item.strokeWidth || 24;
          exportCtx.lineCap = 'round';
          exportCtx.lineJoin = 'round';
          exportCtx.globalAlpha = 0.38;
          exportCtx.beginPath();
          if (item.points && item.points.length > 0) {
            exportCtx.moveTo(item.points[0].x, item.points[0].y);
            for (let i = 1; i < item.points.length; i++) {
              exportCtx.lineTo(item.points[i].x, item.points[i].y);
            }
          }
          exportCtx.stroke();
          exportCtx.restore();
          break;

        case 'pen':
          exportCtx.strokeStyle = item.color;
          exportCtx.lineWidth = item.strokeWidth;
          exportCtx.lineCap = 'round';
          exportCtx.lineJoin = 'round';
          exportCtx.beginPath();
          if (item.points && item.points.length > 0) {
            exportCtx.moveTo(item.points[0].x, item.points[0].y);
            for (let i = 1; i < item.points.length; i++) {
              exportCtx.lineTo(item.points[i].x, item.points[i].y);
            }
          }
          exportCtx.stroke();
          break;

        case 'text':
          drawTextAnnotation(exportCtx, item);
          break;

        case 'blur':
          drawPixelatedArea(exportCtx, item.x, item.y, item.width, item.height);
          break;

        case 'step':
          drawStepBadge(exportCtx, item.x, item.y, item.number, item.color);
          break;
      }
      exportCtx.restore();
    }

    return exportCanvas;
  }

  // Copy to Clipboard
  btnCopy.addEventListener('click', async () => {
    try {
      showToast('Copying screenshot...');
      const mergedCanvas = generateMergedCanvas();

      mergedCanvas.toBlob(async (blob) => {
        if (!blob) throw new Error('Failed to generate image blob');
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          showToast('✓ Screenshot copied to clipboard!');
        } catch (clipErr) {
          console.error('Clipboard API error:', clipErr);
          showToast('Could not access clipboard directly.');
        }
      }, 'image/png');
    } catch (err) {
      console.error(err);
      showToast('Copy failed: ' + err.message);
    }
  });

  // Download Dropdown
  btnDownloadMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    downloadMenu.classList.toggle('hidden');
  });

  document.addEventListener('click', () => {
    downloadMenu.classList.add('hidden');
  });

  downloadMenu.querySelectorAll('.menu-item').forEach((item) => {
    item.addEventListener('click', () => {
      selectedFormat = item.dataset.format;
      downloadMenu.querySelectorAll('.menu-item').forEach((m) => m.classList.remove('active'));
      item.classList.add('active');
      downloadMenu.classList.add('hidden');
      triggerDownload();
    });
  });

  btnDownload.addEventListener('click', () => {
    triggerDownload();
  });

  function triggerDownload() {
    showToast('Preparing download...');
    const mergedCanvas = generateMergedCanvas();
    const mimeType = selectedFormat === 'jpeg' ? 'image/jpeg' : (selectedFormat === 'webp' ? 'image/webp' : 'image/png');
    const ext = selectedFormat === 'jpeg' ? 'jpg' : selectedFormat;

    const dataUrl = mergedCanvas.toDataURL(mimeType, 0.95);
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `screenshot_${dateStr}.${ext}`;

    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();

    showToast(`✓ Downloaded ${filename}`);
  }

  // Initialize
  loadCaptureData();
})();
