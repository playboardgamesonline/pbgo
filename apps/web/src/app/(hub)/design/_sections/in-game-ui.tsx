import { PlayersStripView, type StripData } from "@pbgo/core/components/game/players-strip-view"
import { SeatLabel, type SeatSize } from "@pbgo/core/components/game/seat-label"
import { pendingSeats } from "@pbgo/core/lib/pending-seats"
import { defaultSettings, defaultTheme, themeStyle } from "@pbgo/core/lib/settings"
import { baseSkin, fill } from "@pbgo/core/lib/skin"
import { seatTheme } from "@pbgo/core/lib/ui-theme"
import { getGame } from "@pbgo/games"
import { AnnouncementSpecimen } from "../_components/announcement-specimen"
import { GameOverSpecimen } from "../_components/game-over-specimen"
import { Crown, GameScope, TABLE_BACKDROP, type GameLook } from "../_components/game-scope"
import { Bullets, Demo, Section, Snippet } from "../_components/layout"

/** The two games drawn side by side: the live one and the template, whose look is the most different from it */
const SLUGS = ["courtisans", "template"] as const

/**
 * The font stacks of each game, written out. The hub loads neither a game's stylesheet nor its font files, so a family this page
 * cannot load falls to the next one of the stack (Georgia, a serif). Mirrors `games/<slug>/src/styles.css`.
 */
const FONTS: Record<string, GameLook["fonts"]> = {
  courtisans: { body: '"Alegreya Variable", Georgia, serif', title: '"Alegreya Variable", Georgia, serif', accent: '"Typey", Georgia, serif' },
  template: {
    body: '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif',
    title: '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif',
    accent: null,
  },
}

/** `--font-body` of `game.css`, for a game that sets none */
const CORE_FONT = 'ui-rounded, "Avenir Next", "Nunito", system-ui, -apple-system, sans-serif'

async function lookOf(slug: string): Promise<GameLook | null> {
  const game = await getGame(slug)
  if (!game) return null
  const { binding } = game
  const skin = baseSkin(binding, "en")
  const { texts } = skin
  const fonts = FONTS[slug] ?? { body: CORE_FONT, title: CORE_FONT, accent: null }
  return {
    slug,
    name: game.name,
    tokens: themeStyle(defaultSettings(binding)),
    colors: defaultTheme(binding),
    fonts,
    ui: binding.UI_THEME,
    playerColors: skin.playerColors,
    labels: {
      scoreboard: texts.scoreboard,
      winnerTitle: texts.winnerTitle,
      shareResult: texts.shareResult,
      pointsShort: texts.pointsShort,
      players: texts.players,
      playersReady: texts.playersReady,
      seatDone: texts.seatDone,
      seatWaiting: texts.seatWaiting,
      seatAway: texts.seatAway,
      you: texts.you,
    },
  }
}

const TABLE = "rounded-lg p-6 ring-1 ring-foreground/10"

/** One game per column, two columns from `lg` up */
const COLUMNS = "grid grid-cols-1 gap-6 lg:grid-cols-2"

function Caption({ look }: { look: GameLook }) {
  return (
    <p className="text-sm text-muted-foreground">
      {look.name} · {look.ui?.motion ?? "calm"} motion
    </p>
  )
}

