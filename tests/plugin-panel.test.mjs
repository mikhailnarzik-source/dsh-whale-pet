// Тест собственной панели dsh-plugin-whale-pet: клик в левой панели открывает
// ТОЛЬКО настройки кита (ту же страницу, что в «Плагинах»), а не страницу
// плагин-менеджера с описанием, источником и версией. Проверяем:
//   • main-панель с ключом `plugin-whale` регистрируется всегда;
//   • строка `sidebar.panellist` с id `plugin-whale` — только по pinned из
//     localStorage `dsh-polish:panel-visibility`;
//   • смена состояния и CustomEvent `dsh-polish:panels-changed` включают и
//     снимают строку без перезагрузки.
// Запуск: node --test
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const PANEL_ID = 'plugin-whale'
const PANEL_STATE_KEY = 'dsh-polish:panel-visibility'
const PANELS_CHANGED_EVENT = 'dsh-polish:panels-changed'

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')

let loaded
const listeners = new Map()

function createStorage(entries = {}) {
  const data = new Map(Object.entries(entries))
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)) },
    removeItem: (key) => { data.delete(key) },
  }
}

const windowStub = {
  __ModuleLoader__: { load: (entry) => { loaded = entry } },
  localStorage: createStorage(),
  addEventListener(type, callback) {
    if (!listeners.has(type)) listeners.set(type, new Set())
    listeners.get(type).add(callback)
  },
  removeEventListener(type, callback) {
    listeners.get(type)?.delete(callback)
  },
  dispatchEvent(event) {
    for (const callback of [...(listeners.get(event.type) ?? [])]) callback(event)
    return true
  },
}

globalThis.window = windowStub
new Function(source)()

assert.equal(loaded?.id, 'dsh-plugin-whale-pet', 'фабрика загружена под именем пакета')

class FakeComponent {
  constructor(props) { this.props = props }
  setState() {}
}

const React = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect: () => {},
  useRef: (value) => ({ current: value }),
  Component: FakeComponent,
  Fragment: Symbol('fragment'),
}

const plugin = loaded.factory((id) => {
  if (id === 'react') return React
  if (id === 'react-dom') return { createPortal: (node) => node }
  if (id === '@deepseek-ai/dsh-client-ui-primitives') return { IconChevronDownOutlineRegular: () => null }
  throw new Error(`unexpected require: ${id}`)
})

/** Свежий стенд: реестр слотов, эффекты и контекст плагина для одного apply. */
function createHarness() {
  const registry = new Map()
  const effects = []
  const register = (options, component) => {
    const key = options.key ?? options.id ?? 'default'
    let bucket = registry.get(options.name)
    if (bucket === undefined) {
      bucket = new Map()
      registry.set(options.name, bucket)
    }
    bucket.set(key, { options, component })
    return () => { bucket.delete(key) }
  }
  const slots = {
    inject(_name, install) {
      const dispose = install()
      return () => { if (typeof dispose === 'function') dispose() }
    },
    register,
    list(name) { return [...(registry.get(name)?.values() ?? [])] },
  }
  const ctx = {
    slots,
    locale: {
      getSnapshot: () => ({ active: 'ru' }),
      subscribe: () => () => {},
      bind: () => (key) => key,
      register: () => {},
    },
    sessions: {},
    connection: {},
    remote: {},
    effect(callback, label) {
      const dispose = callback()
      effects.push({ label, dispose })
      return () => { if (typeof dispose === 'function') dispose() }
    },
  }
  return {
    ctx,
    slots,
    effects,
    apply() { plugin.apply(ctx) },
    dispose() { for (const effect of effects) if (typeof effect.dispose === 'function') effect.dispose() },
  }
}

/** Рендер страницы: вызываем функциональные компоненты до DOM-узлов. */
function renderTree(node, guard = 0) {
  if (node === null || node === undefined || typeof node !== 'object') return node
  if (typeof node === 'symbol') return node
  let current = node
  let depth = guard
  while (typeof current?.type === 'function' && depth < 30) {
    current = current.type(current.props ?? {})
    depth += 1
    if (current === null || current === undefined) return null
  }
  if (typeof current?.type !== 'string') return current
  current.children = (current.children ?? []).map((child) => (Array.isArray(child) ? child.map(renderTree) : renderTree(child)))
  return current
}

function collect(node, predicate, found = []) {
  if (typeof node === 'string' || typeof node === 'number') {
    if (predicate(node)) found.push(node)
    return found
  }
  if (node === null || node === undefined || typeof node !== 'object') return found
  if (Array.isArray(node)) {
    for (const item of node) collect(item, predicate, found)
    return found
  }
  if (predicate(node)) found.push(node)
  for (const child of node.children ?? []) collect(child, predicate, found)
  return found
}

function textOf(node) {
  const parts = []
  collect(node, (item) => typeof item === 'string', parts)
  return parts.join(' ')
}

function panelOf(app) {
  return app.slots.list('main').find((entry) => entry.options.key === PANEL_ID)
}

