<template>
  <div class="chat">
    <div class="toolbar" style="-webkit-app-region: drag">
      <div class="title-area">
        <img src="/icon.png" class="app-icon" />
        <span class="title">CandyPie</span>
      </div>
      <div class="toolbar-actions" style="-webkit-app-region: no-drag">
        <button class="icon-btn pin-btn" :class="{ pinned }" @click="togglePin" title="Pin window">📌</button>
        <button class="icon-btn clear-btn" @click="$emit('clear')" title="Clear chat"><img src="/clean.svg" class="clear-icon" /></button>
        <button class="icon-btn" @click="$emit('settings')" title="Settings">⚙</button>
      </div>
    </div>

    <div class="messages-wrap">
      <div
        class="messages"
        :class="{ 'scrollbar-hover': scrollbarHover }"
        ref="messagesEl"
        @scroll="onMessagesScroll"
        @mousemove="onMessagesMouseMove"
        @mouseleave="scrollbarHover = false"
        @click="onMessagesClick"
      >
        <div v-for="(msg, i) in messages" :key="i" :class="['msg', msg.role]">
          <template v-if="msg.role === 'assistant'">
            <details v-if="parseMsg(msg.rawContent||msg.content).think" class="think-block">
              <summary>Thinking...</summary>
              <div class="think-content" v-html="renderMd(parseMsg(msg.rawContent||msg.content).think)" />
            </details>
            <div class="msg-content" v-html="renderMd(parseMsg(msg.rawContent||msg.content).reply)" />
            <button class="copy-btn" @click="copyMsg(msg.rawContent||msg.content, i)">{{ copiedIdx === i ? '✓ Copied' : '⎘' }}</button>
          </template>
          <div v-else class="msg-content user-content">
            <img v-if="msg.image" :src="msg.image" class="msg-image" />
            <span v-if="msg.content" v-html="escapeHtml(msg.content)" />
          </div>
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
      <button v-if="showScrollBottom" class="scroll-bottom-btn" @click="scrollToBottom">↓ Bottom</button>
    </div>

    <div class="input-row">
      <div class="input-wrap">
        <div v-if="pastedImage" class="image-preview">
          <img :src="pastedImage" />
          <button class="remove-img" @click="pastedImage = null">✕</button>
        </div>
        <textarea
          ref="inputEl"
          v-model="input"
          placeholder="Ask anything... (Enter to send, Shift+Enter for newline)"
          @keydown.enter.exact.prevent="send"
          @keydown.up.exact.prevent="showPreviousAsk"
          @keydown.down.exact.prevent="showNextAsk"
          @paste="onPaste"
          rows="3"
        />
      </div>
      <button
        class="send-btn"
        :class="{ streaming, stopping }"
        @click="streaming ? stop() : send()"
        :disabled="!streaming && !input.trim() && !pastedImage"
      >{{ streaming ? (stopping ? 'Stopping...' : 'Stop') : 'Send' }}</button>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import { marked } from 'marked'
import katex from 'katex'
import { config } from '../store.js'

const props = defineProps({ messages: Array })
const emit = defineEmits(['settings', 'clear', 'update:messages'])

const input = ref('')
const streaming = ref(false)
const streamBuffer = ref('')
const messagesEl = ref(null)
const inputEl = ref(null)
const copiedIdx = ref(null)
const pinned = ref(false)
const pastedImage = ref(null)
const stopping = ref(false)
const showScrollBottom = ref(false)
const activeMessagesBase = ref(null)
const scrollbarHover = ref(false)
const askHistory = ref([])
const askHistoryCursor = ref(-1)
const askHistoryDraft = ref('')

function togglePin() {
  pinned.value = !pinned.value
  window.api.setAlwaysOnTop(pinned.value)
}

function onPaste(e) {
  const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'))
  if (!item) return
  e.preventDefault()
  const reader = new FileReader()
  reader.onload = (ev) => { pastedImage.value = ev.target.result }
  reader.readAsDataURL(item.getAsFile())
}

