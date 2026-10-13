import type { Hook, PluginOptions, Register } from 'claude-code'

export type Action = 'done' | 'permission' | 'question' | 'attention'
type Engine = Parameters<Hook<'turn.complete'>>[0]

// Each folder in sounds/ is a group; every file in one is a sound, named by its
// file name without the extension and mapped to its path under sounds/.
// The order the libraries are listed in; folders not named here follow, Mine last.
const ORDER = ['Kenney', 'macOS', 'iOS Modern', 'iOS New', 'iOS Classic']
let files: Map<string, string> | undefined
let groups: Map<string, string[]> = new Map()
async function library($: Engine): Promise<Map<string, string>> {
  if (files === undefined) {
    const root = `${$.plugin.root}/sounds`
    const rank = (dir: string) => (ORDER.indexOf(dir) + 1 || ORDER.length) + (dir === 'Mine' ? ORDER.length : 0)
    const dirs = (await $.fs.list(root)).filter(one => one.kind === 'dir').map(one => one.name).sort((x, y) => rank(x) - rank(y) || x.localeCompare(y))
    const listed = await Promise.all(dirs.map(async dir => {
      const names = (await $.fs.list(`${root}/${dir}`)).filter(one => one.kind === 'file').map(one => one.name)
      return [dir, names.sort((x, y) => x.localeCompare(y))] as const
    }))
    const strip = (name: string) => name.replace(/\.[^.]+$/, '')
    groups = new Map(listed.map(([dir, names]) => [dir, names.map(strip)]))
    files = new Map(listed.flatMap(([dir, names]) => names.map(name => [strip(name), `${dir}/${name}`] as const)))
  }
  return files
}

// What the panel shows: the event being edited and the library listed for it.
// ponytail: module variables, so a hot reload resets them; move to $.state if that matters.
let editing = 'done'
let shown: string | undefined
const ROOM = 60

const HINTS: Record<string, string> = {
  sound: 'Used by every event set to Default',
  done: 'Claude finished its turn',
  permission: 'Claude is waiting for your approval',
  question: 'Claude asked you something',
  attention: 'Any other notification',
}

