<template>
  <div class="settings">
    <div class="toolbar" style="-webkit-app-region: drag">
      <button class="icon-btn" style="-webkit-app-region: no-drag" @click="$emit('back')">← Back</button>
      <span class="title">Settings</span>
    </div>
    <div class="form">
      <label>API URL
        <input v-model="config.apiUrl" placeholder="https://api.openai.com/v1" />
      </label>
      <label>API Key
        <input v-model="config.apiKey" type="password" placeholder="sk-..." />
      </label>
      <label>Model
        <input v-model="config.modelName" placeholder="gpt-3.5-turbo" />
      </label>
      <label>System Prompt
        <textarea v-model="config.systemPrompt" rows="8" placeholder="You are a helpful assistant." />
      </label>
      <button class="save-btn" @click="save">Save</button>
      <span v-if="saved" class="saved-msg">Saved!</span>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { config, saveConfig } from '../store.js'

defineEmits(['back'])

const saved = ref(false)

async function save() {
  await saveConfig()
  saved.value = true
  setTimeout(() => saved.value = false, 1500)
}
</script>

<style scoped>
.settings { display: flex; flex-direction: column; height: 100vh; }
.toolbar { display: flex; align-items: center; gap: 12px; padding: 8px 12px; background: #181825; border-bottom: 1px solid #313244; }
.title { font-weight: 600; font-size: 14px; }
.icon-btn { background: none; border: none; color: #89b4fa; cursor: pointer; font-size: 13px; }
.form { flex: 1; padding: 16px; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; }
label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #a6adc8; }
input, textarea { background: #313244; border: none; border-radius: 6px; color: #cdd6f4; padding: 8px; font-size: 13px; outline: none; resize: none; }
.save-btn { background: #89b4fa; border: none; border-radius: 6px; color: #1e1e2e; cursor: pointer; font-weight: 600; padding: 8px; font-size: 13px; }
.saved-msg { color: #a6e3a1; font-size: 12px; text-align: center; }
</style>
