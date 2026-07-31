<template>
  <div class="fixed top-4 left-4 z-50 flex flex-col gap-2">
    <!-- Logo and River Name -->
    <div
      class="flex items-center gap-3 px-4 py-2 rounded-lg shadow-lg"
      style="background: var(--color-background-secondary); border: 1px solid var(--color-border)"
    >
      <h1
        class="text-sm font-semibold"
        style="color: var(--color-text-primary); letter-spacing: -0.01em"
      >
        🌊 RiverChat
      </h1>
      <span
        v-if="riverName"
        class="text-xs font-medium px-2 py-0.5 rounded-md"
        style="
          color: var(--color-text-secondary);
          background: var(--color-background);
          border: 1px solid var(--color-border);
        "
      >
        {{ riverName }}
      </span>
    </div>

    <!-- Action Buttons -->
    <div class="flex gap-2">
      <button
        @click="$emit('show-rivers')"
        class="btn-material text-xs flex items-center gap-1.5 px-3 py-2"
        title="Manage Rivers (Ctrl+K)"
      >
        <Folder :size="14" />
        <span>Rivers</span>
      </button>
      <button
        class="btn-material p-2 opacity-50 cursor-not-allowed"
        title="Search (coming soon)"
        disabled
      >
        <Search :size="14" />
      </button>
      <button
        @click="$emit('show-help')"
        class="btn-material p-2"
        title="Keyboard Shortcuts (Ctrl+?)"
      >
        <HelpCircle :size="14" />
      </button>
      <button @click="$emit('show-settings')" class="btn-material p-2" title="Settings (Ctrl+,)">
        <Settings :size="14" />
      </button>

      <!-- Auth button - show for anonymous or unauthenticated users -->
      <button
        v-if="!currentUser || currentUser.isAnonymous || isAuthenticating"
        @click="!isAuthenticating && $emit('show-auth')"
        class="btn-material text-xs flex items-center gap-1.5 px-3 py-2"
        :class="{ 'opacity-60 cursor-wait': isAuthenticating }"
        :disabled="isAuthenticating"
        :title="
          isAuthenticating ? 'Signing in...' : currentUser?.isAnonymous ? 'Sign Up' : 'Sign In'
        "
      >
        <UserIcon :size="14" />
        <span>{{
          isAuthenticating ? 'Signing in...' : currentUser?.isAnonymous ? 'Sign Up' : 'Sign In'
        }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Folder, Search, HelpCircle, Settings, User as UserIcon } from 'lucide-vue-next';
import type { ChatPanelUser } from '../composables/useChatPanel';

defineProps<{
  riverName: string | null;
  currentUser: ChatPanelUser | null;
  isAuthenticating: boolean;
}>();

defineEmits<{
  'show-rivers': [];
  'show-help': [];
  'show-settings': [];
  'show-auth': [];
}>();
</script>