onMounted(() => {
  inputEl.value?.focus()
  window.api.onChunk((text) => {
    if (!streaming.value) return
    const shouldStick = isNearBottom()
    streamBuffer.value += text
    if (shouldStick) scrollToBottom()
    else nextTick(updateScrollState)
  })
  // store rawContent on assistant messages for history
  window.api.onDone(() => finishStream())
  window.api.onStopped(() => finishStream())
  window.api.onError((err) => {
    if (!streaming.value && !stopping.value) return
    emit('update:messages', [...props.messages, { role: 'assistant', content: `**Error:** ${err}` }])
    streamBuffer.value = ''
    streaming.value = false
    stopping.value = false
    activeMessagesBase.value = null
    updateScrollState()
  })
})

onUnmounted(() => window.api.removeListeners())

function send() {
  const msg = input.value.trim()
  if ((!msg && !pastedImage.value) || streaming.value) return

  const history = props.messages.map(m => ({ role: m.role, content: m.rawContent || m.content }))

  // build content for API (multimodal if image present)
  let apiContent
  if (pastedImage.value) {
    apiContent = [
      ...(msg ? [{ type: 'text', text: msg }] : []),
      { type: 'image_url', image_url: { url: pastedImage.value } }
    ]
  } else {
    apiContent = msg
  }

  const nextMessages = [...props.messages, { role: 'user', content: msg, image: pastedImage.value, rawContent: msg }]
  activeMessagesBase.value = nextMessages
  emit('update:messages', nextMessages)
  addAskHistory(msg)
  input.value = ''
  pastedImage.value = null
  streaming.value = true
  stopping.value = false
  streamBuffer.value = ''
  window.api.sendMessage(apiContent, { ...config }, history)
  scrollToBottom()
}

function addAskHistory(text) {
  const ask = text.trim()
  if (!ask) return
  askHistory.value = [ask, ...askHistory.value.filter(item => item !== ask)].slice(0, 10)
  askHistoryCursor.value = -1
  askHistoryDraft.value = ''
}

function setInputFromHistory(value) {
  input.value = value
  nextTick(() => {
    const el = inputEl.value
    if (!el) return
    el.selectionStart = el.selectionEnd = el.value.length
  })
}

function showPreviousAsk() {
  if (!askHistory.value.length || streaming.value) return
  if (askHistoryCursor.value === -1) {
    askHistoryDraft.value = input.value
    askHistoryCursor.value = 0
  } else {
    askHistoryCursor.value = Math.min(askHistoryCursor.value + 1, askHistory.value.length - 1)
  }
  setInputFromHistory(askHistory.value[askHistoryCursor.value])
}

function showNextAsk() {
  if (askHistoryCursor.value === -1 || streaming.value) return
  if (askHistoryCursor.value > 0) {
    askHistoryCursor.value -= 1
    setInputFromHistory(askHistory.value[askHistoryCursor.value])
  } else {
    askHistoryCursor.value = -1
    setInputFromHistory(askHistoryDraft.value)
    askHistoryDraft.value = ''
  }
}

function stop() {
  if (!streaming.value || stopping.value) return
  stopping.value = true
  window.api.stopMessage()
  finishStream()
}

function finishStream() {
  if (!streaming.value && !stopping.value && !streamBuffer.value) return
  const raw = streamBuffer.value
  if (raw) {
    const base = activeMessagesBase.value || props.messages
    emit('update:messages', [...base, { role: 'assistant', content: parseMsg(raw).reply, rawContent: raw }])
  }
  streamBuffer.value = ''
  streaming.value = false
  stopping.value = false
  activeMessagesBase.value = null
  scrollBottom()
}

function distanceFromBottom() {
  const el = messagesEl.value
  if (!el) return 0
  return el.scrollHeight - el.scrollTop - el.clientHeight
}

function isNearBottom(threshold = 80) {
  return distanceFromBottom() < threshold
}

function updateScrollState() {
  showScrollBottom.value = distanceFromBottom() > 120
}

function onMessagesScroll() {
  updateScrollState()
}

