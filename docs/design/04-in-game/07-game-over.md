# Game over

The end screen of every game, `GameOverCard`: a card centered on the screen, over the board with no veil around it. It is the table's own, so it wears the game's look, drawn here in two games side by side.

```specimen
game-over
```

## The game's look

- The card takes the game's surface, line, corners and ink from `UI_THEME.gameOver`, over the defaults of its skin. The accent of the theme colours the crown, the score of the winner and the title of a win.
- The pictures of the players take the shape and the ring of `UI_THEME.seat`, and a name takes the colour of its seat when the theme asks for it.
- The fonts are the game's: its title font for the numbers and the head, its body font for the names.
- The crown is the host icon of the skin, or a plain crown. The faint pattern behind the card is the skin's.
- The buttons are the game's main button: Continue is solid, Rematch is its translucent form, and a vote that was sent shows the sheen of a button that waits for the others.
- A game never restyles the card. What it asks for is a field of `UI_THEME`, and what it adds is `renderDetail`, for score lines that are more than chips, and the ranks and names it gives its players and teams.

## The podium

- The winner is at the center top, the highest step: the picture, the first name and, for a game that counts points, the score. The second place is on its left and the third on its right, on lower steps.
- The podium takes the shape of the table. At a table of two the other player stands on the winner's left, and the winner stays in the middle. From the fourth place on, the places are rows under the podium.
- A step has the rank of its place written on it. The step after a tie for the first place is the third.
- Players who share a rank share a step, side by side with their names together: a tie, the members of a team. A game gives its teams their ranks, and may name them: the name leads the step, the names of its players come under it.
- A table that plays together has no steps, since nobody beat anybody. Everybody stands in one place under one score, crowned for a victory and not crowned for a defeat.
- The crown is the winner's alone, and nobody wears it at a table that lost together.

## What it says

- Under the podium, the head says how the game ended for the visitor: a win, a draw, a place or a loss, and for a table that plays together a victory or a defeat.
- A game that counted for the rank adds the ranked mark and the rank points it gave or took. A score is written only for a game that counts points.
- The scores of every player, with their lines (chips, or what the game draws itself with `renderDetail`), unfold under the head with "Show scores". The visitor's row is lit.
- The share is an icon in the corner.

## What it asks

- Two buttons: Continue, the main one, and Rematch. Nothing else leaves the screen.
- Continue leaves the finished table and goes on to the platform: a member's home, a guest's public home. Where it leads is decided in one place (`continuePath`), and it is never worded as a way back.
- Rematch is a vote. It counts the players still at the table who agreed, and is off once the visitor has agreed, while the vote is sent, and when too few players are left.
- The line under the buttons says who asked, whom the table waits for and who left.
- A player who asks for a rematch while the visitor looks at the board is also a toast of the game, with the button that agrees.
- A player who goes on is no longer asked: the rematch of the others is played by those who stayed.

## Rules

- Under reduced motion the card only fades in.
- Every word is English until the language pass. The names and the score lines are what the players and the game wrote.
