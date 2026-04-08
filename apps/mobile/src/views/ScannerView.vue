<template>
	<ion-page>
		<ion-header>
			<ion-toolbar>
				<ion-title>Scan Code</ion-title>
			</ion-toolbar>
		</ion-header>
		<ion-content :fullscreen="true">
			<div class="scanner-container">
				<!-- Camera preview area -->
				<div class="camera-area" ref="cameraAreaRef">
					<!-- Tap to start -->
					<div v-if="!isCameraActive" class="camera-placeholder" @click="startCamera">
						<ion-icon :icon="cameraOutline" size="large" />
						<p>Tap to start scanner</p>
					</div>

					<!-- Video element (web) -->
					<video v-if="isCameraActive && !isNative" ref="videoRef" autoplay playsinline muted class="camera-video" />

					<!-- Scan overlay with guide frame + animated scan line -->
					<div v-if="isCameraActive" class="camera-overlay">
						<div class="scan-guide">
							<!-- Animated scan line -->
							<div v-if="isScanning" class="scan-line" />
						</div>

						<p class="guide-text">
							<template v-if="isProcessingFrame">
								<ion-spinner name="dots" class="inline-spinner" />
								Analyzing...
							</template>
							<template v-else-if="isScanning"> Point at EU approval mark </template>
							<template v-else> Starting scanner... </template>
						</p>

						<!-- Frame counter -->
						<p v-if="isScanning" class="frame-counter">Frames scanned: {{ framesScanned }}</p>

						<!-- Debug OCR Output for Mobile -->
						<div v-if="latestOcrText" class="debug-text">
							<span class="debug-label">Latest Read:</span>
							<span class="debug-val">{{ latestOcrText }}</span>
						</div>
					</div>
				</div>

				<!-- Controls -->
				<div class="controls">
					<ion-button v-if="isCameraActive" expand="block" fill="outline" color="danger" @click="stopCamera">
						<ion-icon slot="start" :icon="closeCircleOutline" />
						Stop Scanner
					</ion-button>
				</div>

				<!-- Error display -->
				<ion-card v-if="errorMessage" color="danger">
					<ion-card-content>
						{{ errorMessage }}
					</ion-card-content>
				</ion-card>
			</div>
		</ion-content>
	</ion-page>
</template>

