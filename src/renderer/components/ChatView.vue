<template>
  <div class="chat">
    <div class="toolbar" style="-webkit-app-region: drag">
      <div class="title-area">
        <img src="/icon.png" class="app-icon" />
        <span class="title">CandyPie</span>
      </div>
      <div class="toolbar-actions" style="-webkit-app-region: no-drag">
        <button class="icon-btn clear-btn" @click="$emit('clear')" title="Clear chat"><img src="/clean.svg" class="clear-icon" /></button>
        <button class="icon-btn" @click="$emit('settings')" title="Settings">⚙</button>
      </div>
    </div>

    <div class="messages" ref="messagesEl" @click="onMessagesClick">
      <div v-for="(msg, i) in messages" :key="i" :class="['msg', msg.role]">
        <template v-if="msg.role === 'assistant'">
          <details v-if="parseMsg(msg.rawContent||msg.content).think" class="think-block">
            <summary>Thinking...</summary>
            <div class="think-content" v-html="renderMd(parseMsg(msg.rawContent||msg.content).think)" />
          </details>
          <div class="msg-content" v-html="renderMd(parseMsg(msg.rawContent||msg.content).reply)" />
          <button class="copy-btn" @click="copyMsg(msg.rawContent||msg.content, i)">{{ copiedIdx === i ? '✓ Copied' : '⎘' }}</button>
        </template>
        <div v-else class="msg-content" v-html="escapeHtml(msg.content)" />
      </div>
      <div v-if="streaming" class="msg assistant">
        <div v-if="!streamBuffer" class="loading-dots"><span/><span/><span/></div>
        <template v-else>
          <details v-if="parseMsg(streamBuffer).think" class="think-block">
            <summary>Thinking...</summary>
            <div class="think-content" v-html="renderMd(parseMsg(streamBuffer).think)" />
          </details>
          <div class="msg-content" v-html="renderMd(parseMsg(streamBuffer).reply)" />
        </template>
      </div>
    </div>

    <div class="input-row">
      <textarea
        ref="inputEl"
        v-model="input"
        placeholder="Ask anything... (Enter to send, Shift+Enter for newline)"
        @keydown.enter.exact.prevent="send"
        rows="3"
      />
      <button class="send-btn" @click="send" :disabled="streaming || !input.trim()">Send</button>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import { marked } from 'marked'
import { config } from '../store.js'

const props = defineProps({ messages: Array })
const emit = defineEmits(['settings', 'clear', 'update:messages'])

const input = ref('')
const streaming = ref(false)
const streamBuffer = ref('')
const messagesEl = ref(null)
const inputEl = ref(null)
const copiedIdx = ref(null)

onMounted(() => {
  inputEl.value?.focus()
  window.api.onChunk((text) => { streamBuffer.value += text; scrollBottom() })
  // store rawContent on assistant messages for history
  window.api.onDone(() => {
    const raw = streamBuffer.value
    emit('update:messages', [...props.messages, { role: 'assistant', content: parseMsg(raw).reply, rawContent: raw }])
    streamBuffer.value = ''
    streaming.value = false
    scrollBottom()
  })
  window.api.onError((err) => {
    emit('update:messages', [...props.messages, { role: 'assistant', content: `**Error:** ${err}` }])
    streamBuffer.value = ''
    streaming.value = false
  })
})

onUnmounted(() => window.api.removeListeners())

function send() {
  const msg = input.value.trim()
  if (!msg || streaming.value) return
  const history = props.messages.map(m => ({ role: m.role, content: m.rawContent || m.content }))
  emit('update:messages', [...props.messages, { role: 'user', content: msg, rawContent: msg }])
  input.value = ''
  streaming.value = true
  streamBuffer.value = ''
  window.api.sendMessage(msg, { ...config }, history)
  scrollBottom()
}

function scrollBottom() {
  nextTick(() => {
    const el = messagesEl.value
    if (!el) return
    // only auto-scroll if within 80px of bottom
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) {
      el.scrollTop = el.scrollHeight
    }
  })
}

function parseMsg(text) {
  const m = (text || '').match(/^<think>([\s\S]*?)<\/think>([\s\S]*)$/s)
  if (m) return { think: m[1].trim(), reply: m[2].trim() }
  return { think: null, reply: text || '' }
}

function renderMd(text) {
  const html = marked.parse(text || '')
  return html.replace(/<pre><code([^>]*)>([\s\S]*?)<\/code><\/pre>/g, (_, attrs, code) => {
    const raw = code.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\n$/,'')
    const b64 = btoa(unescape(encodeURIComponent(raw)))
    return `<pre><code${attrs}>${code}</code></pre><button class="code-copy-btn" data-b64="${b64}">⎘ Copy</button>`
  })
}

