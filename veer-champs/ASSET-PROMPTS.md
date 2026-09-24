# Veer Champs: ChatGPT image prompts

## Pehle yeh padh lo (zaroori niyam)

1. **Sab images ek hi ChatGPT chat mein banao.** Isse sabka style ek jaisa rahega. Chat ki shuruaat mein neeche wala **STYLE GUIDE** bhejo, phir ek-ek prompt bhejo.
2. **Kisi bhi image mein koi likha hua text nahi hona chahiye.** AI spelling galat likhta hai. Text (naam, amount, button ke shabd) main code se lagaunga. Har prompt mein yeh pehle se likha hai.
3. Jahan **"transparent background"** likha hai, wahan PNG transparent hi chahiye. Agar background aa jaye to ChatGPT ko bolo: *"Same image, transparent background PNG."*
4. **Size:** ChatGPT teen shape banata hai: **Square**, **Portrait (lamba)**, **Landscape (chauda)**. Har prompt mein shape likhi hai. Crop main khud kar lunga.
5. **File ka naam wahi rakho jo list mein likha hai** (jaise `token-red.png`). Isse main seedha sahi jagah laga paunga.
6. Koi image pasand na aaye to bolo: *"Make it more glossy / brighter / simpler, keep the same style."*
7. **Ludo board ki grid (khane) AI se mat banwana.** AI khano ki ginti galat kar deta hai. Board ke khane main code se banaunga. ChatGPT sirf board ka frame, ghar (corner) aur beech ka hissa banayega.

**Images mujhe kaise bhejein:** is chat mein 5–10 images ek saath attach kar do, ya GitHub par `veer-champs/public/assets/` folder mein upload kar do.

---

## STYLE GUIDE (chat mein sabse pehle yeh bhejo)

```
I am designing a mobile game app called "Veer Champs" (Ludo and other board games, Indian audience).
For every image I ask for next, use this exact art style so all assets match:

- Style: premium 3D casual mobile game art, like top Indian gaming apps. Glossy, soft
  3D render, rounded chunky shapes, soft studio lighting, subtle rim light, gentle shadows.
- Theme: royal Indian champion. Gold trims, jewels, royal blue and deep purple, festive and
  energetic, but clean and modern (not cluttered, not realistic).
- Colors: royal purple #2A1B6B, deep blue #1A1250, gold #FFC83D, saffron #FF7A1A,
  game colors red #EF3B4F, green #1FBF6A, yellow #FFC21A, blue #2F8BFF.
- NEVER put any text, letters, numbers or watermarks in the image unless I explicitly ask.
- Center the subject with some empty space around it. High detail, sharp edges.
Reply "ready" and wait for my first request.
```

---

## 1. Brand

| File | Shape | Prompt |
|---|---|---|
| `app-icon.png` | Square | App icon for "Veer Champs": a glossy golden Ludo dice with a small royal crown on top, on a rich royal purple rounded-square background with a soft gold glow. No text. |
| `splash-bg.png` | Portrait | Splash screen background: royal purple and deep blue gradient, soft golden light rays from the center, subtle floating gold sparkles and faint dice and Ludo token silhouettes at the edges. Empty center area for a logo. No text. |
| `crown.png` | Square | A shiny golden royal crown with red and blue jewels, 3D glossy, transparent background. |

## 2. Backgrounds (no text, keep center calm so UI stays readable)

| File | Shape | Prompt |
|---|---|---|
| `bg-home.png` | Portrait | Mobile app home background: deep royal purple to dark blue gradient, soft bokeh lights, subtle golden Indian palace arch pattern very faint at the top, calm and dark in the middle. No text. |
| `bg-game.png` | Portrait | Background for a Ludo match screen: luxurious dark royal blue velvet table surface with a soft golden spotlight in the center, subtle ornate gold corner patterns. Dark and calm so a board on top stands out. No text. |
| `bg-lobby.png` | Portrait | Background with a royal Indian stadium feel: purple sky, golden lights, soft confetti far in the background, dark lower half. No text. |
| `bg-result-win.png` | Portrait | Victory background: bright golden light burst from the center, confetti, fireworks, royal purple edges. No text. |
| `bg-result-lose.png` | Portrait | Calm background for "good game" screen: soft blue and purple gradient, gentle light rays, a few floating stars. No text. |

## 3. Ludo board pieces (the grid itself is drawn in code)

