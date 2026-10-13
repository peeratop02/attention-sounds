import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const turn = { answer: 'ok', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' } as const

// The engine's side: a store, a player that records, and the events' bottoms.
const engine = (on: On, kept: Record<string, unknown> = {}) => {
  const played: unknown[] = []
  on('audio.play', async (_$, e) => { played.push(e.clip); return { value: undefined } })
  on('store.get', (_$, e) => ({ value: kept[(e as { key: string }).key] }) as never)
  on('store.set', (_$, e) => { const { key, value } = e as { key: string; value: unknown }; kept[key] = value; return { value: undefined } as never })
  const TREE: Record<string, string[]> = { Mine: ['Not Marimba.m4a'], macOS: ['Confirm 1.aiff', 'Ping.aiff', 'Pop.aiff', 'Hero.aiff'], 'iOS Modern': ['Bamboo.m4a'] }
  on('fs.list', (_$, e) => {
    const dir = String((e as { path: string }).path).split('/sounds/')[1]
    const value = dir === undefined ? Object.keys(TREE).map(name => ({ name, kind: 'dir' })) : (TREE[dir] ?? []).map(name => ({ name, kind: 'file' }))
    return { value } as never
  })
  on('ui.open', () => ({ value: { isPlaced: false } }) as never)
  on('turn.complete', () => ({ text: 'ok' }))
  on('classic.PermissionRequest', () => ({}))
  return played
}

// The ring is not awaited by its hook: round trips through the engine let it land.
const settle = async ($: { turn: { complete: (e: never) => Promise<unknown> } }) => { for (let i = 0; i < 5; i++) await $.turn.complete({ ...turn, agentId: 'settle' } as never) }

test('done rings the default sound', async ($, on) => {
  const played = engine(on)
  await $.turn.complete(turn)
  await settle($)
  expect(played).toEqual([{ asset: 'sounds/macOS/Confirm 1.aiff' }])
})

test('stored picks: off is silent, a name plays', async ($, on) => {
  const played = engine(on, { done: 'off', permission: 'Ping' })
  await $.turn.complete(turn)
  await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: {} })
  await settle($)
  expect(played).toEqual([{ asset: 'sounds/macOS/Ping.aiff' }])
})

test('subagent turns stay silent', async ($, on) => {
  const played = engine(on)
  await $.turn.complete({ ...turn, agentId: 'a1' })
  expect(played).toEqual([])
})

test('/sound sets a pick, previews it, and rejects unknown names', async ($, on) => {
  const played = engine(on)
  const run = (args: string) => $.command.run({ command: 'sound', args } as never) as Promise<{ text: string }>
  expect((await run('done nope')).text).toContain('Unknown sound')
  expect((await run('done ping')).text).toBe('done sound: Ping')
  expect((await run('')).text).toContain('done: Ping')
  await $.turn.complete(turn)
  await settle($)
  expect(played).toEqual([{ asset: 'sounds/macOS/Ping.aiff' }, { asset: 'sounds/macOS/Ping.aiff' }])
})

test('/sound test plays a name or an event pick; info is the manual', async ($, on) => {
  const played = engine(on, { done: 'Hero', question: 'off' })
  const run = (args: string) => $.command.run({ command: 'sound', args } as never) as Promise<{ text: string }>
  expect((await run('test bamboo')).text).toBe('Playing Bamboo')
  expect((await run('test pop')).text).toBe('Playing Pop')
  expect((await run('test done')).text).toBe('Playing Hero')
  expect((await run('test')).text).toBe('Playing Confirm 1')
  expect((await run('test question')).text).toContain('off')
  expect((await run('test nope')).text).toContain('Unknown')
  expect((await run('info')).text).toContain('/sound test')
  await settle($)
  expect(played).toEqual(['iOS Modern/Bamboo.m4a', 'macOS/Pop.aiff', 'macOS/Hero.aiff', 'macOS/Confirm 1.aiff'].map(name => ({ asset: `sounds/${name}` })))
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`panel on ${surface}: a chip saves and plays, Play plays the pick`, async ($, on) => {
    const kept: Record<string, unknown> = {}
    const played = engine(on, kept)
    const ui = await $.ui.mount({ plugin: 'attention-sounds', surface, component: 'Pane', requestId: 'sounds', props: {} } as never)
    const press = (key: string) => $.ui.press({ plugin: 'attention-sounds', key })
    expect(await ui.find({ key: 'chip-Confirm 1' })).toBeDefined()
    await press('edit-permission')
    await press('lib-iOS Modern')
    await press('chip-Bamboo')
    expect(kept.permission).toBe('Bamboo')
    await press('play-sound')
    await press('play-permission')
    await press('chip-off')
    expect(kept.permission).toBe('off')
    expect(played).toEqual(['iOS Modern/Bamboo.m4a', 'macOS/Confirm 1.aiff', 'iOS Modern/Bamboo.m4a'].map(name => ({ asset: `sounds/${name}` })))
  })
}

test('names match without case or spaces, in commands and in saved picks', async ($, on) => {
  const played = engine(on, { done: 'NotMarimba' })
  const run = (args: string) => $.command.run({ command: 'sound', args } as never) as Promise<{ text: string }>
  await $.turn.complete(turn)
  await settle($)
  expect((await run('question not marimba')).text).toBe('question sound: Not Marimba')
  expect(played).toEqual([{ asset: 'sounds/Mine/Not Marimba.m4a' }, { asset: 'sounds/Mine/Not Marimba.m4a' }])
})
