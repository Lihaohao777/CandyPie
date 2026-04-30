<template>
  <div class="app" @keydown.esc="hide">
    <ChatView v-show="view === 'chat'" @settings="view = 'settings'" :messages="messages" @update:messages="messages = $event" @clear="messages = []" />
    <SettingsView v-if="view === 'settings'" @back="view = 'chat'" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import ChatView from './components/ChatView.vue'
import SettingsView from './components/SettingsView.vue'
import { loadConfig } from './store.js'

const view = ref('chat')
const messages = ref([])

function hide() { window.api.hideWindow() }

onMounted(loadConfig)
</script>

<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, sans-serif; background: #1e1e2e; color: #cdd6f4; }
.app { width: 100vw; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
/* dark scrollbar */
* { scrollbar-width: thin; scrollbar-color: #45475a #1e1e2e; }
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: #1e1e2e; }
::-webkit-scrollbar-thumb { background: #45475a; border-radius: 3px; }
</style>
