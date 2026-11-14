export async function copyChartImage(capture: () => Promise<Blob>): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    throw new Error('Image clipboard access is unavailable. Use a secure browser context or choose Download PNG.');
  }
  if (typeof ClipboardItem.supports === 'function' && !ClipboardItem.supports('image/png')) {
    throw new Error('This browser cannot copy PNG images. Choose Download PNG instead.');
  }
  const image = capture();
  // Start writing within the click gesture; rendering resolves the promised PNG later.
  const write = new Promise<void>((resolve, reject) => {
    try {
      navigator.clipboard.write([new ClipboardItem({ 'image/png': image })]).then(resolve, reject);
    } catch (error) {
      reject(error);
    }
  });
  const [rendered, written] = await Promise.allSettled([image, write]);
  if (rendered.status === 'rejected') throw rendered.reason;
  if (written.status === 'rejected') throw written.reason;
}

export async function captureChartImage(element: HTMLElement, backgroundColor: string, scale: number): Promise<Blob> {
  const { width, height } = element.getBoundingClientRect();
  if (!element.isConnected || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('The chart must be mounted with a visible size before capturing.');
  }
  if (!Number.isFinite(scale) || scale <= 0) throw new Error('Chart capture requires a positive pixel ratio.');
  for (const canvas of element.querySelectorAll('canvas')) {
    if (!canvas.width || !canvas.height) continue;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to read a chart canvas.');
    context.getImageData(0, 0, 1, 1);
  }
  const { default: html2canvas } = await import('html2canvas');
  const image = await html2canvas(element, {
    backgroundColor, scale, width, height, logging: false, useCORS: true,
  });
  if (!element.isConnected) throw new Error('The chart was removed before capture completed.');
  return new Promise<Blob>((resolve, reject) => {
    image.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('The browser could not encode the chart as a PNG. Try a smaller chart.'));
    }, 'image/png');
  });
}
