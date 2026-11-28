// Barcode scanner: camera + decoder. Loaded only when the scan screen opens.
//
// Decoder: the browser's built-in BarcodeDetector where it exists (Chrome on
// Android), otherwise the bundled ZXing library (public/vendor). Both feed
// the same loop, and a code is accepted only when its check digit is valid
// and the same code was read twice in a row, so a misread never reaches the
// matcher.

import { digitsOnly, hasValidCheckDigit } from './shared/ean.js';

const NATIVE_FORMATS = ['ean_13', 'ean_8', 'upc_a'];
const MAX_W = 1280;

let zxingLoading = null;
function loadZXing() {
  if (window.ZXing) return Promise.resolve(window.ZXing);
  zxingLoading ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = '/vendor/zxing-library.min.js';
    s.onload = () => resolve(window.ZXing);
    s.onerror = () => { zxingLoading = null; reject(new Error('Could not load the barcode reader')); };
    document.head.append(s);
  });
  return zxingLoading;
}

/**
 * A decoder with one method, decode(source) -> [text, …], for a <video>,
 * <canvas> or ImageBitmap. `kind` says which engine is in use.
 */
export async function createDecoder() {
  if ('BarcodeDetector' in window) {
    try {
      const supported = await window.BarcodeDetector.getSupportedFormats();
      const formats = NATIVE_FORMATS.filter((f) => supported.includes(f));
      if (formats.length) {
        const detector = new window.BarcodeDetector({ formats });
        return {
          kind: 'native',
          async decode(source) {
            const found = await detector.detect(source);
            return found.map((b) => b.rawValue);
          },
        };
      }
    } catch { /* fall through to ZXing */ }
  }
  const Z = await loadZXing();
  const hints = new Map();
  hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A]);
  hints.set(Z.DecodeHintType.TRY_HARDER, true);
  const reader = new Z.MultiFormatReader();
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  return {
    kind: 'zxing',
    async decode(source) {
      const sw = source.videoWidth || source.width;
      const sh = source.videoHeight || source.height;
      if (!sw || !sh) return [];
      const scale = Math.min(1, MAX_W / sw);
      canvas.width = Math.round(sw * scale);
      canvas.height = Math.round(sh * scale);
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
      try {
        const bitmap = new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(canvas)));
        return [reader.decode(bitmap, hints).getText()];
      } catch {
        return []; // nothing readable in this frame
      }
    },
  };
}

/** Keep only digits-only strings with a valid check digit (EAN-13/8, UPC-A). */
export function validCodes(texts) {
  return texts.map(digitsOnly).filter((c) => [8, 12, 13].includes(c.length) && hasValidCheckDigit(c));
}

/** Read a barcode from a still photo. Returns the code or null. */
export async function decodePhoto(file) {
  const decoder = await createDecoder();
  const bitmap = await createImageBitmap(file);
  try {
    const [code] = validCodes(await decoder.decode(bitmap));
    return code || null;
  } finally {
    bitmap.close?.();
  }
}

/**
 * Start the camera in `video` and call onCode(code) once a code is confirmed.
 * onState(name) reports: starting | scanning | denied | nocamera | unsupported | error.
 * Returns { stop, toggleTorch, canTorch }.
 */
export async function startScanner(video, { onCode, onState = () => {} }) {
  let stopped = false;
  let stream = null;
  let timer = null;
  let torchOn = false;
  let track = null;

  const stop = () => {
    stopped = true;
    clearTimeout(timer);
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    video.srcObject = null;
  };
  const api = {
    stop,
    canTorch: false,
    async toggleTorch() {
      if (!track || !api.canTorch) return false;
      torchOn = !torchOn;
      try { await track.applyConstraints({ advanced: [{ torch: torchOn }] }); } catch { torchOn = !torchOn; }
      return torchOn;
    },
  };

  if (!navigator.mediaDevices?.getUserMedia) { onState('unsupported'); return api; }
  onState('starting');
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    });
  } catch (e) {
    onState(e?.name === 'NotAllowedError' || e?.name === 'SecurityError' ? 'denied'
      : e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError' ? 'nocamera' : 'error');
    return api;
  }
  if (stopped) { stop(); return api; }

  track = stream.getVideoTracks()[0];
  try { await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }); } catch { /* not supported */ }
  api.canTorch = !!track.getCapabilities?.().torch;
  video.srcObject = stream;
  video.setAttribute('playsinline', '');
  video.muted = true;
  try { await video.play(); } catch { /* autoplay is allowed for muted video */ }

  let decoder;
  try { decoder = await createDecoder(); } catch { stop(); onState('error'); return api; }
  if (stopped) return api;
  onState('scanning');

  let last = null;
  const tick = async () => {
    if (stopped) return;
    let code = null;
    if (video.readyState >= 2) {
      try { [code] = validCodes(await decoder.decode(video)); } catch { code = null; }
    }
    if (stopped) return;
    if (code && code === last) { // same valid code twice in a row
      stop();
      onCode(code);
      return;
    }
    last = code;
    timer = setTimeout(tick, code ? 60 : 140);
  };
  tick();
  return api;
}
