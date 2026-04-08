<template>
	<ion-page>
		<ion-header>
			<ion-toolbar>
				<ion-title>Manual Input</ion-title>
			</ion-toolbar>
		</ion-header>
		<ion-content class="ion-padding">
			<ion-card>
				<ion-card-header>
					<ion-card-title>Enter Approval Code</ion-card-title>
					<ion-card-subtitle> Enter the code from the EU food approval mark (e.g., "DE NW 50264 EG") </ion-card-subtitle>
				</ion-card-header>
				<ion-card-content>
					<ion-input v-model="codeInput" label="Approval Code" label-placement="floating" placeholder="e.g. NW 50264" :clear-input="true" @keyup.enter="lookupCode" class="code-input" />

					<ion-button expand="block" @click="lookupCode" :disabled="!codeInput.trim() || isSearching" class="ion-margin-top">
						<ion-icon slot="start" :icon="searchOutline" />
						{{ isSearching ? 'Searching...' : 'Look Up' }}
					</ion-button>
				</ion-card-content>
			</ion-card>

			<!-- Recent examples -->
			<ion-card v-if="!hasSearched">
				<ion-card-header>
					<ion-card-title>Supported Formats</ion-card-title>
				</ion-card-header>
				<ion-card-content>
					<ion-list lines="none">
						<ion-item v-for="example in examples" :key="example" @click="useExample(example)">
							<ion-icon slot="start" :icon="codeOutline" />
							<ion-label>{{ example }}</ion-label>
						</ion-item>
					</ion-list>
				</ion-card-content>
			</ion-card>

			<!-- Error display -->
			<ion-card v-if="errorMessage" color="warning">
				<ion-card-content>
					<ion-icon :icon="alertCircleOutline" />
					{{ errorMessage }}
				</ion-card-content>
			</ion-card>
		</ion-content>
	</ion-page>
</template>

<script setup lang="ts">
	import { ref } from 'vue';
	import { useRouter } from 'vue-router';
	import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent, IonInput, IonButton, IonIcon, IonList, IonItem, IonLabel } from '@ionic/vue';
	import { searchOutline, codeOutline, alertCircleOutline } from 'ionicons/icons';
	import { useNormalizer } from '@/composables/useNormalizer';
	import { useMatcher } from '@/composables/useMatcher';
	import { useDatabase } from '@/composables/useDatabase';
	import { useScanStore } from '@/stores/scan';

	const router = useRouter();
	const scanStore = useScanStore();
	const { normalize } = useNormalizer();
	const { match, isSearching } = useMatcher();
	const { initialize: initDb, isReady: dbReady } = useDatabase();

	const codeInput = ref('');
	const errorMessage = ref('');
	const hasSearched = ref(false);

	const examples = ['DE NW 50264 EG', 'NW 50264', 'BY 12345', 'DE BY 40123 EG', 'FR 12.345.001 CE'];

	function useExample(example: string) {
		codeInput.value = example;
	}

	async function lookupCode() {
		if (!codeInput.value.trim()) return;

		errorMessage.value = '';
		hasSearched.value = true;

		// Ensure DB is ready
		if (!dbReady.value) {
			await initDb();
		}

		try {
			// Normalize the input
			const normalized = normalize(codeInput.value);
			scanStore.setCurrentCode(normalized);

			// Perform matching
			const result = await match(normalized);
			scanStore.setLookupResult(result);

			// Navigate to result view
			router.push('/result');
		} catch (e: any) {
			errorMessage.value = e.message || 'Lookup failed';
		}
	}
</script>

<style scoped>
	.code-input {
		font-size: 1.2rem;
		--padding-start: 8px;
	}
</style>
