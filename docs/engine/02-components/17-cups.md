# Cups

A cup hides what is under it: the dice of Liar's Dice, which the players shake, slam down and look under in secret; the dice of a game that is rolled from a cup, which the cup shakes and pours onto a tray. On the table a `Cup` is a hollow cup that the game puts in a pose, standing over what it hides, tilted, lifted away, shaken, mouth up, tipped over, and that gets there the way a cup does. In the engine a hidden roll is nothing new: the dice are rolled with the seeded stream, the state keeps them, and the view tells each player their own dice and the others only how many. The cup only covers. Whether a player can know what is under it is the view's to decide, not the cup's. The table's side is `packages/table/src/cup/`.

Shake and roll: the cups come down with new dice under them. Press your cup to peek, show all the dice, and cover them again. The board is never given the dice of the other two cups until they are shown: it draws a blank die under a cup it knows nothing about.

```specimen
scene-cup
```

A cup can also pour: it is taken up and shaken, tipped over, and the dice fly out of its mouth onto the tray, which is a `DiceTray`.

```specimen
scene-pour
```

## The parts of a hidden roll

| Part | What it is | Where it comes from |
| --- | --- | --- |
| Dice | What the cup covers or pours | `Die`s of the game ([Dice](10-dice.md)), whose numbers `rollDice` of the kit draws |
| Secret | Who may know the numbers | The view of each player: their own dice, how many the others hold ([Hidden information](../01-the-game/10-views.md#hidden-information)) |
| Cup | The cover: a hollow shape that takes poses | `Cup` |
| Pose | What the cup is doing | `pose` of the `Cup`, set by the game from the state and the log |

## In the engine

The kit has nothing to add: a hidden roll is a roll, kept in the state, with a view that hides it.

- The roll is drawn inside `apply` from the seeded stream, and the state keeps each player's dice as a list of numbers ([Dice](10-dice.md#in-the-engine)).
- The view of a player carries their own dice and, for the others, how many they hold. A view that lists every player's dice with the others' as `null` and a `counts` list says it all; the same view after a reveal carries the numbers of everyone.
- A reveal is a step of the game that changes what the views say, and the log says it: the entry of a roll is read in full by the player who rolled and masked for the others ([Events and the log](../01-the-game/12-events-and-the-log.md)).
- Test the view for every viewer, as for any hidden information: the numbers of another player's dice must not be anywhere in it ([Testing](../04-build-a-game/06-testing.md)).

```ts
// The view of a player: their dice, and how many the others hold; everybody's dice once they are shown
view: (state, viewer) => ({
  counts: state.dice.map((hand) => hand.length),
  dice: state.dice.map((hand, seat) => (state.shown || state.players[seat] === viewer ? hand : null)),
})
```

## On the table

### Cup

`packages/table/src/cup/cup.tsx`. The props are `CupProps`:

| Prop | Role |
| --- | --- |
| `at` | `{ x, z, yaw? }`: where the cup stands on the table. The front of its place, toward its owner, is +z of the frame its poses are made in, so a `yaw` turns the cup to the seat it belongs to |
| `pose` | What the cup is doing, below (default `covering`). When it changes the cup goes to the new pose, turning and rising as it must |
| `size` | The width of the cup across its mouth, in world units (default `CUP_SIZE`). Its height follows |
| `color` | The colour of its outside; its hollow is darker |
| `halo` | A ring on the table round the cup, in this colour, that pulses: the cup can be pressed |
| `shadow` | Casts a drop shadow (default true) |
| `onClick`, `onHover` | Make the cup a click target ([Clicks and hover](../01-the-game/05-actions.md#clicks-and-hover)) |
| `onReach` | Called once the cup has reached the pose it was sent to, with it: the slam onto the table, the moment to pour. Not called for the pose the cup appeared in |

The poses are `CUP_POSES`:

| Pose | The cup |
| --- | --- |
| `covering` | Stands on its mouth over what it hides |
| `peeking` | Tilts about the far edge of its rim, the near edge up: the owner looks under it |
| `lifted` | Is lifted away and aside, so that what was under it shows |
| `shaking` | Is held up, mouth up, and rattled |
| `rest` | Stands on its base with its mouth up |
| `pouring` | Is tipped over past a quarter turn, its mouth looking away from its owner and down |

`cupMouth(at, pose, size)` gives the middle of the mouth in a pose, as `[x, y, z]` on the table: where dice that are poured start, so that a `Die` is thrown from it (`from`).

```tsx
<Cup at={seat.at} pose={view.shown ? "lifted" : view.shaking ? "shaking" : "covering"} onReach={(pose) => pose === "covering" && play("slam")} />
{hand.map((value, i) => (
  <Die key={i} id={`${seat.id}-${i}`} value={value ?? 1} at={underTheCup(seat, i)} />
))}

// A cup that pours: the dice are thrown from its mouth as it tips
<DiceTray area={tray}>
  {values.map((value, i) => (
    <Die key={i} id={`roll-${i}`} value={value} at={lieAt(i)} roll={view.rolls} from={cupMouth(cupAt, "pouring", CUP_SIZE)} />
  ))}
</DiceTray>
<Cup at={cupAt} pose={view.pose} onReach={(pose) => pose === "pouring" && play("pour")} />
```

### How a cup moves

- A cup goes to a pose the way a cup does, each move with a time of its own (`CUP_SETTINGS`): the slam onto the table is the quickest, and a tilt or a lift is slower. A cup that is lifted rises and turns as one, and the cup is raised as far as its turn needs, so it never goes through the table on the way: a cup that flips from its mouth down to its mouth up goes up first.
- A cup that is shaken rattles a little sideways, up and down and tilted, as often as `rattleHz` says. The rattle fades in and out with the pose.
- `onReach` is called once, when the cup has got where it was sent: the slam of a cup that comes down, the moment a cup that is tipped starts to pour. The game sequences what comes next from it: dice appear under a cup that has come down, dice are thrown from a cup that has tipped.
- A cup that pours has to stand so that its mouth, when it is tipped, is above the tray: dice start from `cupMouth` and are thrown toward the middle of the tray, and a die that starts outside the wall that keeps the dice in the tray bounces off it from the outside. Seat the cup beside the tray and turn it (`yaw`) so that it pours toward it.
- The cup carries its own light, so it needs none from the table: its outside is brighter than its hollow, and it is lit again as it turns.
- A visitor who asks for less motion sees the cup in its new pose at once, with no rattle.

### Settings

`CUP_SETTINGS` is read on every frame by every cup: how long each move takes, how far the cup rattles and how often, and its shadow. The debug panel has a Cup folder for it ([Tuning](../04-build-a-game/07-tuning.md)).

### Not built

- Dice that move inside the cup as it is shaken: the shake is for show, the dice are under the cup or thrown from its mouth, and what they say is the engine's.
- A hand that holds the cup, or a cup that is picked up by dragging it: a cup goes to the poses the game gives it, and `draggable` is for cards and pieces ([Dragging](19-dragging.md#not-built)).
- A cup that shows some of the dice and not the others: it is lifted or it is not. A game that wants a die shown draws it beside the cup.
- A cup that hides what is not dice, such as cards or tokens: the `Cup` covers whatever stands under it, but its footprint is one size.
