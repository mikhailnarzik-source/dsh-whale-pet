// Тест страницы плагина (plugins.detail.section) клиентской половины
// dsh-plugin-whale-pet: грузим собранный lib/client.js как модуль, перехватываем
// фабрику, вызываем apply() с заглушками сервисов и «рендерим» секцию страницы,
// чтобы проверить единый стиль и сохранение настроек питомца.
// Запуск: node --test
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')

let loaded
globalThis.window = { __ModuleLoader__: { load: (entry) => { loaded = entry } } }
new Function(source)()

assert.equal(loaded?.id, 'dsh-plugin-whale-pet', 'фабрика зарегистрирована под именем пакета')

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

const registrations = []
const captured = {}
let language = 'ru'

const ctx = {
  slots: {
    inject: (name, install) => { install(); return () => {} },
    register: (options, component) => {
      captured[options.name] = component
      registrations.push(options)
      return () => {}
    },
  },
  locale: {
    getSnapshot: () => ({ active: language }),
    bind: () => (key) => key,
    register: () => {},
    subscribe: () => () => {},
  },
  sessions: {},
  connection: {},
  remote: {},
}

const plugin = loaded.factory((id) => {
  if (id === 'react') return React
  if (id === 'react-dom') return { createPortal: (node) => node }
  if (id === '@deepseek-ai/dsh-client-ui-primitives') return { IconChevronDownOutlineRegular: () => null }
  throw new Error(`unexpected require: ${id}`)
})

assert.equal(typeof plugin?.apply, 'function', 'фабрика вернула плагин')
assert.ok(Array.isArray(plugin.inject) && plugin.inject.includes('slots'), 'плагин объявляет inject')

plugin.apply(ctx)

assert.ok(captured['shell.overlay'] !== undefined, 'плавающий питомец по-прежнему зарегистрирован')
assert.ok(registrations.some((options) => options.name === 'plugins.detail.section'), 'страница плагина зарегистрирована')