/** An account picture, as the seat label will get one from PLT-13: a stand-in drawn here */
const PICTURE = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#cfd8dc"/><circle cx="50" cy="40" r="18" fill="#607d8b"/><path d="M14 100c4-26 20-34 36-34s32 8 36 34z" fill="#607d8b"/></svg>',
)}`

const SIZES: readonly SeatSize[] = ["xs", "sm", "md", "lg", "xl"]

function SeatSpecimen({ look }: { look: GameLook }) {
  const theme = seatTheme(look.ui?.seat)
  const [a, b, c] = look.playerColors
  return (
    <div className="flex flex-col gap-2">
      <Caption look={look} />
      <GameScope look={look}>
        <div className={`${TABLE} flex flex-col gap-6 text-foreground`} style={{ background: TABLE_BACKDROP }}>
          <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
            {SIZES.map((size) => (
              <SeatLabel key={size} nickname="Ana" color={a} theme={theme} size={size} className="font-display" />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
            <SeatLabel nickname="Ben" color={b} theme={theme} name="seat" className="font-display" />
            <SeatLabel nickname="Ben" color={b} theme={theme} name="ink" className="font-display" />
            <SeatLabel nickname="Chloé" color={c} theme={theme} imageUrl={PICTURE} className="font-display" />
            <SeatLabel nickname="Ana" color={a} theme={theme} className="font-display" corner={<Crown className="size-3.5 text-accent-game" />}>
              <span className="text-xs opacity-60">{look.labels.you}</span>
            </SeatLabel>
          </div>
        </div>
      </GameScope>
    </div>
  )
}

/** Four seats of a table where the game waits for two of them, then ten where the strip collapses */
function stripOf(look: GameLook, count: number, waiting: readonly string[], away: readonly string[]): StripData {
  const names = ["Ana", "Ben", "Chloé", "Dario", "Eva", "Farid", "Gaia", "Hugo", "Inès", "Jules"]
  const players = names.slice(0, count).map((nickname, i) => ({ id: `p${i}`, nickname }))
  const seats = pendingSeats({ players, waitingFor: waiting, present: players.map((p) => p.id).filter((id) => !away.includes(id)), meId: "p0" })
  if (!seats) throw new Error("A strip needs at least two players the game waits for")
  return { ...seats, seats: seats.seats.map((seat, i) => ({ ...seat, color: look.playerColors[i % look.playerColors.length] })) }
}

function StripSpecimen({ look }: { look: GameLook }) {
  const theme = seatTheme(look.ui?.seat)
  const labels = {
    players: look.labels.players,
    done: look.labels.seatDone,
    waiting: look.labels.seatWaiting,
    away: look.labels.seatAway,
    you: look.labels.you,
  }
  const rows = [
    { strip: stripOf(look, 4, ["p1", "p2"], ["p2"]), title: "Waiting for 2 players" },
    { strip: stripOf(look, 10, ["p1", "p2", "p5", "p7"], ["p5"]), title: "Waiting for 4 players" },
  ]
  return (
    <div className="flex flex-col gap-2">
      <Caption look={look} />
      <GameScope look={look}>
        <div className={`${TABLE} flex flex-col gap-8`} style={{ background: TABLE_BACKDROP }}>
          {rows.map(({ strip, title }, i) => (
            // the ticker's frame: the main line, then the strip under it
            <div key={title} className="flex flex-col items-end text-right text-foreground [text-shadow:0_1px_4px_rgb(0_0_0/60%)]">
              <p className="inline-flex items-center gap-1.5 font-display text-lg tracking-[0.14em] uppercase">{title}</p>
              <PlayersStripView
                className="mt-2"
                strip={strip}
                theme={theme}
                defaultOpen={i === 1}
                labels={{ ...labels, ready: fill(look.labels.playersReady, { ready: strip.ready, total: strip.total }) }}
              />
            </div>
          ))}
        </div>
      </GameScope>
    </div>
  )
}

export async function InGameUi() {
  const looks = (await Promise.all(SLUGS.map(lookOf))).filter((look): look is GameLook => look !== null)
  return (
    <>
      <Section
        id="game-themes"
        intro="The in-game UI is not drawn with the platform tokens: each game owns its universe. The components are shared, logic and layout alike; a game only tunes their look through `UI_THEME` in its binding (`motion`, `announcement`, `seat`, `gameOver`), on top of its own colors and fonts. This group is the one place of the page that draws game layers: every specimen sits inside its game's tokens, two games side by side."
      >
        <Bullets
          items={[
            "The fonts of a game are not loaded here: the families this page cannot load fall back to Georgia, a serif. The colors, the sizes and the texts are the code defaults of each game, not the values saved in its Sanity project.",
            "Both sides use the same neutral sample copy, so only the look differs.",
            "The compact layout of a short screen (the `short` variant, a phone held sideways) is keyed on the viewport and is not drawn here.",
            "The crown is a stand-in for the table's crown icon.",
          ]}
        />
        <div className={COLUMNS}>
          {looks.map((look) => (
            <div key={look.slug} className="flex flex-col gap-3">
              <GameScope look={look}>
                <div className="flex flex-col gap-4 rounded-lg bg-background p-6 text-foreground ring-1 ring-foreground/10">
                  <p className="font-display text-3xl">{look.name}</p>
                  <p>Body text in the game&apos;s body font, with a line to read.</p>
                  {look.fonts.accent && <p className="text-2xl" style={{ fontFamily: "var(--font-accent)" }}>Accent font</p>}
                  <div className="flex flex-wrap gap-2">
                    {(["background", "foreground", "accent", "surface", "surfaceDark"] as const).map((token) => (
                      <span key={token} className="flex flex-col gap-1 text-xs">
                        <span className="h-10 w-16 rounded-md ring-1 ring-foreground/20" style={{ background: look.colors[token] }} />
                        <span className="opacity-70">{token}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </GameScope>
              <Snippet>{`UI_THEME = ${JSON.stringify(look.ui ?? {}, null, 2)}`}</Snippet>
            </div>
          ))}
        </div>
      </Section>

      <Section
        id="seat-label"
        intro="One component for a player on a table: an avatar, the nickname and the seat color, used by every board, the players strip, the announcements and the game over. Until accounts exist (PLT-13) the avatar is generated from the nickname and the seat color; an account picture replaces it through `imageUrl`. `UI_THEME.seat` sets its shape, ring, font and whether the name takes the seat color or the ink around it."
      >
        <Demo>
          <div className={COLUMNS}>
            {looks.map((look) => (
              <SeatSpecimen key={look.slug} look={look} />
            ))}
          </div>
        </Demo>
      </Section>

      <Section
        id="players-strip"
        intro="Under the ticker's main line when the game waits for several players at once: one seat label per player, done (✓), waiting or away, and the viewer's own seat marked. Beyond eight seats it collapses to an `n/N ready` button that opens the list."
      >
        <Demo>
          <div className={COLUMNS}>
            {looks.map((look) => (
              <StripSpecimen key={look.slug} look={look} />
            ))}
          </div>
        </Demo>
      </Section>

      <Section
        id="announcements"
        intro="Start, round, your turn and victory, full screen over the table. Same timeline for every game (the veil, the hairlines drawn from the centre, the title rising into focus, the subtitle); `UI_THEME.announcement` sets the font, the letters, the veil, the hairlines and the confetti, and `UI_THEME.motion` the flourish: `calm` fades and short slides, `lively` adds springs and confetti. Reduced motion always wins: everything fades at once, 150 ms at most. The stage is a 1280 × 720 reference screen scaled down."
      >
        <Demo>
          <AnnouncementSpecimen looks={looks} />
        </Demo>
      </Section>

      <Section
        id="game-over"
        intro="The end screen: the winner or winners as the hero, the ranking under it, the score detail of each player, the share thumbnail as a polaroid on the corner. `UI_THEME.gameOver` sets the surface, border, radius, ink, accent and polaroid frame. Replay plays the entrance of a first opening; the screen is otherwise drawn still."
      >
        <Demo>
          <GameOverSpecimen looks={looks} />
        </Demo>
      </Section>
    </>
  )
}
