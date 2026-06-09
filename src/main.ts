import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { initPostHog, captureException } from './composables/usePostHog';
import './style.css';

// Initialize PostHog before creating the app. Analytics must never prevent
// the app from mounting.
try {
  initPostHog();
} catch (error) {
  console.error('Failed to initialize PostHog analytics:', error);
}

const app = createApp(App);

// Log unhandled component errors (and report them to PostHog if available)
// instead of letting them vanish silently.
app.config.errorHandler = (err, _instance, info) => {
  console.error(`[App] Unhandled component error (${info}):`, err);
  try {
    captureException(err, { type: 'vue_error_handler', info });
  } catch {
    // Reporting must never throw from the error handler itself
  }
};

app.use(router);

app.mount('#app');
