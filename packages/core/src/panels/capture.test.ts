import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import html2canvas from 'html2canvas';
import { captureChartImage, copyChartImage } from './capture';

vi.mock('html2canvas', () => ({ default: vi.fn() }));

describe('image clipboard', () => {
  afterEach(() => vi.unstubAllGlobals());

  function clipboard() {
    const items: Record<string, Promise<Blob>>[] = [];
    const write = vi.fn(async () => {});
    vi.stubGlobal('navigator', { clipboard: { write } });
    class ImageItem {
      static supports = vi.fn(() => true);
      constructor(data: Record<string, Promise<Blob>>) { items.push(data); }
    }
    vi.stubGlobal('ClipboardItem', ImageItem);
    return { write, items, ImageItem };
  }

  it('starts the clipboard write before asynchronous capture resolves, preserving the user gesture', async () => {
    const { write, items } = clipboard();
    let complete!: (blob: Blob) => void;
    const image = new Promise<Blob>(resolve => { complete = resolve; });
    const copying = copyChartImage(() => image);
    expect(write).toHaveBeenCalledOnce();
    expect(items[0]!['image/png']).toBe(image);
    const blob = new Blob(['png'], { type: 'image/png' });
    complete(blob);
    await copying;
    expect(await items[0]!['image/png']).toBe(blob);
  });

  it('reports denied clipboard access instead of claiming success', async () => {
    const { write } = clipboard();
    write.mockRejectedValue(new Error('Permission denied'));
    await expect(copyChartImage(async () => new Blob(['png']))).rejects.toThrow('Permission denied');
  });

  it('rejects unsupported clipboard APIs or image formats without starting capture', async () => {
    const { ImageItem } = clipboard();
    const capture = vi.fn(async () => new Blob(['png']));
    ImageItem.supports.mockReturnValue(false);
    await expect(copyChartImage(capture)).rejects.toThrow('cannot copy PNG');
    vi.stubGlobal('ClipboardItem', undefined);
    await expect(copyChartImage(capture)).rejects.toThrow('clipboard access is unavailable');
    vi.stubGlobal('navigator', {});
    await expect(copyChartImage(capture)).rejects.toThrow('clipboard access is unavailable');
    expect(capture).not.toHaveBeenCalled();
  });

  it('handles both rendering and synchronous clipboard construction failures without abandoned rejections', async () => {
    clipboard();
    vi.stubGlobal('ClipboardItem', class {
      constructor() { throw new Error('Clipboard construction failed'); }
    });
    await expect(copyChartImage(async () => new Blob(['png']))).rejects.toThrow('Clipboard construction failed');
    await expect(copyChartImage(async () => { throw new Error('Rendering failed'); })).rejects.toThrow('Rendering failed');
  });
});

describe('chart PNG capture', () => {
  beforeEach(() => vi.resetAllMocks());

  function fixture(width = 800, height = 600) {
    const blob = new Blob(['png'], { type: 'image/png' });
    const toBlob = vi.fn<HTMLCanvasElement['toBlob']>(callback => callback(blob));
    const canvas = { toBlob } as HTMLCanvasElement;
    const element = {
      isConnected: true,
      getBoundingClientRect: () => ({ width, height }),
      querySelectorAll: () => [],
    } as HTMLElement;
    vi.mocked(html2canvas).mockResolvedValue(canvas);
    return { blob, element, canvas, toBlob };
  }

  it('captures the displayed region at the requested pixel ratio and encodes a PNG', async () => {
    const { element, blob, toBlob } = fixture();
    expect(await captureChartImage(element, '#123456', 2)).toBe(blob);
    expect(html2canvas).toHaveBeenCalledWith(element, {
      backgroundColor: '#123456', scale: 2, width: 800, height: 600, logging: false, useCORS: true,
    });
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png');
  });

  it.each([[0, 600], [800, 0], [NaN, 600], [800, Infinity]])('rejects an invisible chart sized %s by %s', async (w, h) => {
    const { element } = fixture(w, h);
    await expect(captureChartImage(element, '#000', 1)).rejects.toThrow('visible size');
    expect(html2canvas).not.toHaveBeenCalled();
  });

  it.each([0, -1, NaN, Infinity])('rejects an invalid pixel ratio %s', async scale => {
    const { element } = fixture();
    await expect(captureChartImage(element, '#000', scale)).rejects.toThrow('positive pixel ratio');
    expect(html2canvas).not.toHaveBeenCalled();
  });

  it('rejects a detached chart instead of returning a stale image', async () => {
    const { element, canvas } = fixture();
    Object.defineProperty(element, 'isConnected', { value: false, configurable: true });
    await expect(captureChartImage(element, '#000', 1)).rejects.toThrow('mounted');
    Object.defineProperty(element, 'isConnected', { value: true, configurable: true });
    vi.mocked(html2canvas).mockImplementation(async () => {
      Object.defineProperty(element, 'isConnected', { value: false });
      return canvas;
    });
    await expect(captureChartImage(element, '#000', 1)).rejects.toThrow('removed');
  });

  it('rejects tainted source canvases before the rasterizer can silently omit them', async () => {
    const { element } = fixture();
    const getImageData = vi.fn(() => { throw new Error('Tainted source canvas'); });
    element.querySelectorAll = vi.fn(() => [{
      width: 100, height: 100, getContext: () => ({ getImageData }),
    }]) as unknown as HTMLElement['querySelectorAll'];
    await expect(captureChartImage(element, '#000', 1)).rejects.toThrow('Tainted source canvas');
    expect(html2canvas).not.toHaveBeenCalled();
  });

  it('propagates rasterization failures and null or throwing PNG encoders', async () => {
    const { element, canvas, toBlob } = fixture();
    vi.mocked(html2canvas).mockRejectedValueOnce(new Error('Renderer failed'));
    await expect(captureChartImage(element, '#000', 1)).rejects.toThrow('Renderer failed');
    vi.mocked(html2canvas).mockResolvedValue(canvas);
    toBlob.mockImplementation(callback => callback(null));
    await expect(captureChartImage(element, '#000', 1)).rejects.toThrow('could not encode');
    toBlob.mockImplementation(() => { throw new Error('Encoder failed'); });
    await expect(captureChartImage(element, '#000', 1)).rejects.toThrow('Encoder failed');
  });
});
