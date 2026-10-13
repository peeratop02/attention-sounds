# attention-sounds

A Claude Code mod that plays a sound when Claude needs you, so you can do other things while it works.

| Event | Rings when |
| --- | --- |
| `done` | Claude finished its turn |
| `permission` | Claude waits for a permission answer |
| `question` | Claude asks you a question |
| `attention` | any other notification |

Each event can use its own sound, follow the default sound, or be muted. Picks are kept across sessions.

## Install

At the prompt of a terminal `claude` session:

```
/plugin install attention-sounds --marketplace peeratop02/attention-sounds
```

Answer `y` to add the marketplace, then pick a scope. Installed at the user scope, it also loads in the desktop app's Code tab.

## Use

```
/sound                      open the sound panel (or list picks)
/sound <event> <name>       use that sound for the event
/sound <event> default      follow the default sound
/sound <event> off          mute the event
/sound sound <name>         change the default sound
/sound test <name|event>    hear a sound, or what an event plays now
/sound info                 the manual and every sound name
```

In the desktop app, `/sound` opens a panel: pick an event, pick a library, click a sound to hear it and use it.

## Sounds

Ships with 18 interface sounds from [Kenney](https://kenney.nl/assets/interface-sounds) (CC0), trimmed and re-encoded.

To add your own, make a folder inside the mod's `sounds/` (for example `sounds/Mine/`) and drop `.m4a`, `.mp3`, `.wav`, `.aiff` or `.caf` files in it. Each folder is a library in the panel; the file name without its extension is the sound's name. Run `/sound` again to pick them up. On macOS, `/System/Library/Sounds` is a good place to copy from.

## Notes

- Tested on macOS only.
- Subagent turns and aborted turns stay silent.

## Develop

```
claude plugin validate .
claude plugin test .
```

## Licence

Code: MIT. Bundled sounds: CC0, by Kenney.