/** Рендер: вызываем функциональные компоненты, пока не останется DOM-узлов. */
function renderTree(node, guard = 0) {
  if (node === null || node === undefined || typeof node !== 'object') return node
  if (typeof node === 'symbol') return node
  let current = node
  let depth = guard
  while (typeof current?.type === 'function' && depth < 20) {
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
  if (Array.isArray(node)) { for (const item of node) collect(item, predicate, found); return found }
  if (predicate(node)) found.push(node)
  for (const child of node.children ?? []) collect(child, predicate, found)
  return found
}

function textOf(node) {
  const parts = []
  collect(node, (item) => typeof item === 'string', parts)
  return parts.join(' ')
}

const DetailSection = captured['plugins.detail.section']
assert.equal(DetailSection({ subject: { kind: 'bundle', pkg: { name: 'dsh-inbox' } } }), null, 'чужая страница не рисуется')

const pageNode = DetailSection({ subject: { kind: 'bundle', pkg: { name: 'dsh-plugin-whale-pet' } } })
assert.equal(typeof pageNode?.type, 'function', 'секция вернула страницу')
const page = renderTree(pageNode)

test('страница плагина в едином стиле', () => {
  assert.equal(page?.props?.['data-dsh-pet-page'], 'page', 'страница помечена data-атрибутом')
  assert.equal(page.props.style.maxWidth, 960, 'центрирование maxWidth 960')
  assert.equal(page.props.style.margin, '0 auto', 'margin auto')
  assert.equal(page.props.style.padding, '24px 28px 40px', 'padding 24/28/40')

  const headers = collect(page, (node) => node.props?.['data-dsh-pet-header'] === 'header')
  assert.equal(headers.length, 1, 'шапка одна')
  const logo = collect(page, (node) => node.props?.style?.width === 52 && node.children?.[0] === '🐳')
  assert.equal(logo.length, 1, 'иконка 🐳 52 в шапке')
  const heading = collect(page, (node) => node.type === 'h1' && node.props?.style?.fontSize === 20)
  assert.equal(heading.length, 1, 'заголовок 20px')
  assert.match(textOf(heading[0]), /Кит-помощник/, 'заголовок из словаря')

  const chips = collect(page, (node) => node.props?.['data-dsh-pet-chip'] === 'status')
  assert.equal(chips.length, 1, 'статус-чип в шапке')
  assert.match(textOf(chips[0]), /На экране/, 'чип показывает состояние питомца')

  const refresh = collect(page, (node) => node.props?.['data-dsh-pet-button'] === 'refresh')
  assert.equal(refresh.length, 1, 'кнопка «Обновить»')
  assert.equal(refresh[0].props.style.height, 32, 'кнопка «Обновить» маленькая (32)')
  assert.match(textOf(refresh[0]), /Обновить/, 'подпись «Обновить» из словаря')
})

test('карточки-секции и настройки питомца', () => {
  const cards = collect(page, (node) => typeof node.props?.['data-dsh-pet-card'] === 'string')
  assert.ok(cards.length >= 2, 'карточки-секции отрисованы')
  assert.ok(cards.every((card) => card.props.style.borderRadius === 14), 'радиус карточек 14')
  assert.ok(cards.every((card) => card.props.style.border === '1px solid var(--dsw-alias-border-l2)'), 'рамка карточек — токен')
  const ids = cards.map((card) => card.props['data-dsh-pet-card'])
  assert.ok(ids.includes('pet') && ids.includes('settings'), 'есть карточки питомца и настроек')

  const checkboxes = collect(page, (node) => node.type === 'input' && node.props?.type === 'checkbox')
  assert.equal(checkboxes.length, 2, 'переключатели показа и анимаций на месте')
  assert.equal(checkboxes[0].props.checked, true, 'питомец показан по умолчанию')

  const selects = collect(page, (node) => node.type === 'select')
  assert.equal(selects.length, 2, 'селекторы области и сна на месте')
  assert.equal(selects[0].props.value, 'global', 'область по умолчанию — все сессии')
  assert.equal(selects[1].props.value, '120000', 'сон по умолчанию — 2 минуты')

  const range = collect(page, (node) => node.type === 'input' && node.props?.type === 'range')
  assert.equal(range.length, 1, 'ползунок размера на месте')
  assert.equal(range[0].props.min, 65)
  assert.equal(range[0].props.max, 160)
  assert.equal(range[0].props.value, 100, 'размер по умолчанию — 100%')

  const reset = collect(page, (node) => node.props?.['data-dsh-pet-button'] === 'secondary')
  assert.equal(reset.length, 1, 'кнопка сброса позиции на месте')
  assert.match(textOf(reset[0]), /Сбросить позицию/, 'подпись кнопки из словаря')
})

test('адаптив и сводный режим', () => {
  const styles = collect(page, (node) => node.type === 'style')
  const css = styles.map((node) => node.children?.join('') ?? '').join('\n')
  assert.match(css, /@media \(max-width: 760px\)/, 'адаптив под узкий экран')
  assert.match(css, /\[data-dsh-pet-page\]\{padding:18px 16px 32px/, 'на узком экране меньше отступы')

  const summaryNode = DetailSection({
    subject: { kind: 'bundle', pkg: { name: 'dsh-plugin-whale-pet' } },
    view: 'summary',
  })
  const summary = renderTree(summaryNode)
  assert.equal(summary?.props?.['data-dsh-pet-card'], 'summary', 'сводка — отдельная карточка')
  assert.match(textOf(summary), /На экране|Скрыт/, 'сводка показывает состояние')
})

test('акцентные цвета — только токены DSH', () => {
  const css = source
  assert.match(css, /dsw-alias-brand-primary/, 'используется брендовый токен')
  assert.match(css, /dsw-alias-state-success-primary/, 'используется токен успеха')
  const pageCode = source.slice(source.indexOf('function WhaleDetailPage'), source.indexOf('function WhaleDetailSummary'))
  assert.doesNotMatch(pageCode, /#[0-9a-fA-F]{3,8}\b/, 'в странице нет жёстких hex-цветов')
})
