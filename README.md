# WebShot - Full Page Screenshot & Annotation Chrome Extension

A Google Chrome Extension (Manifest V3) designed to capture full scrollable web pages, visible viewports, or custom areas, with a modern flat & minimal studio for editing, annotating, copying, and downloading.

---

## Features

- **Full Page Screenshot Engine**:
  - Automatically scrolls down the webpage, captures chunks with `chrome.tabs.captureVisibleTab`, and intelligently stitches them into a lossless canvas image.
  - Temporarily suppresses fixed/sticky headers during scrolling to avoid duplicate headers across the full page.
  - Slices remaining tail chunks accurately with device pixel ratio scaling.
  - Uses IndexedDB for multi-megabyte / high-resolution storage to prevent memory limits.
- **Capture Modes**:
  - **Full Page**: Captures the entire scrollable height of the document.
  - **Visible Area**: Captures current visible viewport.
  - **Selected Area**: Interactive dark backdrop overlay with crosshair cursor and live pixel dimensions to drag and crop any custom region.
- **Modern Flat & Minimal Studio**:
  - **Shapes**: Outlined or semi-transparent filled Rectangles and Circles/Ellipses.
  - **Arrows**: Clean vector directional arrows with proportional arrowheads.
  - **Lines**: Straight precision lines.
  - **Highlighter**: Translucent marker with soft blending over text without obscuring readability.
  - **Freehand Pen**: Smooth anti-aliased drawing.
  - **Text Annotation**: Clean typography callouts with customizable font sizes.
  - **Blur / Redact**: Instant privacy pixelation mask to censor sensitive emails, passwords, and tokens.
  - **Step Counters**: 1, 2, 3 numbered callout badges for how-to guides and tutorials.
- **Export & Sharing**:
  - **1-Click Copy**: Merges the screenshot and all vector annotations, copies directly to clipboard via `ClipboardItem` with toast feedback.
  - **Download Options**: Exports lossless PNG, compact JPEG, or modern WebP.
  - **History**: Full Undo/Redo (`Ctrl+Z`, `Ctrl+Y`), Clear all, and Delete selected annotations.
  - **Navigation**: Mouse wheel zoom, Fit-to-screen, 1:1 Actual size, and Spacebar + Drag panning.

---

## How to Install in Google Chrome

1. Open **Google Chrome**.
2. Navigate to `chrome://extensions/` in the address bar.
3. Toggle on **Developer mode** in the top-right corner.
4. Click the **Load unpacked** button in the top-left corner.
5. Select this folder:
   ```
   c:\Users\AbdullahPC\Downloads\webshot
   ```
6. The **WebShot** extension icon will now appear in your Chrome toolbar!

---

## File Structure

```
webshot/
├── manifest.json         # Manifest V3 extension configuration
├── background.js         # Service worker: coordinates tab scrolling, chunks & stitching
├── content.js            # Content script: measurements, sticky header de-duplication, area selector
├── icons/                # Extension icons (16, 32, 48, 128 px)
├── popup/
│   ├── popup.html        # Trigger popup with modern flat design
│   ├── popup.css         # Minimal dark UI styles
│   └── popup.js          # Trigger actions & progress tracking
└── editor/
    ├── editor.html       # Full screen annotation studio
    ├── editor.css        # Studio styles (flat, minimal, dark aesthetic)
    ├── editor.js         # Vector annotation engine, zoom/pan, clipboard & download
    └── storage.js        # IndexedDB storage adapter
```
