# RiverChat

A non-linear chat application that visualizes AI conversations as branching graphs. Branch from any point in a conversation, run multiple models simultaneously, and explore different dialogue paths side by side.

**Live**: [riverchat.app](https://riverchat.app/)

## Features

- **Branching conversations** -- fork from any message to explore different paths on an interactive graph
- **20+ AI models** -- budget to frontier tier, including Claude, GPT, Gemini, Llama, DeepSeek, and more (via OpenRouter)
- **Multi-model responses** -- select multiple models and compare answers side by side
- **Streaming** -- real-time token streaming for all models
- **Web search** -- optionally ground responses with web results
- **Auth and billing** -- Firebase Auth, Stripe subscriptions, and a credit system
- **Dark/light themes** -- glassmorphism UI with theme switching

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vue 3, TypeScript, Vite, Tailwind CSS |
| Graph | Vue Flow |
| Backend | Firebase Cloud Functions (Node.js) |
| Database | Firestore |
| Auth | Firebase Auth |
| Payments | Stripe |
| LLM Routing | OpenRouter (via server-side proxy) |
| Analytics | PostHog |

## Getting Started

### Prerequisites

- Node.js 18+
- A Firebase project
- Stripe account (for billing features)

### Setup

```bash
git clone https://github.com/HanzPo/riverchat.git
cd riverchat
npm install
```

Copy `.env.example` to `.env` and fill in your keys:

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_STREAM_CHAT_URL=
VITE_POSTHOG_KEY=
VITE_POSTHOG_HOST=
```

### Development

```bash
npm run dev        # Start dev server at http://localhost:5173
npm run build      # Production build
npm run test       # Run unit tests
npm run deploy     # Deploy to Firebase
```

## Project Structure

```
riverchat/
  src/
    components/       # Vue components (graph, chat panel, modals, etc.)
    composables/      # State management and logic hooks
    services/         # LLM streaming, Firestore, auth, caching
    config/           # Firebase init, model catalog
    types/            # TypeScript type definitions
    router/           # Vue Router config
    App.vue           # Root component
  functions/
    src/
      functions/      # Cloud Functions (chat proxy, billing, webhooks)
      services/       # Stripe, OpenRouter, credits, usage tracking
      config/         # Model config, subscription tiers
      middleware/     # Auth verification
```

## License

MIT
