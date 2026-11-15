# Game over

The end screen of every game, `GameOverCard`: a card centered on the screen, over the board with no veil around it. It is the table's own, so it wears the game's look, drawn here in two games side by side.

```specimen
game-over
```

## The game's look

- The card takes the game's surface, line, corners and ink from `UI_THEME.gameOver`, over the defaults of its skin. The accent of the theme colours the crown, the score of the winner, the title of a win and the line under the open tab.
- Every box inside it (the rewards, the podium steps, the panel of the details, the chips, the bars) is a tint of the card's own ink, so any surface a game picks works, light or dark.
- The pictures of the players are always round, whatever the shape of the seats on the table. Their ring and the colour of the names come from `UI_THEME.seat`.
- The fonts are the game's: its title font for the numbers, the head and the tabs, its body font for the names.
- The crown is the host icon of the skin, or a plain crown. The faint pattern behind the card is the skin's.
- The buttons are the game's main button: Continue is solid, Rematch is its translucent form, and a vote that was sent shows the sheen of a button that waits for the others.
- A game never restyles the card. What it asks for is a field of `UI_THEME`, and what it adds is `renderDetail`, for score lines that are more than chips, its `history`, and the ranks and names it gives its players and teams.

## What it says

- How the game ended for the visitor is at the very top of the card: a win, a draw, a place or a loss, and for a table that plays together a victory or a defeat.
- What the game gave the visitor is under the title, each in a small box, once the game is written down: the ranked mark with the rank points it gave or took, for a game that counted for the rank, and the experience, "+N XP", for a member in any mode. A guest earns neither and sees neither.
- The row of the rewards opens when there is something to say, so that the card grows without a jump.
- A score is written only for a game that counts points.
- The share is an icon in the corner.

## The podium

- The winner stands in the middle, on the highest step: the picture, the first name and, for a game that counts points, the score. The second place is on its left and the third on its right, on lower steps.
- The steps touch each other and make one podium. The players stand on them, with the crown above the winner, and the name and the score are written on their face. A step has no number.
- At two places the steps share the whole width, the second on the left of the first. A single place takes all of it.
- Only the first three places have a step. The others are in the table of the scores with everybody else.
- Players who share a rank share a step, side by side with their names together: a tie, the members of a team. The step after a tie for the first place is the second step. A game gives its teams their ranks, and may name them: the name leads the step, the names of its players come under it.
- A table that plays together has no steps, since nobody beat anybody. Everybody stands in one place under one score, crowned for a victory and not crowned for a defeat.
- The crown is the winner's alone, and nobody wears it at a table that lost together.
- On a screen too low for it, the podium gives way and the title, the details and the buttons remain.

## The details

- Under the podium, one panel with tabs. Its height is the same whichever tab is open, so the card does not move when one is picked, and what does not fit scrolls inside it.
- The scores come first and are open to begin with: a table with a row for each player, from the first place to the last, and no button to open it.
- A row has where the player came (a crown for a winner, nothing at a table that plays together), their picture and name, the lines of their score and their total, big, in the accent for a winner. The visitor's row is lit and marked "you", and a team's name follows the names of its players.
- The lines of a score are chips, or what the game draws itself with `renderDetail`. On a narrow card they go under the player.
- A game that counts no points has the places and the players only, and its first tab is called Ranking.
- The head of the table stays in view while its rows scroll.
- A game that gives its history has two more tabs, Stats and History. A game that gives none has no tabs at all: the table is all that lies under the podium.
- Stats are charts, one bar for each player in the colour of their seat, the players always in the order of the places: the score, for a game that counts points, then the turns each player took and the moves they made, counted from the history the board gives, so the numbers are the ones the history lists. A chart gives its total, and its highest value is in the accent.
- History tells the game from its first turn to its last, whereas the board lists the newest first. Each turn has its number, who took it and what they did, every move written the way the board's own history writes it. The visitor's turns are lit.
- A game whose lines say who did what themselves has the picture of the player before a line and no name.
- The tabs are a tab list: the arrow keys, Home and End move between them, and only the open one is in the tab order.

## What it asks

- Two buttons: Continue, the main one, and Rematch. Nothing else leaves the screen.
- Continue leaves the finished table and goes on to the platform: a member's home, a guest's public home. Where it leads is decided in one place (`continuePath`), and it is never worded as a way back.
- Rematch is a vote. It counts the players still at the table who agreed, and is off once the visitor has agreed, while the vote is sent, and when too few players are left.
- The line under the buttons says who asked, whom the table waits for and who left.
- A player who asks for a rematch while the visitor looks at the board is also a toast of the game, with the button that agrees.
- A player who goes on is no longer asked: the rematch of the others is played by those who stayed.

## Rules

- Under reduced motion the card only fades in, and the bars and the line under the tab do not travel.
- Every word is English until the language pass. The names, the score lines and the lines of the history are what the players and the game wrote.
