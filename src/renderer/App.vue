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
* { scrollbar-width: auto; scrollbar-color: #45475a #1e1e2e; }
::-webkit-scrollbar { width: 12px; height: 12px; cursor: pointer; }
::-webkit-scrollbar-track { background: #1e1e2e; cursor: pointer; }
::-webkit-scrollbar-thumb { background: #45475a; border-radius: 6px; border: 2px solid #1e1e2e; cursor: pointer; }
::-webkit-scrollbar-thumb:hover { background: #585b70; }
::-webkit-scrollbar-corner { background: #1e1e2e; cursor: pointer; }
</style>