<script setup lang="ts">
	import { ref, onUnmounted, nextTick } from 'vue';
	import { useRouter } from 'vue-router';
	import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonIcon, IonSpinner, IonCard, IonCardContent } from '@ionic/vue';
	import { cameraOutline, closeCircleOutline } from 'ionicons/icons';
	import { useOcr } from '@/composables/useOcr';
	import { useNormalizer } from '@/composables/useNormalizer';
	import { useMatcher } from '@/composables/useMatcher';
	import { useDatabase } from '@/composables/useDatabase';
	import { useScanStore } from '@/stores/scan';

	const SCAN_INTERVAL_MS = 1500;
	const MIN_CONFIDENCE = 0.7;

	const router = useRouter();
	const scanStore = useScanStore();
	const { recognizeText } = useOcr();
	const { extractCandidates } = useNormalizer();
	const { match } = useMatcher();
	const { initialize: initDb, isReady: dbReady } = useDatabase();

	const isCameraActive = ref(false);
	const isScanning = ref(false);
	const isProcessingFrame = ref(false);
	const errorMessage = ref('');
	const framesScanned = ref(0);
	const latestOcrText = ref('');
	const videoRef = ref<HTMLVideoElement | null>(null);
	const cameraAreaRef = ref<HTMLDivElement | null>(null);
	const isNative = typeof (window as any)?.Capacitor !== 'undefined';

	let mediaStream: MediaStream | null = null;
	let scanInterval: ReturnType<typeof setInterval> | null = null;
	let hasNavigated = false;

	// ---- Camera lifecycle ----

	async function startCamera() {
		errorMessage.value = '';
		framesScanned.value = 0;
		hasNavigated = false;

		// Ensure DB is ready
		if (!dbReady.value) {
			await initDb();
		}

		if (isNative) {
			isCameraActive.value = true;
			await nextTick();
			startScanLoop();
		} else {
			// Web: use getUserMedia
			try {
				if (!navigator.mediaDevices?.getUserMedia) {
					throw new Error('Camera API unavailable. This requires HTTPS or localhost. ' + `Current origin: ${window.location.origin}`);
				}

				mediaStream = await navigator.mediaDevices.getUserMedia({
					video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
				});
				isCameraActive.value = true;

				// Wait for videoRef to render and be ready
				await nextTick();
				await new Promise((r) => setTimeout(r, 100));

				if (videoRef.value) {
					videoRef.value.srcObject = mediaStream;
					// Start scanning once video is playing
					videoRef.value.onplaying = () => {
						startScanLoop();
					};
				}
			} catch (e: any) {
				errorMessage.value = `Camera access denied: ${e.message}`;
			}
		}
	}

	function stopCamera() {
		stopScanLoop();
		isCameraActive.value = false;
		isScanning.value = false;
		isProcessingFrame.value = false;

		if (mediaStream) {
			mediaStream.getTracks().forEach((t) => t.stop());
			mediaStream = null;
		}
	}

	// ---- Auto-scan loop ----

	function startScanLoop() {
		if (scanInterval) return; // Already running
		isScanning.value = true;

		// Run first scan immediately
		processFrame();

		// Then on interval
		scanInterval = setInterval(() => {
			if (!isProcessingFrame.value && !hasNavigated) {
				processFrame();
			}
		}, SCAN_INTERVAL_MS);
	}

	function stopScanLoop() {
		if (scanInterval) {
			clearInterval(scanInterval);
			scanInterval = null;
		}
		isScanning.value = false;
	}

	async function processFrame() {
		if (hasNavigated || !isCameraActive.value) return;

		isProcessingFrame.value = true;

		try {
			let ocrText: string;

			if (isNative) {
				// Native: use Tesseract via recognizeText (ML Kit can be swapped in later)
				// TODO: capture frame via native camera API
				const result = await recognizeText('');
				ocrText = result.text;
			} else {
				// Web: capture frame from video
				ocrText = await captureVideoFrame();
			}

			framesScanned.value++;

			if (!ocrText.trim()) return;

			// Update debug UI
			const strippedText = ocrText.replace(/\s+/g, ' ').trim();
			latestOcrText.value = strippedText.substring(0, 40) + (strippedText.length > 40 ? '...' : '');

			// Debug: log what OCR actually reads
			console.log(`[Scan #${framesScanned.value}] OCR text:`, JSON.stringify(ocrText));

			// Extract candidate codes
			const candidates = extractCandidates(ocrText);

			if (candidates.length > 0) {
				console.log(
					`[Scan #${framesScanned.value}] Candidates:`,
					candidates.map((c) => `${c.normalizedCode} (${c.confidence.toFixed(2)}) raw="${c.raw}"`)
				);
			}

			if (candidates.length === 0) return; // No code found, keep scanning

			// Check best candidate
			const bestCandidate = candidates[0]; // Already sorted by confidence

			if (bestCandidate.confidence >= MIN_CONFIDENCE) {
				// Found a valid code — stop scanning and navigate
				console.log(`[Scan] ✅ Auto-navigating: ${bestCandidate.normalizedCode} (confidence: ${bestCandidate.confidence})`);
				hasNavigated = true;
				stopScanLoop();

				scanStore.setOcrText(ocrText);
				scanStore.setCurrentCode(bestCandidate);

				// Look up in database
				const result = await match(bestCandidate);
				scanStore.setLookupResult(result);

				// Navigate to result
				router.push('/result');
			}
			// If confidence too low, continue scanning silently
		} catch (e: any) {
			// Don't show errors for individual frame failures — just keep scanning
			console.warn('Frame processing error:', e.message);
		} finally {
			isProcessingFrame.value = false;
		}
	}

	async function captureVideoFrame(): Promise<string> {
		if (!videoRef.value) throw new Error('Video not available');

		const video = videoRef.value;
		if (video.videoWidth === 0 || video.videoHeight === 0) {
			throw new Error('Video not ready');
		}

		// Crop to center region, but make the crop EXTREMELY tight.
		// Instead of scanning the entire oval, we just want the text in the middle
		// of the oval, cutting off the actual oval boundaries and background cloth.
		const cropW = Math.round(video.videoWidth * 0.45);
		const cropH = Math.round(video.videoHeight * 0.2);
		const cropX = Math.round((video.videoWidth - cropW) / 2);
		const cropY = Math.round((video.videoHeight - cropH) / 2);

		const canvas = document.createElement('canvas');

		// Keep true resolution for better OCR accuracy instead of aggressive downscaling
		// The crop region is small enough to not freeze the thread.
		// Actually scale UP slightly if the intrinsic video is small, as Tesseract
		// needs characters to be ~30px tall to read accurately.
		let scale = 1;
		if (cropW < 500) scale = 1.5;

		canvas.width = cropW * scale;
		canvas.height = cropH * scale;
		const ctx = canvas.getContext('2d')!;

		// Hardware-accelerated Canvas image processing — massive performance and OCR gain.
		// This turns glossy labels, blue Denim backgrounds, and yellow curves into stark
		// black & white shapes, which Tesseract loves.
		ctx.filter = 'grayscale(1) contrast(400%)';
		// drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh)
		ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);

		// Convert canvas to data URL
		const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
		const result = await recognizeText(dataUrl);
		return result.text;
	}

	// ---- Cleanup ----

	onUnmounted(() => {
		stopCamera();
	});