const ACCENT = '#D97757'
const icon = (paths: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${ACCENT}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`
const ICONS: Record<string, string> = {
  bell: icon('<path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z"/><path d="M10 20a2 2 0 0 0 4 0"/>'),
  sound: icon('<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6"/><path d="M18 6.5a8 8 0 0 1 0 11"/>'),
  done: icon('<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5.5-6.5"/>'),
  permission: icon('<path d="M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6z"/><path d="M12 9.5v3.5"/><path d="M12 16v.1"/>'),
  question: icon('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.6 2.6 0 1 1 3.8 2.3c-.8.5-1.3 1-1.3 2"/><path d="M12 17v.1"/>'),
  attention: icon('<path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z"/><path d="M10 20a2 2 0 0 0 4 0"/>'),
}

// Case and spaces are ignored, so `notmarimba` and a pick saved as `NotMarimba` find `Not Marimba`.
const fold = (name: string) => name.toLowerCase().replace(/[\s_]+/g, '')
const named = (sounds: Map<string, string>, what: string): string | undefined =>
  [...sounds.keys()].find(one => fold(one) === fold(what))

const FIELDS = ['sound', 'done', 'permission', 'question', 'attention']
const PANE = 'sounds'
const LABELS: Record<string, string> = {
  sound: 'Default sound',
  done: 'Done',
  permission: 'Permission',
  question: 'Question',
  attention: 'Other attention',
}

// Notification kinds that already ring through their own event.
const ALREADY_RUNG = new Set(['permission_prompt', 'idle_prompt'])

// A pick made with /sound (kept in $.store) wins over the manifest's option.
async function pick($: Engine, options: PluginOptions, field: string): Promise<string> {
  const stored = await $.store.get(field)
  const raw = typeof stored === 'string' ? stored : String(options[field])
  return named(await library($), raw) ?? raw
}

async function play($: Engine, options: PluginOptions, action: Action): Promise<void> {
  const own = await pick($, options, action)
  const name = own === 'default' ? await pick($, options, 'sound') : own
  const file = (await library($)).get(name)
  if (file !== undefined) await $.audio.play({ asset: `sounds/${file}` })
}

// Never awaited: a sound must not hold up the event it announces.
function ring($: Engine, options: PluginOptions, action: Action): void {
  play($, options, action).catch((err: unknown) => $.ui.log(`${$.plugin.name}: ${action} sound failed: ${String(err)}`))
}

const INFO = [
  'Plays a sound when Claude needs you.',
  '',
  'Events:',
  '  done        Claude finished its turn',
  '  permission  Claude waits for a permission answer',
  '  question    Claude asks you a question',
  '  attention   any other notification',
  '',
  'Commands:',
  '  /sound                      open the sound panel (or list picks)',
  '  /sound <event> <name>       use that sound for the event',
  '  /sound <event> default      follow the default sound',
  '  /sound <event> off          mute the event',
  '  /sound sound <name>         change the default sound',
  '  /sound test <name|event>    hear a sound, or what an event plays now',
  '  /sound info                 this manual',
  '',
  'Sounds: each folder in the mod\'s sounds/ is a group; drop a file in one to add it.',
  'Picks are kept across sessions.',
].join('\n')

const names = async ($: Engine): Promise<string> => {
  await library($)
  return [...groups].map(([group, list]) => `${group}: ${list.join(', ')}`).join('\n')
}

// What `/sound test <what>` plays: a sound by name, or an event's current pick.
async function resolve($: Engine, options: PluginOptions, what: string): Promise<string | undefined> {
  const sound = named(await library($), what)
  if (sound !== undefined) return sound
  if (!FIELDS.includes(what)) return undefined
  const own = await pick($, options, what)
  return own === 'default' ? pick($, options, 'sound') : own
}

async function show($: Engine, options: PluginOptions): Promise<string> {
  const lines = await Promise.all(FIELDS.map(async field => `${field}: ${await pick($, options, field)}`))
  return [...lines, `Usage: /sound <${FIELDS.join('|')}> <name|default|off>  ·  /sound test <name|event>  ·  /sound info`, await names($)].join('\n')
}

export const register: Register = (on, options) => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'sound',
      description: 'Show or set notification sounds',
      argumentHint: '[event] [name|default|off] | test [name|event] | info',
    })
    return next(e)
  })

  on('command.run', { command: 'sound' }, async ($, e) => {
    const [field, ...rest] = e.args.trim().split(/\s+/)
    const value = rest.length > 0 ? rest.join(' ') : undefined
    const sounds = await library($)
    if (field === 'info') return { text: `${INFO}\n\nSounds folder: ${$.plugin.root}/sounds\n\n${await names($)}` }
    if (field === 'test') {
      const name = await resolve($, options, value ?? 'sound')
      if (name === undefined) return { text: `Unknown "${value}". Give a sound name or an event: ${FIELDS.join(', ')}` }
      if (name === 'off') return { text: `${value} is off: nothing plays.` }
      void $.audio.play({ asset: `sounds/${sounds.get(name)}` }).catch(() => undefined)
      return { text: `Playing ${name}` }
    }
    if (!field) {
      // Listed afresh on each open, so a file dropped into sounds/ shows up without a reload.
      files = undefined
      // The panel where a surface draws it, the same picks as text where none does.
      const { isPlaced } = await $.ui.open({ id: PANE, title: 'Notification sounds', focus: true, closeOnEscape: true })
      return { text: isPlaced ? 'Sound panel opened.' : await show($, options) }
    }
    if (!FIELDS.includes(field) || value === undefined) return { text: await show($, options) }
    const special = field === 'sound' ? [] : ['default', 'off']
    const picked = special.find(one => one === value.toLowerCase()) ?? named(sounds, value)
    if (picked === undefined) return { text: `Unknown sound "${value}". ${await names($)}` }
    await $.store.set(field, picked)
    if (sounds.has(picked)) void $.audio.play({ asset: `sounds/${sounds.get(picked)}` }).catch(() => undefined)
    return { text: `${field} sound: ${picked}` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    // The terminal's table has no Svg: the icons are for the other surfaces.
    const Svg = e.surface === 'terminal' ? undefined : $.ui.resolve(e).Svg
    const sounds = await library($)
    const picks = Object.fromEntries(await Promise.all(FIELDS.map(async field => [field, await pick($, options, field)] as const)))
    const current = picks[editing] ?? 'default'
    // An event on Default or Mute opens on the default sound's library.
    const heard = sounds.has(current) ? current : picks.sound ?? ''
    const home = [...groups].find(([, list]) => list.includes(heard))?.[0]
    const group = shown !== undefined && groups.has(shown) ? shown : home ?? [...groups.keys()][0] ?? ''
    const chips = (groups.get(group) ?? []).slice(0, ROOM)
    // Terminal only: hotkeys, and the focus ring starting on the current sound.
    const key = (hotkey: string | undefined) => (e.surface === 'terminal' && hotkey !== undefined ? { hotkey } : {})
    const tabs = [...groups.keys()].slice(0, ROOM)
    const at = tabs.indexOf(group)
    const start = chips.includes(current) ? current : chips[0]
    const assign = async (name: string) => {
      await $.store.set(editing, name)
      play(name === 'default' ? picks.sound ?? '' : name)
      $.ui.invalidate('ui.render')
    }
    const play = (name: string) => {
      const file = sounds.get(name)
      if (file !== undefined) void $.audio.play({ asset: `sounds/${file}` }).catch(() => undefined)
    }
    const described = (field: string) =>
      picks[field] === 'default' ? `Default · ${picks.sound}` : picks[field] === 'off' ? 'Muted' : picks[field]

    return (
      <Box flexDirection="column" gap={1} padding={1}>
        <Box flexDirection="row" gap={1} alignItems="center">
          {Svg && <Svg source={ICONS.bell ?? ''} alt="Bell" width={28} height={28} />}
          <Box flexDirection="column">
            <Text bold>Notification sounds</Text>
            <Text dimColor>Choose what plays when Claude needs you.</Text>
          </Box>
        </Box>

        <Box flexDirection="column" gap={1} paddingX={1} borderStyle="round" borderColor="subtle">
          {FIELDS.map(field => (
            <Box key={`row-${field}`} flexDirection="row" gap={1} alignItems="center">
              {Svg && <Svg source={ICONS[field] ?? ''} alt={LABELS[field] ?? field} width={20} height={20} />}
              <Box flexDirection="column" flexGrow={1}>
                <Text bold color={field === editing ? 'claude' : 'text'}>
                  {LABELS[field]}
                </Text>
                <Text dimColor>{HINTS[field]}</Text>
              </Box>
              <Button key={`play-${field}`} plain dimColor {...key(field === editing ? 't' : undefined)} onPress={async () => play((await resolve($, options, field)) ?? '')}>
                ▶
              </Button>
              <Button
                key={`edit-${field}`}
                {...key(String(FIELDS.indexOf(field) + 1))}
                variant={field === editing ? 'primary' : 'secondary'}
                onPress={() => {
                  editing = field
                  shown = undefined
                  $.ui.invalidate('ui.render')
                }}
              >
                {described(field)}
              </Button>
            </Box>
          ))}
        </Box>

        <Box flexDirection="column" gap={1} paddingX={1} borderStyle="round" borderColor="claude">
          <Box flexDirection="row" gap={1} alignItems="center">
            <Box flexGrow={1}>
              <Text bold>
                Sound for <Text color="claude">{LABELS[editing]}</Text>
              </Text>
            </Box>
            {editing !== 'sound' &&
              ['default', 'off'].map(name => (
                <Button key={`chip-${name}`} variant={name === current ? 'primary' : 'secondary'} {...key(name === 'default' ? 'd' : 'm')} onPress={() => assign(name)}>
                  {name === 'default' ? `Use default (${picks.sound})` : 'Mute'}
                </Button>
              ))}
          </Box>
          <Box flexDirection="row" flexWrap="wrap" gap={1}>
            {tabs.map((name, i) => (
              <Button
                key={`lib-${name}`}
                {...key(tabs.length < 2 ? undefined : i === (at + 1) % tabs.length ? 'n' : i === (at + tabs.length - 1) % tabs.length ? 'b' : undefined)}
                plain
                dimColor={name !== group}
                onPress={() => {
                  shown = name
                  $.ui.invalidate('ui.render')
                }}
              >
                {name === group ? `● ${name}` : name} <Text dimColor>{groups.get(name)?.length}</Text>
              </Button>
            ))}
          </Box>
          <Box flexDirection="row" flexWrap="wrap" gap={1}>
            {chips.map(name => (
              <Button key={`chip-${name}`} variant={name === current ? 'primary' : 'secondary'} {...(name === start ? { autoFocus: true as const } : {})} onPress={() => assign(name)}>
                {name}
              </Button>
            ))}
          </Box>
          <Text dimColor>
            {e.surface === 'terminal'
              ? 'arrows move · enter hears and uses · 1-5 event · n/b library · t test · d default · m mute · esc closes'
              : 'Click a sound to hear it and use it.'}{' '}
            Add your own: see /sound info.
          </Text>
        </Box>
      </Box>
    )
  })

  on('turn.complete', ($, e, next) => {
    // Subagent turns and the user's own interrupts need no ring.
    if (e.agentId === undefined && !e.isAborted) ring($, options, 'done')
    return next(e)
  })

  on('classic.PermissionRequest', ($, e, next) => {
    ring($, options, 'permission')
    return next(e)
  })

  on('tool.call', { tool: 'AskUserQuestion' }, ($, e, next) => {
    ring($, options, 'question')
    return next(e)
  })

  on('classic.Notification', ($, e, next) => {
    if (!ALREADY_RUNG.has(e.notification_type)) ring($, options, 'attention')
    return next(e)
  })
}
