import { reactive } from 'vue'

export const config = reactive({
  apiUrl: 'https://api.openai.com/v1',
  apiKey: '',
  modelName: 'gpt-3.5-turbo',
  systemPrompt: '',
  reasoningEnabled: false
})

function plainConfig() {
  return {
    apiUrl: config.apiUrl,
    apiKey: config.apiKey,
    modelName: config.modelName,
    systemPrompt: config.systemPrompt,
    reasoningEnabled: config.reasoningEnabled
  }
}

export async function loadConfig() {
  const saved = await window.api.loadConfig()
  Object.assign(config, {
    apiUrl: saved.apiUrl ?? config.apiUrl,
    apiKey: saved.apiKey ?? config.apiKey,
    modelName: saved.modelName ?? config.modelName,
    systemPrompt: saved.systemPrompt ?? config.systemPrompt,
    reasoningEnabled: saved.reasoningEnabled ?? config.reasoningEnabled
  })
}

export async function saveConfig() {
  await window.api.saveConfig(plainConfig())
}
