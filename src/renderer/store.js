import { reactive } from 'vue'

export const config = reactive({
  apiUrl: 'https://api.openai.com/v1',
  apiKey: '',
  modelName: 'gpt-3.5-turbo',
  systemPrompt: ''
})

export async function loadConfig() {
  const saved = await window.api.loadConfig()
  Object.assign(config, saved)
}

export async function saveConfig() {
  await window.api.saveConfig({ ...config })
}
