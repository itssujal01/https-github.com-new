<?php
// Test helper: plays a game with fixed dice through the PHP engine and prints every step.
require __DIR__ . '/../php/engine.php';
$input = json_decode(stream_get_contents(STDIN), true);
$g = ludo_create($input['colors']);
$out = [];
$r = 0;
foreach ($input['forfeits'] ?? [] as $step => $color) $forfeitAt[(int) $step] = $color;
for ($step = 0; $g['stage'] !== 'over' && $step < 5000; $step++) {
    if (isset($forfeitAt[$step])) [$g, $ev] = ludo_forfeit($g, $forfeitAt[$step]);
    elseif ($g['stage'] === 'roll') [$g, $ev] = ludo_roll($g, $input['rolls'][$r++ % count($input['rolls'])]);
    else [$g, $ev] = ludo_move($g, ludo_bot_move($g));
    $out[] = ['events' => $ev, 'game' => $g];
}
echo json_encode($out);