function sidebarOf(app) {
  return app.slots.list('sidebar.panellist').find((entry) => entry.options.id === PANEL_ID)
}

function setPinned(...ids) {
  windowStub.localStorage.setItem(PANEL_STATE_KEY, JSON.stringify({ visible: [...ids], pinned: [...ids] }))
}

test('main-панель plugin-whale: только настройки, без обвязки плагин-менеджера', () => {
  windowStub.localStorage = createStorage()
  const app = createHarness()
  app.apply()

  const main = panelOf(app)
  assert.ok(main, 'main-панель с ключом plugin-whale зарегистрирована')
  const page = renderTree(main.component({}))

  assert.equal(page?.props?.['data-dsh-whale-panel'], 'panel', 'обёртка панели помечена data-атрибутом')
  const inner = collect(page, (node) => node?.props?.['data-dsh-pet-page'] === 'page')[0]
  assert.ok(inner, 'внутри панели — существующая страница настроек кита')
  assert.equal(inner.props.style.maxWidth, 960, 'центрирование maxWidth 960')
  assert.equal(inner.props.style.margin, '0 auto', 'margin auto')
  assert.equal(inner.props.style.padding, '24px 28px 40px', 'padding 24/28/40')

  const headers = collect(page, (node) => node?.props?.['data-dsh-pet-header'] === 'header')
  assert.equal(headers.length, 1, 'шапка одна')
  const logo = collect(inner, (node) => node?.props?.style?.width === 52 && node.children?.[0] === '🐳')
  assert.equal(logo.length, 1, 'в шапке эмодзи 🐳 52')
  const heading = collect(inner, (node) => node.type === 'h1' && node.props?.style?.fontSize === 20)
  assert.equal(heading.length, 1, 'заголовок 20px')
  assert.match(textOf(heading[0]), /Кит-помощник/, 'название из словаря')
  const subtitle = collect(inner, (node) => node.type === 'p' && node.props?.style?.fontSize === 12.5)
  assert.ok(subtitle.length >= 1, 'подзаголовок в шапке')

  const text = textOf(page)
  assert.doesNotMatch(text, /Описание/, 'в панели нет блока «Описание»')
  assert.doesNotMatch(text, /Источник/, 'в панели нет блока «Источник»')
  assert.doesNotMatch(text, /Версия/, 'в панели нет блока «Версия»')
  assert.doesNotMatch(text, /dsh-plugin-whale-pet/, 'в панели нет имени пакета из плагин-менеджера')

  app.dispose()
})

test('строка левой панели: по умолчанию закреплена, id и key совпадают', () => {
  windowStub.localStorage = createStorage()
  const app = createHarness()
  app.apply()

  const sidebar = sidebarOf(app)
  assert.ok(sidebar, 'строка sidebar.panellist зарегистрирована')
  assert.equal(sidebar.options.id, PANEL_ID, 'id строки — plugin-whale')
  assert.equal(panelOf(app)?.options.key, PANEL_ID, 'ключ main-панели — plugin-whale')
  assert.equal(sidebar.options.order, 29, 'порядок строки — 20 + индекс 9')
  assert.match(sidebar.options.label(), /Кит-помощник/, 'подпись — название плагина')

  const icon = sidebar.component({ size: 16, active: false })
  assert.equal(icon?.props?.['data-dsh-whale-icon'], 'sidebar', 'иконка строки — эмодзи-компонент')
  assert.equal(icon.children?.[0], '🐳')

  app.dispose()
})

test('main-панель есть всегда, строка — только при pinned', () => {
  windowStub.localStorage = createStorage({
    [PANEL_STATE_KEY]: JSON.stringify({ visible: ['whale'], pinned: [] }),
  })
  const app = createHarness()
  app.apply()

  assert.ok(panelOf(app), 'main-панель зарегистрирована и без закрепления')
  assert.equal(sidebarOf(app), undefined, 'незакреплённая панель не попадает в левую панель')

  app.dispose()
})

test('событие dsh-polish:panels-changed перерегистрирует строку без перезагрузки', () => {
  windowStub.localStorage = createStorage({
    [PANEL_STATE_KEY]: JSON.stringify({ visible: ['whale'], pinned: ['whale'] }),
  })
  const app = createHarness()
  app.apply()
  assert.ok(sidebarOf(app), 'закреплённая панель видна')

  setPinned() // открепили
  windowStub.dispatchEvent({ type: PANELS_CHANGED_EVENT })
  assert.equal(sidebarOf(app), undefined, 'после события откреплённая строка исчезла')
  assert.ok(panelOf(app), 'main-панель осталась')

  setPinned('whale') // закрепили обратно
  windowStub.dispatchEvent({ type: PANELS_CHANGED_EVENT })
  assert.ok(sidebarOf(app), 'после события строка вернулась')
  assert.equal(sidebarOf(app).options.id, PANEL_ID)

  app.dispose()
  setPinned('whale')
  windowStub.dispatchEvent({ type: PANELS_CHANGED_EVENT })
  assert.equal(sidebarOf(app), undefined, 'после dispose подписка на событие снята')
})