| File | Shape | Prompt |
|---|---|---|
| `board-frame.png` | Square | A square ornate golden frame for a board game, top-down flat view, royal Indian carvings, jewels at the four corners. The inside of the frame is completely empty and transparent. Transparent background. |
| `board-center.png` | Square | Top-down flat view of the center of a Ludo board: a square split into four triangles colored red (left), green (top), yellow (right) and blue (bottom), each glossy with a thin gold border, a small golden trophy in the middle. Transparent background. |
| `yard-red.png` | Square | Top-down flat view of a Ludo home yard: a rounded glossy red square with a thin gold border, inside it a white rounded square with 4 circular slots for tokens. Clean, flat, no perspective. Transparent background. |
| `yard-green.png` | Square | Same as the red yard, but green (#1FBF6A). Transparent background. |
| `yard-yellow.png` | Square | Same as the red yard, but yellow (#FFC21A). Transparent background. |
| `yard-blue.png` | Square | Same as the red yard, but blue (#2F8BFF). Transparent background. |
| `safe-star.png` | Square | A small glossy silver-purple star icon for a safe cell on a board, top-down. Transparent background. |

## 4. Tokens (goti)

| File | Shape | Prompt |
|---|---|---|
| `token-red.png` | Square | A Ludo token (classic pin / teardrop marker shape with a round head), glossy red 3D plastic with a gold ring near the base, slight top-down 3/4 view, soft shadow under it. Transparent background. |
| `token-green.png` | Square | Same token, green (#1FBF6A). Transparent background. |
| `token-yellow.png` | Square | Same token, yellow (#FFC21A). Transparent background. |
| `token-blue.png` | Square | Same token, blue (#2F8BFF). Transparent background. |

## 5. Dice (the rolling is done in code; these are the six faces)

| File | Shape | Prompt |
|---|---|---|
| `dice-face-1.png` … `dice-face-6.png` | Square | Flat front view of ONE face of a premium white dice, rounded corners, glossy, showing exactly **N** dark navy pips arranged like a standard dice (the single pip on face 1 is red). Fills the whole image, no background, no perspective. *(Make 6 images: replace N with 1, 2, 3, 4, 5, 6.)* |
| `dice-hero.png` | Square | Two glossy white dice with navy pips tumbling in the air, motion sparkles, golden glow. Transparent background. |

## 6. Avatars (16, all round, same style)

Prompt (make 16 times, changing the character):

```
Round avatar portrait for a game profile: [CHARACTER], cute 3D cartoon style, friendly
confident expression, shoulders up, colorful gradient circle background, gold ring border.
No text. Square image.
```

Characters, one per file `avatar-01.png` … `avatar-16.png`:
1. a brave young Indian warrior prince with a turban
2. a smiling Indian girl warrior with a braid and gold jewelry
3. a lion king with a small crown
4. a tiger wearing a royal vest
5. a clever fox with sunglasses
6. a cool panda with headphones
7. a peacock with a golden feather crown
8. a monkey hero with a gada (mace)
9. an elephant champion with a jeweled headpiece
10. a college boy gamer with a cap
11. a college girl gamer with headphones
12. a wise old grandpa with glasses and a warm smile
13. a friendly aunty with a bindi and a big smile
14. a cricket player kid with a helmet
15. a robot with glowing blue eyes
16. a dragon baby, cute and chubby

## 7. Home screen game cards (no text; names are added in code)

| File | Shape | Prompt |
|---|---|---|
| `game-ludo.png` | Square | Game cover art for Ludo: a colorful Ludo board tilted in 3D, red, green, yellow and blue tokens jumping, two white dice flying, golden sparkles, royal purple background. No text. |
| `game-snakes.png` | Square | Game cover art for Snakes and Ladders: a friendly green cartoon snake wrapped around a wooden ladder on a colorful board, dice flying, bright background. No text. |
| `game-cricket.png` | Square | Game cover art for Hand Cricket: two cartoon hands showing numbers with fingers, a red cricket ball and a bat, stadium lights, energetic blue background. No text. |
| `game-cards.png` | Square | Game cover art for a color card game: a fan of glossy colorful playing cards (red, blue, green, yellow) with simple shapes on them, no letters, bright background. No text. |
| `game-carrom.png` | Square | Game cover art for Carrom: a wooden carrom board top view with black and white coins, a red queen and a striker in motion. No text. |
| `game-tictactoe.png` | Square | Game cover art for Tic Tac Toe: glossy 3D neon X and O pieces on a 3x3 grid, purple background. No text. |
| `game-connect4.png` | Square | Game cover art for Connect Four: a blue vertical grid with red and yellow discs dropping in, glossy 3D. No text. |
| `game-quiz.png` | Square | Game cover art for a quiz battle: a glowing golden brain with a lightning bolt, question-mark shaped sparkles (no letters), purple background. No text. |

## 8. Ludo modes

| File | Shape | Prompt |
|---|---|---|
| `mode-classic.png` | Square | Icon for "classic mode": a golden crown sitting on a small Ludo board, glossy 3D. Transparent background. |
| `mode-quick.png` | Square | Icon for "quick mode": a Ludo token with a golden lightning bolt and speed lines, glossy 3D. Transparent background. |
| `mode-timer.png` | Square | Icon for "timer mode": a golden stopwatch with a Ludo dice beside it, glossy 3D, energetic. Transparent background. |
| `mode-team.png` | Square | Icon for "2 vs 2 team mode": two pairs of Ludo tokens (red with yellow, green with blue) facing each other with a small shield between them, glossy 3D. Transparent background. |
| `mode-friends.png` | Square | Icon for "play with friends": three happy cartoon faces together with a small Ludo token, glossy 3D. Transparent background. |
| `mode-practice.png` | Square | Icon for "practice vs computer": a cute friendly robot holding a dice, glossy 3D. Transparent background. |

## 9. Coins, cash and rewards

| File | Shape | Prompt |
|---|---|---|
| `coin.png` | Square | A single shiny gold game coin, front view, with an embossed crown design in the middle (no letters), thick glossy 3D edge. Transparent background. |
| `coin-stack.png` | Square | A small stack of shiny gold coins with crown designs, glossy 3D. Transparent background. |
| `coin-pack-1.png` | Square | A small pile of gold coins. Transparent background. |
| `coin-pack-2.png` | Square | A cloth bag overflowing with gold coins. Transparent background. |
| `coin-pack-3.png` | Square | An open wooden treasure chest full of gold coins with a golden glow. Transparent background. |
| `coin-pack-4.png` | Square | A huge royal treasure chest overflowing with gold coins and colorful jewels, strong golden glow. Transparent background. |
| `cash.png` | Square | A green Indian-rupee style banknote stack (no readable text or numbers) with a glossy green cash icon look. Transparent background. |
| `wallet.png` | Square | A premium brown leather wallet with gold coins and green notes peeking out, glossy 3D. Transparent background. |
| `gift-box.png` | Square | A glossy red gift box with a gold ribbon, slightly open with golden light coming out. Transparent background. |
| `gift-box-big.png` | Square | A big royal purple gift chest with gold ribbon, glowing and sparkling (jackpot reward). Transparent background. |
| `spin-wheel.png` | Square | A top-down flat prize wheel with 8 equal colorful segments (red, blue, green, purple, orange, teal, yellow, pink), gold outer ring with light bulbs, empty segments with no text, a golden crown in the center. Transparent background. |
| `trophy-gold.png` | Square | A shiny gold trophy cup with a star on top, glossy 3D. Transparent background. |
| `trophy-silver.png` | Square | Same trophy, silver. Transparent background. |
| `trophy-bronze.png` | Square | Same trophy, bronze. Transparent background. |
| `medal-1.png`, `medal-2.png`, `medal-3.png` | Square | A gold (then silver, then bronze) medal with a red and blue ribbon, glossy 3D, no numbers. Transparent background. |
| `ribbon-victory.png` | Landscape | A wide golden royal ribbon banner with jewels at the ends, empty in the middle for text. Transparent background. |
| `confetti.png` | Square | Scattered colorful confetti pieces and small gold stars, transparent background. |

## 10. Big buttons and icons (small simple icons like back and close stay in code)

| File | Shape | Prompt |
|---|---|---|
| `icon-home.png` | Square | Glossy 3D game icon of a small royal palace home, gold and purple. Transparent background. |
| `icon-tournament.png` | Square | Glossy 3D game icon of a golden trophy with two crossed swords. Transparent background. |
| `icon-play.png` | Square | Glossy 3D round orange play button with a white triangle, golden rim. Transparent background. |
| `icon-leaderboard.png` | Square | Glossy 3D game icon of a gold, silver and bronze podium. Transparent background. |
| `icon-wallet.png` | Square | Glossy 3D game icon of a wallet with a gold coin. Transparent background. |
| `icon-daily-bonus.png` | Square | Glossy 3D icon of a gift box with a calendar tag. Transparent background. |
| `icon-spin.png` | Square | Glossy 3D icon of a small colorful prize wheel. Transparent background. |
| `icon-refer.png` | Square | Glossy 3D icon of two cartoon friends giving a high five with coins around. Transparent background. |
| `icon-shop.png` | Square | Glossy 3D icon of a shopping bag with a gold coin on it. Transparent background. |
| `icon-notification.png` | Square | Glossy 3D icon of a golden bell. Transparent background. |
| `icon-settings.png` | Square | Glossy 3D icon of a silver and gold gear. Transparent background. |
| `icon-chat.png` | Square | Glossy 3D icon of a speech bubble, blue. Transparent background. |
| `icon-emoji.png` | Square | Glossy 3D icon of a happy yellow smiley face. Transparent background. |
| `icon-mic.png` | Square | Glossy 3D icon of a microphone, green. Transparent background. |
| `icon-mic-off.png` | Square | Same microphone icon, grey with a red slash. Transparent background. |
| `icon-friends.png` | Square | Glossy 3D icon of two cartoon people. Transparent background. |
| `icon-kyc.png` | Square | Glossy 3D icon of a shield with a green check mark. Transparent background. |
| `icon-support.png` | Square | Glossy 3D icon of a headset. Transparent background. |
| `icon-lock.png` | Square | Glossy 3D golden padlock ("coming soon" badge). Transparent background. |

## 11. Banners (text is added in code)

| File | Shape | Prompt |
|---|---|---|
| `banner-timer.png` | Landscape | Promo banner art: a golden stopwatch and a Ludo board with tokens racing, orange and red energetic background, right side busy, left half empty for text. No text. |
| `banner-tournament.png` | Landscape | Promo banner art: a huge golden trophy with fireworks and a crowd of cartoon players cheering, purple and blue background, left half empty for text. No text. |
| `banner-refer.png` | Landscape | Promo banner art: two cartoon friends high-fiving with gold coins flying, green and teal background, left half empty for text. No text. |
| `banner-welcome.png` | Landscape | Promo banner art: a big gift chest opening with coins bursting out, royal purple background, left half empty for text. No text. |

## 12. Frames and shop skins

| File | Shape | Prompt |
|---|---|---|
| `frame-gold.png` | Square | A round ornate golden avatar frame with a small crown at the top, empty transparent center. Transparent background. |
| `frame-fire.png` | Square | A round avatar frame made of stylized orange flames, empty transparent center. Transparent background. |
| `frame-diamond.png` | Square | A round avatar frame of sparkling blue diamonds, empty transparent center. Transparent background. |
| `dice-skin-gold.png` | Square | A glossy golden 3D dice with dark brown pips. Transparent background. |
| `dice-skin-ruby.png` | Square | A glossy ruby-red 3D dice with white pips. Transparent background. |
| `dice-skin-ice.png` | Square | A glossy icy-blue translucent 3D dice with white pips. Transparent background. |

## 13. Empty states and illustrations

| File | Shape | Prompt |
|---|---|---|
| `empty-friends.png` | Square | Cute illustration of a lonely Ludo token waving, looking for friends. Transparent background. |
| `empty-notifications.png` | Square | Cute illustration of a sleeping golden bell. Transparent background. |
| `empty-history.png` | Square | Cute illustration of an empty treasure chest with a dice inside. Transparent background. |
| `matchmaking.png` | Square | Illustration of a glowing radar circle with small player avatar silhouettes around it, purple and gold. Transparent background. |
| `maintenance.png` | Square | Cute cartoon robot fixing a giant dice with a wrench. Transparent background. |
| `no-internet.png` | Square | Cute cartoon Ludo token holding a broken wifi sign, sad face. Transparent background. |

---

**Kul images: ~110.** Sab ek saath banana zaroori nahi. Is order mein banao:

1. **Pehle (sabse zaroori):** STYLE GUIDE, `app-icon`, `bg-home`, `bg-game`, 4 tokens, 4 yards, `board-center`, `board-frame`, `coin`, `cash`, 8 game cards, 6 mode icons
2. **Phir:** 16 avatars, bottom nav icons, banners, rewards
3. **Aakhir mein:** frames, skins, empty states