function onMessagesMouseMove(e) {
  const el = messagesEl.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const verticalGutter = el.scrollHeight > el.clientHeight && rect.right - e.clientX <= 16
  const horizontalGutter = el.scrollWidth > el.clientWidth && rect.bottom - e.clientY <= 16
  scrollbarHover.value = verticalGutter || horizontalGutter
}

function scrollToBottom() {
  nextTick(() => {
    const el = messagesEl.value
    if (!el) return
    el.scrollTop = el.scrollHeight
    updateScrollState()
  })
}

function scrollBottom() {
  const shouldStick = isNearBottom()
  nextTick(() => {
    const el = messagesEl.value
    if (!el) return
    if (shouldStick) el.scrollTop = el.scrollHeight
    updateScrollState()
  })
}

function parseMsg(text) {
  const m = (text || '').match(/^<think>([\s\S]*?)<\/think>([\s\S]*)$/s)
  if (m) return { think: m[1].trim(), reply: m[2].trim() }
  return { think: null, reply: text || '' }
}

function renderMd(text) {
  const saved = []
  let t = (text || '')
    .replace(/`{3}[\s\S]*?`{3}|`[^`\n]+`/g, m => (saved.push(m), `\x02${saved.length-1}\x03`))
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => {
      try { return katex.renderToString(m.trim(), { displayMode: true, throwOnError: false, output: 'html' }) }
      catch { return `$$${m}$$` }
    })
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, m) => {
      try { return katex.renderToString(m.trim(), { displayMode: true, throwOnError: false, output: 'html' }) }
      catch { return `\\[${m}\\]` }
    })
    .replace(/\$([^$\n]+?)\$/g, (_, m) => {
      try { return katex.renderToString(m.trim(), { throwOnError: false, output: 'html' }) }
      catch { return `$${m}$` }
    })
    .replace(/\\\(([^)]+?)\\\)/g, (_, m) => {
      try { return katex.renderToString(m.trim(), { throwOnError: false, output: 'html' }) }
      catch { return `\\(${m}\\)` }
    })
    .replace(/\x02(\d+)\x03/g, (_, i) => saved[+i])
  const html = marked.parse(t)
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
.messages-wrap { flex: 1; min-height: 0; position: relative; }
.messages { height: 100%; padding: 12px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
.messages.scrollbar-hover { cursor: pointer; }
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
textarea { background: #313244; border: none; border-radius: 6px; color: #cdd6f4; padding: 8px; font-size: 13px; resize: none; outline: none; width: 100%; box-sizing: border-box; }
.send-btn { min-width: 72px; background: #89b4fa; border: none; border-radius: 6px; color: #1e1e2e; cursor: pointer; font-weight: 600; padding: 0 14px; font-size: 13px; }
.send-btn.streaming { background: #f38ba8; }
.send-btn.stopping { opacity: 0.75; cursor: wait; }
.send-btn:disabled { opacity: 0.4; cursor: default; }
.scroll-bottom-btn { position: absolute; right: 18px; bottom: 12px; border: 1px solid #45475a; border-radius: 999px; background: #313244; color: #cdd6f4; box-shadow: 0 6px 16px rgba(0,0,0,0.28); cursor: pointer; font-size: 12px; font-weight: 600; padding: 6px 10px; }
.scroll-bottom-btn:hover { background: #45475a; }
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
.pin-btn { opacity: 0.4; transition: opacity 0.2s; }
.pin-btn:hover { opacity: 0.8; }
.pin-btn.pinned { opacity: 1; }
.input-wrap { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.image-preview { position: relative; align-self: flex-start; }
.image-preview img { max-height: 80px; border-radius: 6px; display: block; }
.remove-img { position: absolute; top: -6px; right: -6px; background: #45475a; border: none; border-radius: 50%; color: #cdd6f4; cursor: pointer; font-size: 10px; width: 16px; height: 16px; line-height: 16px; padding: 0; text-align: center; }
.msg-image { max-width: 200px; max-height: 150px; border-radius: 6px; display: block; margin-bottom: 4px; }
.user-content { display: flex; flex-direction: column; align-self: flex-end; }
</style>