</script>

<style scoped>
	.scanner-container {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.camera-area {
		flex: 1;
		position: relative;
		background: #000;
		min-height: 300px;
		overflow: hidden;
	}

	.camera-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: rgba(255, 255, 255, 0.8);
		cursor: pointer;
		gap: 12px;
		transition: color 0.2s;
	}

	.camera-placeholder:active {
		color: #fff;
	}

	.camera-placeholder ion-icon {
		font-size: 64px;
		margin-bottom: 4px;
	}

	.camera-placeholder p {
		font-size: 16px;
		font-weight: 500;
	}

	.camera-video {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.camera-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		pointer-events: none;
		z-index: 10;
	}

	.scan-guide {
		width: 280px;
		height: 180px;
		position: relative;
		/* Make it oval to match EU approval marks */
		border: 3px solid var(--ion-color-primary, #3880ff);
		border-radius: 50%;
		box-shadow: 0 0 0 4000px rgba(0, 0, 0, 0.4); /* Darkens everything outside the oval */
		overflow: hidden; /* Contains the scan line inside the oval */
	}

	/* Animated scan line */
	.scan-line {
		position: absolute;
		left: 4px;
		right: 4px;
		height: 2px;
		background: linear-gradient(90deg, transparent 0%, var(--ion-color-primary, #3880ff) 20%, var(--ion-color-primary, #3880ff) 80%, transparent 100%);
		box-shadow:
			0 0 8px var(--ion-color-primary, #3880ff),
			0 0 16px rgba(56, 128, 255, 0.4);
		animation: scanMove 2.5s ease-in-out infinite;
	}

	@keyframes scanMove {
		0%,
		100% {
			top: 4px;
		}
		50% {
			top: calc(100% - 6px);
		}
	}

	.guide-text {
		color: #fff;
		margin-top: 20px;
		font-size: 14px;
		font-weight: 500;
		text-shadow: 0 1px 4px rgba(0, 0, 0, 0.9);
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.inline-spinner {
		width: 16px;
		height: 16px;
		--color: #fff;
	}

	.debug-text {
		margin-top: 10px;
		background: rgba(0, 0, 0, 0.7);
		padding: 6px 12px;
		border-radius: 6px;
		font-family: monospace;
		font-size: 11px;
		color: #00ffcc;
		max-width: 80%;
		text-align: center;
		word-break: break-all;
	}
	.debug-label {
		color: #fff;
		opacity: 0.7;
		margin-right: 4px;
	}

	.frame-counter {
		color: rgba(255, 255, 255, 0.5);
		font-size: 11px;
		margin-top: 8px;
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
	}

	.controls {
		padding: 12px 16px;
	}
</style>
