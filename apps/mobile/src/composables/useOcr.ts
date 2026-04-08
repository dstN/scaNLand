import { ref } from 'vue';

/**
 * OCR composable — abstracts on-device text recognition.
 *
 * Primary: Google ML Kit Text Recognition (via Capacitor plugin)
 * Fallback: Tesseract.js (WASM)
 */
export function useOcr() {
	const isProcessing = ref(false);
	const lastError = ref<string | null>(null);

	/**
	 * Recognize text from an image (base64 or file path).
	 * Returns the recognized text string and confidence.
	 */
	async function recognizeText(imageData: string): Promise<OcrResult> {
		isProcessing.value = true;
		lastError.value = null;

		try {
			// Try ML Kit first (native only)
			if (isNativePlatform()) {
				try {
					return await recognizeWithMlKit(imageData);
				} catch (e) {
					console.warn('ML Kit failed, falling back to Tesseract:', e);
				}
			}

			// Fallback: Tesseract.js
			return await recognizeWithTesseract(imageData);
		} catch (e: any) {
			lastError.value = e.message || 'OCR failed';
			return { text: '', confidence: 0, blocks: [] };
		} finally {
			isProcessing.value = false;
		}
	}

	return {
		recognizeText,
		isProcessing,
		lastError,
	};
}

// ---- Types ----

export interface OcrResult {
	text: string;
	confidence: number;
	blocks: OcrTextBlock[];
}

export interface OcrTextBlock {
	text: string;
	confidence: number;
	boundingBox?: { x: number; y: number; width: number; height: number };
}

// ---- Internal ----

function isNativePlatform(): boolean {
	return typeof (window as any)?.Capacitor !== 'undefined';
}

async function recognizeWithMlKit(imageData: string): Promise<OcrResult> {
	// Dynamic import — only loaded on native
	// Use a variable to prevent Vite from resolving this native-only package at dev time
	const mlkitModule = '@capacitor-mlkit/text-recognition';
	const { TextRecognition } = await import(/* @vite-ignore */ mlkitModule).catch(() => {
		throw new Error('ML Kit plugin not available');
	});

	const result = await TextRecognition.recognizeText({ image: imageData });
	// The official plugin returns something like `result.blocks` or `result.text`

	const blocks: OcrTextBlock[] = (result.blocks || []).map((block: any) => ({
		text: block.text || '',
		confidence: block.confidence || 0,
		boundingBox: block.boundingBox,
	}));

	const fullText = blocks.map((b) => b.text).join('\n');
	const avgConfidence = blocks.length > 0 ? blocks.reduce((sum, b) => sum + b.confidence, 0) / blocks.length : 0;

	return { text: fullText, confidence: avgConfidence, blocks };
}

let sharedTesseractWorker: any = null;

async function getTesseractWorker() {
	if (sharedTesseractWorker) return sharedTesseractWorker;

	const Tesseract = await import('tesseract.js');
	// Load only 'eng' since approval codes are just basic alphabet/digits.
	// This saves massive memory overhead and load time over 'eng+deu'.
	sharedTesseractWorker = await Tesseract.createWorker('eng');

	await sharedTesseractWorker.setParameters({
		tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ- .',
	});

	return sharedTesseractWorker;
}

async function recognizeWithTesseract(imageData: string): Promise<OcrResult> {
	const worker = await getTesseractWorker();
	const result = await worker.recognize(imageData);

	// Notice we DO NOT terminate the worker here, so we can reuse it
	// on the next frame instantly.

	const blocks: OcrTextBlock[] = (result.data.lines || []).map((line: any) => ({
		text: line.text?.trim() || '',
		confidence: (line.confidence || 0) / 100,
	}));

	return {
		text: result.data.text,
		confidence: (result.data.confidence || 0) / 100,
		blocks,
	};
}
