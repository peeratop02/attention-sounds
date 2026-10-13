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

In the terminal the panel takes the keyboard:

| Key | Does |
| --- | --- |
| arrows / Tab | move between sounds and buttons |
| Enter | hear the sound and use it |
| `1`-`5` | choose the event to edit (default, done, permission, question, attention) |
| `n` / `b` | next / previous library |
| `t` | test what the event plays now |
| `d` / `m` | follow the default / mute |
| Esc | close |

## Update

```
claude plugin update attention-sounds@peeratop02
```

Then `/reload-plugins` in a running session, or start a new one.

## Sounds

Ships with 18 interface sounds from [Kenney](https://kenney.nl/assets/interface-sounds) (CC0), trimmed and re-encoded.

### Add your own

1. Run `/sound info`. It prints the mod's sounds folder (`Sounds folder: ...`).
2. Make a folder inside it, for example `Mine/`. Each folder shows up as a library in the panel.
3. Drop audio files in: `.m4a`, `.mp3`, `.wav`, `.aiff` or `.caf`. The file name without its extension is the sound's name (`Vine Boom.mp3` becomes `Vine Boom`).
4. Run `/sound` again. No restart needed.

Good sources: `/System/Library/Sounds` on macOS, [Kenney](https://kenney.nl/assets/category:Audio) and [freesound](https://freesound.org) for free packs, any soundboard site for memes.

Short clips that start at once work best. To cut silence from both ends and even out the volume with ffmpeg:

```
ffmpeg -i in.mp3 -af "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,loudnorm" "Mine/My Sound.m4a"
```

A plugin update replaces the installed folder, so keep a copy of your own sounds somewhere else.

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