function onMessagesClick(e) {
  const btn = e.target.closest('.code-copy-btn')
  if (!btn || btn.dataset.copied) return
  navigator.clipboard.writeText(decodeURIComponent(escape(atob(btn.dataset.b64))))
  btn.dataset.copied = '1'
  btn.textContent = '✓ Copied!'
  setTimeout(() => { btn.textContent = '⎘ Copy'; delete btn.dataset.copied }, 1500)
}

function escapeHtml(text) {
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

function copyMsg(text, idx) {
  navigator.clipboard.writeText(text)
  copiedIdx.value = idx
  setTimeout(() => copiedIdx.value = null, 1500)
}
</script>

<style scoped>
.chat { display: flex; flex-direction: column; height: 100vh; }
.toolbar { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #181825; border-bottom: 1px solid #313244; cursor: move; }
.title-area { display: flex; align-items: center; gap: 6px; }
.app-icon { width: 24px; height: 24px; object-fit: contain; background: #fff; border-radius: 50%; padding: 2px; }
.title { font-weight: 600; font-size: 14px; }
.toolbar-actions { display: flex; gap: 4px; }
.icon-btn { background: none; border: none; color: #cdd6f4; cursor: pointer; font-size: 14px; padding: 2px 4px; }
.clear-btn { color: #6c7086; font-size: 13px; border-radius: 4px; }
.clear-btn:hover { color: #cdd6f4; }
.clear-icon { width: 20px; height: 20px; object-fit: contain; opacity: 0.6; }
.clear-btn:hover .clear-icon { opacity: 1; }
.messages { flex: 1; padding: 12px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
.msg { display: flex; flex-direction: column; gap: 4px; max-width: 100%; }
.msg.user .msg-content { background: #313244; border-radius: 8px; padding: 8px 12px; font-size: 13px; align-self: flex-end; white-space: pre-wrap; word-break: break-word; }
.msg.assistant .msg-content { font-size: 13px; line-height: 1.6; word-break: break-word; }
.copy-btn { align-self: flex-start; background: none; border: 1px solid #313244; border-radius: 4px; color: #6c7086; cursor: pointer; font-size: 11px; padding: 2px 6px; transition: color 0.2s; }
.copy-btn:hover { color: #cdd6f4; }
.think-block { border: 1px solid #313244; border-radius: 6px; margin-bottom: 6px; font-size: 12px; }
.think-block summary { padding: 4px 8px; cursor: pointer; color: #6c7086; user-select: none; }
.think-block summary:hover { color: #a6adc8; }
.think-content { padding: 8px; color: #6c7086; border-top: 1px solid #313244; }
.input-row { padding: 8px; background: #181825; border-top: 1px solid #313244; display: flex; gap: 8px; }
textarea { flex: 1; background: #313244; border: none; border-radius: 6px; color: #cdd6f4; padding: 8px; font-size: 13px; resize: none; outline: none; }
.send-btn { background: #89b4fa; border: none; border-radius: 6px; color: #1e1e2e; cursor: pointer; font-weight: 600; padding: 0 14px; font-size: 13px; }
.send-btn:disabled { opacity: 0.4; cursor: default; }
.loading-dots { display: flex; gap: 5px; padding: 6px 0; }
.loading-dots span { width: 7px; height: 7px; border-radius: 50%; background: #89b4fa; animation: bounce 1.2s infinite; }
.loading-dots span:nth-child(2) { animation-delay: 0.2s; }
.loading-dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes bounce { 0%,80%,100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }
.msg-content :deep(p) { margin: 0 0 6px; }
.msg-content :deep(p:last-child) { margin: 0; }
.msg-content :deep(pre) { background: #181825; border-radius: 6px; padding: 10px; overflow-x: auto; font-size: 12px; margin: 6px 0; }
.msg-content :deep(code) { background: #313244; border-radius: 3px; padding: 1px 4px; font-size: 12px; }
.msg-content :deep(pre code) { background: none; padding: 0; }
.msg-content :deep(ul), .msg-content :deep(ol) { padding-left: 20px; margin: 4px 0; }
.msg-content :deep(h1),.msg-content :deep(h2),.msg-content :deep(h3) { margin: 8px 0 4px; }
.msg-content :deep(blockquote) { border-left: 3px solid #89b4fa; margin: 4px 0; padding-left: 10px; color: #a6adc8; }
.msg-content :deep(.code-copy-btn) { display: block; margin: -4px 0 6px; background: #313244; border: none; border-radius: 0 0 6px 6px; color: #89b4fa; cursor: pointer; font-size: 11px; padding: 3px 10px; text-align: left; }
</style>
