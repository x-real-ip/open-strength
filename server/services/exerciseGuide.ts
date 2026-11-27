// Dutch names, how-to steps and example photos for every exercise in the library.
// Photos come from free-exercise-db (https://github.com/yuhonas/free-exercise-db, public
// domain) and are bundled in web/public/exercises/<photo>-0.webp and -1.webp (start and
// end position). `similar` marks photos that show a close variant rather than the exact
// exercise (e.g. a cable version of a band exercise).

export interface ExerciseGuide {
  name: string;
  steps: string[];
  /** free-exercise-db id of the photos. */
  photo: string;
  similar?: string;
}

export const GUIDES: Record<string, ExerciseGuide> = {
  // Horizontal push
  barbell_bench_press: {
    name: 'Bankdrukken (barbell)',
    photo: 'Barbell_Bench_Press_-_Medium_Grip',
    steps: [
      'Lig op de bank met je ogen onder de stang, voeten plat op de grond.',
      'Pak de stang iets breder dan schouderbreedte, trek je schouderbladen naar achteren en omlaag.',
      'Laat de stang gecontroleerd zakken tot onder op je borst, ellebogen ongeveer 45° van je romp.',
      'Druk de stang omhoog tot je armen gestrekt zijn, zonder je billen van de bank te tillen.',
    ],
  },
  incline_barbell_bench_press: {
    name: 'Schuin bankdrukken (barbell)',
    photo: 'Barbell_Incline_Bench_Press_-_Medium_Grip',
    steps: [
      'Zet de bank op 30–45° en lig met je ogen onder de stang.',
      'Pak de stang iets breder dan schouderbreedte, schouderbladen naar achteren.',
      'Laat de stang zakken naar je bovenborst, net onder je sleutelbeenderen.',
      'Druk recht omhoog tot je armen gestrekt zijn.',
    ],
  },
  dumbbell_bench_press: {
    name: 'Bankdrukken (dumbbells)',
    photo: 'Dumbbell_Bench_Press',
    steps: [
      'Ga op de bank liggen met een dumbbell in elke hand op borsthoogte.',
      'Trek je schouderbladen naar achteren, voeten plat op de grond.',
      'Druk de dumbbells omhoog tot je armen gestrekt zijn; ze komen boven je borst bij elkaar.',
      'Laat ze gecontroleerd zakken tot je een lichte rek in je borst voelt.',
    ],
  },
  incline_dumbbell_press: {
    name: 'Schuin bankdrukken (dumbbells)',
    photo: 'Incline_Dumbbell_Press',
    steps: [
      'Zet de bank op 30–45° en houd de dumbbells naast je bovenborst.',
      'Druk ze omhoog en iets naar elkaar toe tot je armen gestrekt zijn.',
      'Laat ze rustig zakken tot je ellebogen net onder schouderhoogte zijn.',
    ],
  },
  machine_chest_press: {
    name: 'Chest press (machine)',
    photo: 'Machine_Bench_Press',
    steps: [
      'Stel de stoel zo in dat de handgrepen op borsthoogte zitten.',
      'Rug tegen het kussen, schouderbladen naar achteren.',
      'Duw de handgrepen naar voren tot je armen bijna gestrekt zijn.',
      'Laat ze gecontroleerd terugkomen zonder dat het gewicht neerkomt.',
    ],
  },
  push_up: {
    name: 'Opdrukken',
    photo: 'Pushups',
    steps: [
      'Handen iets breder dan je schouders, lichaam in één rechte lijn van hoofd tot hielen.',
      'Span je buik en billen aan.',
      'Zak tot je borst net boven de grond is, ellebogen schuin naar achteren.',
      'Duw jezelf terug omhoog zonder dat je heupen doorzakken. Te zwaar? Doe het met je handen op een bank.',
    ],
  },
  close_grip_bench_press: {
    name: 'Smal bankdrukken',
    photo: 'Close-Grip_Barbell_Bench_Press',
    steps: [
      'Lig op de bank en pak de stang op schouderbreedte.',
      'Laat de stang zakken naar je onderborst, ellebogen dicht langs je lichaam.',
      'Druk omhoog vanuit je triceps tot je armen gestrekt zijn.',
    ],
  },

  // Chest isolation
  cable_fly: {
    name: 'Cable fly',
    photo: 'Cable_Crossover',
    steps: [
      'Zet beide kabels hoog, pak de handgrepen en zet een stap naar voren.',
      'Buig licht voorover, armen gespreid met een kleine buiging in je ellebogen.',
      'Breng je handen in een boog naar elkaar toe voor je lichaam.',
      'Laat ze gecontroleerd terug naar buiten gaan tot je een rek in je borst voelt.',
    ],
  },
  dumbbell_fly: {
    name: 'Dumbbell fly',
    photo: 'Dumbbell_Flyes',
    steps: [
      'Lig op de bank met de dumbbells boven je borst, handpalmen naar elkaar.',
      'Houd een lichte buiging in je ellebogen en laat je armen in een boog zijwaarts zakken.',
      'Stop als je een duidelijke rek in je borst voelt.',
      'Breng de dumbbells in dezelfde boog terug naar boven.',
    ],
  },
  pec_deck: {
    name: 'Pec deck (vlinder)',
    photo: 'Butterfly',
    steps: [
      'Stel de stoel zo in dat je handen op borsthoogte zitten.',
      'Rug tegen het kussen, ellebogen licht gebogen.',
      'Breng de armen naar elkaar toe voor je borst en knijp kort aan.',
      'Laat ze gecontroleerd terug naar buiten gaan.',
    ],
  },

  // Vertical push
  overhead_press: {
    name: 'Schouderdrukken staand (barbell)',
    photo: 'Standing_Military_Press',
    steps: [
      'Sta met de stang op je bovenborst, handen net buiten schouderbreedte.',
      'Span je buik en billen aan zodat je onderrug niet hol trekt.',
      'Druk de stang recht omhoog; beweeg je hoofd even naar achteren en daarna onder de stang.',
      'Laat de stang gecontroleerd terugzakken naar je borst.',
    ],
  },
  dumbbell_shoulder_press: {
    name: 'Schouderdrukken (dumbbells)',
    photo: 'Dumbbell_Shoulder_Press',
    steps: [
      'Zit rechtop (bank rechtop) met de dumbbells naast je schouders.',
      'Druk ze omhoog tot je armen bijna gestrekt zijn.',
      'Laat ze rustig zakken tot je ellebogen ongeveer op schouderhoogte zijn.',
    ],
  },
  machine_shoulder_press: {
    name: 'Schouderdrukken (machine)',
    photo: 'Machine_Shoulder_Military_Press',
    steps: [
      'Stel de stoel zo in dat de handgrepen op schouderhoogte zitten.',
      'Druk de handgrepen omhoog tot je armen bijna gestrekt zijn.',
      'Laat ze gecontroleerd zakken zonder dat het gewicht neerkomt.',
    ],
  },
  kettlebell_press: {
    name: 'Schouderdrukken (kettlebell)',
    photo: 'Two-Arm_Kettlebell_Military_Press',
    steps: [
      'Houd de kettlebells in de rackpositie: tegen je onderarm, op schouderhoogte.',
      'Span je buik en billen aan.',
      'Druk de kettlebells omhoog tot je armen gestrekt zijn, polsen recht.',
      'Laat ze gecontroleerd terugkomen in de rackpositie.',
    ],
  },
  pike_push_up: {
    name: 'Pike push-up',
    photo: 'Handstand_Push-Ups',
    similar: 'De foto’s tonen een handstand push-up; de pike push-up is dezelfde beweging met je voeten op de grond.',
    steps: [
      'Begin in opdruk-houding en loop met je voeten naar je handen tot je heupen hoog staan (omgekeerde V).',
      'Buig je ellebogen en laat je hoofd zakken naar de grond tussen je handen.',
      'Duw jezelf terug omhoog. Zwaarder maken: zet je voeten op een bank.',
    ],
  },

  // Shoulder isolation / rear delts
  lateral_raise: {
    name: 'Zijwaarts heffen (dumbbells)',
    photo: 'Side_Lateral_Raise',
    steps: [
      'Sta rechtop met een dumbbell in elke hand langs je lichaam.',
      'Hef je armen zijwaarts met een lichte buiging in je ellebogen.',
      'Stop op schouderhoogte; je ellebogen leiden, niet je handen.',
      'Laat ze rustig zakken. Niet zwaaien.',
    ],
  },
  cable_lateral_raise: {
    name: 'Zijwaarts heffen (kabel)',
    photo: 'Cable_Seated_Lateral_Raise',
    steps: [
      'Zet de kabel laag en pak de handgreep met de hand die het verst van de machine is.',
      'Hef je arm zijwaarts tot schouderhoogte, elleboog licht gebogen.',
      'Laat gecontroleerd zakken; de kabel houdt spanning op de hele beweging.',
    ],
  },
  band_lateral_raise: {
    name: 'Zijwaarts heffen (elastiek)',
    photo: 'Lateral_Raise_-_With_Bands',
    steps: [
      'Sta op het midden van het elastiek en pak de uiteinden vast.',
      'Hef je armen zijwaarts tot schouderhoogte, ellebogen licht gebogen.',
      'Laat ze rustig zakken.',
    ],
  },
  face_pull: {
    name: 'Face pull (kabel)',
    photo: 'Face_Pull',
    steps: [
      'Zet de kabel op ooghoogte met een touw, pak beide uiteinden met je duimen naar achteren.',
      'Trek het touw naar je gezicht en trek de uiteinden uit elkaar.',
      'Eindig met je handen naast je oren, ellebogen hoog.',
      'Laat gecontroleerd terugkomen.',
    ],
  },
  reverse_dumbbell_fly: {
    name: 'Reverse fly (dumbbells)',
    photo: 'Reverse_Flyes',
    steps: [
      'Buig voorover vanuit je heupen met een rechte rug, dumbbells onder je borst.',
      'Hef je armen zijwaarts met een lichte buiging in je ellebogen.',
      'Knijp je schouderbladen kort samen bovenin en laat rustig zakken.',
    ],
  },
  band_pull_apart: {
    name: 'Pull-apart (elastiek)',
    photo: 'Band_Pull_Apart',
    steps: [
      'Houd het elastiek met gestrekte armen voor je op schouderhoogte.',
      'Trek het uit elkaar tot je handen naast je lichaam zijn.',
      'Knijp je schouderbladen samen en laat gecontroleerd terugkomen.',
    ],
  },

  // Horizontal pull
  barbell_row: {
    name: 'Voorovergebogen roeien (barbell)',
    photo: 'Bent_Over_Barbell_Row',
    steps: [
      'Pak de stang op schouderbreedte en buig voorover vanuit je heupen, rug recht, knieën licht gebogen.',
      'Laat de stang hangen onder je schouders.',
      'Trek de stang naar je navel, ellebogen langs je lichaam.',
      'Laat gecontroleerd zakken zonder je romp omhoog te zwaaien.',
    ],
  },
  dumbbell_row: {
    name: 'Eenarmig roeien (dumbbell)',
    photo: 'One-Arm_Dumbbell_Row',
    steps: [
      'Zet een knie en een hand op de bank, rug recht en parallel aan de grond.',
      'Laat de dumbbell hangen onder je schouder.',
      'Trek hem naar je heup, elleboog langs je lichaam.',
      'Laat gecontroleerd zakken tot je arm gestrekt is.',
    ],
  },
  seated_cable_row: {
    name: 'Roeien zittend (kabel)',
    photo: 'Seated_Cable_Rows',
    steps: [
      'Zit met je voeten tegen de steun, knieën licht gebogen, rug recht.',
      'Trek de handgreep naar je buik en trek je schouderbladen samen.',
      'Laat gecontroleerd terugkomen tot je armen gestrekt zijn, zonder met je romp mee te zwaaien.',
    ],
  },
  chest_supported_row: {
    name: 'Roeien met borststeun (machine)',
    photo: 'Leverage_Iso_Row',
    steps: [
      'Stel de stoel in zodat de handgrepen op borsthoogte zitten, borst tegen het kussen.',
      'Trek de handgrepen naar je toe en knijp je schouderbladen samen.',
      'Laat ze gecontroleerd terugkomen tot je armen gestrekt zijn.',
    ],
  },
  kettlebell_row: {
    name: 'Roeien (kettlebell)',
    photo: 'One-Arm_Kettlebell_Row',
    steps: [
      'Buig voorover vanuit je heupen met een rechte rug, kettlebell in één hand.',
      'Trek de kettlebell naar je heup, elleboog langs je lichaam.',
      'Laat gecontroleerd zakken en wissel na de set van kant.',
    ],
  },
  band_row: {
    name: 'Roeien (elastiek)',
    photo: 'Seated_Cable_Rows',
    similar: 'De foto’s tonen roeien met een kabel; met een elastiek om je voeten of een paal is de beweging hetzelfde.',
    steps: [
      'Zit met gestrekte benen en het elastiek om je voeten, of maak het vast op buikhoogte.',
      'Trek de uiteinden naar je buik en knijp je schouderbladen samen.',
      'Laat gecontroleerd terugkomen.',
    ],
  },

  // Vertical pull
  pull_up: {
    name: 'Optrekken (pull-up)',
    photo: 'Pullups',
    steps: [
      'Hang aan de stang met je handen iets breder dan schouderbreedte, handpalmen van je af.',
      'Trek je schouders omlaag en trek jezelf op tot je kin boven de stang is.',
      'Laat jezelf gecontroleerd zakken tot je armen gestrekt zijn.',
    ],
  },
  chin_up: {
    name: 'Optrekken onderhands (chin-up)',
    photo: 'Chin-Up',
    steps: [
      'Hang aan de stang met je handen op schouderbreedte, handpalmen naar je toe.',
      'Trek jezelf op tot je kin boven de stang is, ellebogen naar beneden.',
      'Laat jezelf gecontroleerd zakken tot je armen gestrekt zijn.',
    ],
  },
  lat_pulldown: {
    name: 'Lat pulldown',
    photo: 'Wide-Grip_Lat_Pulldown',
    steps: [
      'Zet je knieën onder de steun en pak de stang iets breder dan schouderbreedte.',
      'Leun iets naar achteren en trek de stang naar je bovenborst.',
      'Trek je ellebogen omlaag en naar achteren, schouders weg van je oren.',
      'Laat de stang gecontroleerd terug omhoog gaan.',
    ],
  },
  band_pulldown: {
    name: 'Pulldown (elastiek)',
    photo: 'Wide-Grip_Lat_Pulldown',
    similar: 'De foto’s tonen de lat pulldown aan een kabel; met een hoog vastgemaakt elastiek is de beweging hetzelfde.',
    steps: [
      'Maak het elastiek hoog vast en pak de uiteinden met gestrekte armen.',
      'Trek je ellebogen omlaag naar je zij.',
      'Laat gecontroleerd terugkomen.',
    ],
  },

  // Squat
  back_squat: {
    name: 'Squat (barbell)',
    photo: 'Barbell_Full_Squat',
    steps: [
      'Leg de stang op je bovenrug (niet op je nek), voeten op schouderbreedte, tenen licht naar buiten.',
      'Adem in, span je buik aan en zak door je heupen en knieën tegelijk.',
      'Ga zo diep als je kunt met een rechte rug, knieën in de richting van je tenen.',
      'Duw jezelf omhoog via je hele voet.',
    ],
  },
  front_squat: {
    name: 'Front squat',
    photo: 'Front_Barbell_Squat',
    steps: [
      'Leg de stang voor op je schouders, ellebogen hoog naar voren.',
      'Zak recht naar beneden met een rechtop staande romp.',
      'Houd je ellebogen hoog en duw jezelf terug omhoog.',
    ],
  },
  leg_press: {
    name: 'Beenpers (leg press)',
    photo: 'Leg_Press',
    steps: [
      'Zit met je rug en billen tegen het kussen, voeten op schouderbreedte op het plateau.',
      'Ontgrendel het gewicht en laat het plateau zakken tot je knieën ongeveer 90° zijn.',
      'Duw het plateau weg via je hielen, zonder je knieën op slot te zetten.',
    ],
  },
  hack_squat: {
    name: 'Hack squat',
    photo: 'Hack_Squat',
    steps: [
      'Sta met je rug tegen het kussen, schouders onder de steunen, voeten op schouderbreedte.',
      'Zak gecontroleerd tot je bovenbenen ongeveer parallel aan het plateau zijn.',
      'Duw jezelf terug omhoog via je hele voet.',
    ],
  },
  goblet_squat: {
    name: 'Goblet squat (dumbbell)',
    photo: 'Goblet_Squat',
    steps: [
      'Houd één dumbbell rechtop tegen je borst, voeten iets breder dan schouderbreedte.',
      'Zak tussen je knieën door, romp rechtop, ellebogen binnen je knieën.',
      'Duw jezelf terug omhoog.',
    ],
  },
  kettlebell_goblet_squat: {
    name: 'Goblet squat (kettlebell)',
    photo: 'Goblet_Squat',
    similar: 'De foto’s tonen de goblet squat met een dumbbell; met een kettlebell aan de handgreep is het hetzelfde.',
    steps: [
      'Houd de kettlebell bij de handgreep tegen je borst, voeten iets breder dan schouderbreedte.',
      'Zak tussen je knieën door met een rechte romp.',
      'Duw jezelf terug omhoog.',
    ],
  },
  bodyweight_squat: {
    name: 'Squat (lichaamsgewicht)',
    photo: 'Bodyweight_Squat',
    steps: [
      'Sta met je voeten op schouderbreedte, armen voor je uit.',
      'Zak door je heupen en knieën zo diep als je kunt met een rechte rug.',
      'Duw jezelf terug omhoog.',
    ],
  },

  // Lunge / single leg
  bulgarian_split_squat: {
    name: 'Bulgarian split squat',
    photo: 'Split_Squat_with_Dumbbells',
    steps: [
      'Sta voor een bank en leg de wreef van je achterste voet erop, dumbbells in je handen.',
      'Zak recht naar beneden tot je voorste bovenbeen ongeveer parallel aan de grond is.',
      'Duw jezelf omhoog via de hiel van je voorste voet. Doe alle herhalingen en wissel dan.',
    ],
  },
  walking_lunge: {
    name: 'Lopende lunge (dumbbells)',
    photo: 'Dumbbell_Lunges',
    steps: [
      'Sta rechtop met een dumbbell in elke hand.',
      'Zet een grote stap naar voren en zak tot je achterste knie bijna de grond raakt.',
      'Duw jezelf omhoog en stap door met je andere been.',
    ],
  },
  step_up: {
    name: 'Step-up (dumbbells)',
    photo: 'Dumbbell_Step_Ups',
    steps: [
      'Sta voor een bank met een dumbbell in elke hand.',
      'Zet één voet volledig op de bank en duw jezelf omhoog via die voet.',
      'Stap gecontroleerd terug naar beneden. Wissel na de set van been.',
    ],
  },
  reverse_lunge: {
    name: 'Achterwaartse lunge',
    photo: 'Dumbbell_Rear_Lunge',
    similar: 'De foto’s tonen de beweging met dumbbells; zonder gewicht gaat het precies zo.',
    steps: [
      'Sta rechtop met je voeten op heupbreedte.',
      'Zet een grote stap naar achteren en zak tot je achterste knie bijna de grond raakt.',
      'Duw jezelf via je voorste voet terug naar de beginpositie en wissel van been.',
    ],
  },

  // Hinge
  deadlift: {
    name: 'Deadlift',
    photo: 'Barbell_Deadlift',
    steps: [
      'Sta met de stang boven het midden van je voeten, voeten op heupbreedte.',
      'Pak de stang net buiten je knieën, rug recht, borst omhoog, schouders boven de stang.',
      'Duw de grond weg en kom omhoog met de stang dicht langs je benen.',
      'Laat de stang zakken door eerst je heupen naar achteren te duwen.',
    ],
  },
  romanian_deadlift: {
    name: 'Roemeense deadlift (barbell)',
    photo: 'Romanian_Deadlift',
    steps: [
      'Sta rechtop met de stang voor je bovenbenen, knieën licht gebogen.',
      'Duw je heupen naar achteren en laat de stang langs je benen zakken, rug recht.',
      'Stop als je een sterke rek in je hamstrings voelt (meestal net onder je knieën).',
      'Kom omhoog door je heupen naar voren te duwen.',
    ],
  },
  dumbbell_romanian_deadlift: {
    name: 'Roemeense deadlift (dumbbells)',
    photo: 'Stiff-Legged_Dumbbell_Deadlift',
    steps: [
      'Sta rechtop met de dumbbells voor je bovenbenen, knieën licht gebogen.',
      'Duw je heupen naar achteren en laat de dumbbells langs je benen zakken, rug recht.',
      'Kom omhoog door je heupen naar voren te duwen.',
    ],
  },
  kettlebell_swing: {
    name: 'Kettlebell swing',
    photo: 'One-Arm_Kettlebell_Swings',
    similar: 'De foto’s tonen de eenarmige variant; de app gaat uit van twee handen aan de kettlebell.',
    steps: [
      'Sta met je voeten iets breder dan heupbreedte, kettlebell met twee handen vast.',
      'Zwaai de kettlebell tussen je benen door door je heupen naar achteren te duwen.',
      'Stuw je heupen krachtig naar voren; de kettlebell zwaait tot borsthoogte.',
      'De kracht komt uit je heupen, niet uit je armen.',
    ],
  },
  hip_thrust: {
    name: 'Hip thrust (barbell)',
    photo: 'Barbell_Hip_Thrust',
    steps: [
      'Zit met je bovenrug tegen de bank, stang (met kussen) op je heupen.',
      'Zet je voeten plat neer zodat je knieën bovenin 90° zijn.',
      'Duw je heupen omhoog tot je lichaam van schouders tot knieën recht is en knijp je billen aan.',
      'Laat je heupen gecontroleerd zakken.',
    ],
  },
  glute_bridge: {
    name: 'Bilbrug (glute bridge)',
    photo: 'Butt_Lift_Bridge',
    steps: [
      'Lig op je rug met gebogen knieën, voeten plat op de grond.',
      'Duw je heupen omhoog tot je lichaam van schouders tot knieën recht is.',
      'Knijp je billen bovenin kort aan en laat rustig zakken.',
    ],
  },

  // Leg isolation
  leg_extension: {
    name: 'Beenstrekken (leg extension)',
    photo: 'Leg_Extensions',
    steps: [
      'Stel de machine zo in dat je knieën bij het draaipunt zitten en het kussen op je enkels ligt.',
      'Strek je benen tot ze bijna recht zijn.',
      'Laat gecontroleerd zakken.',
    ],
  },
  leg_curl: {
    name: 'Beenbuigen (leg curl)',
    photo: 'Lying_Leg_Curls',
    steps: [
      'Lig (of zit) in de machine met het kussen net boven je hielen.',
      'Buig je knieën en trek het kussen naar je billen.',
      'Laat gecontroleerd terugkomen tot je benen bijna gestrekt zijn.',
    ],
  },
  standing_calf_raise: {
    name: 'Kuitheffen (machine)',
    photo: 'Standing_Calf_Raises',
    steps: [
      'Sta met de bal van je voeten op de rand, schouders onder de steunen.',
      'Laat je hielen zo ver mogelijk zakken.',
      'Kom zo hoog mogelijk op je tenen en houd kort vast.',
    ],
  },
  dumbbell_calf_raise: {
    name: 'Kuitheffen (dumbbells)',
    photo: 'Standing_Dumbbell_Calf_Raise',
    steps: [
      'Sta met een dumbbell in elke hand, eventueel met je voorvoeten op een verhoging.',
      'Kom zo hoog mogelijk op je tenen en houd kort vast.',
      'Laat je hielen rustig zakken.',
    ],
  },
  bodyweight_calf_raise: {
    name: 'Kuitheffen op één been',
    photo: 'Standing_Dumbbell_Calf_Raise',
    similar: 'De foto’s tonen kuitheffen met dumbbells op twee benen; op één been zonder gewicht is de beweging hetzelfde.',
    steps: [
      'Sta op één been met de bal van je voet op een traptree, houd je vast voor je evenwicht.',
      'Laat je hiel zo ver mogelijk zakken.',
      'Kom zo hoog mogelijk op je tenen. Wissel na de set van been.',
    ],
  },

  // Arms
  barbell_curl: {
    name: 'Bicepscurl (barbell)',
    photo: 'Barbell_Curl',
    steps: [
      'Sta rechtop met de stang op schouderbreedte, handpalmen naar voren.',
      'Buig je ellebogen en krul de stang omhoog; je ellebogen blijven naast je lichaam.',
      'Laat gecontroleerd zakken. Niet met je rug meezwaaien.',
    ],
  },
  dumbbell_curl: {
    name: 'Bicepscurl (dumbbells)',
    photo: 'Dumbbell_Bicep_Curl',
    steps: [
      'Sta rechtop met een dumbbell in elke hand, handpalmen naar voren.',
      'Krul de dumbbells omhoog, ellebogen naast je lichaam.',
      'Laat gecontroleerd zakken tot je armen gestrekt zijn.',
    ],
  },
  hammer_curl: {
    name: 'Hammer curl',
    photo: 'Hammer_Curls',
    steps: [
      'Sta rechtop met de dumbbells naast je lichaam, handpalmen naar elkaar.',
      'Krul ze omhoog zonder je polsen te draaien.',
      'Laat gecontroleerd zakken.',
    ],
  },
  cable_curl: {
    name: 'Bicepscurl (kabel)',
    photo: 'Standing_Biceps_Cable_Curl',
    steps: [
      'Zet de kabel laag met een stang en sta rechtop, handpalmen naar boven.',
      'Krul de stang omhoog, ellebogen naast je lichaam.',
      'Laat gecontroleerd zakken; de kabel houdt spanning.',
    ],
  },
  band_curl: {
    name: 'Bicepscurl (elastiek)',
    photo: 'Standing_Biceps_Cable_Curl',
    similar: 'De foto’s tonen de curl aan een kabel; staand op een elastiek gaat het hetzelfde.',
    steps: [
      'Sta op het midden van het elastiek en pak de uiteinden, handpalmen naar voren.',
      'Krul je handen omhoog, ellebogen naast je lichaam.',
      'Laat gecontroleerd zakken.',
    ],
  },
  triceps_pushdown: {
    name: 'Triceps pushdown (kabel)',
    photo: 'Triceps_Pushdown',
    steps: [
      'Zet de kabel hoog en pak de stang of het touw, ellebogen tegen je zij.',
      'Duw de handgreep omlaag tot je armen gestrekt zijn.',
      'Laat gecontroleerd terugkomen tot je onderarmen ongeveer horizontaal zijn; je ellebogen bewegen niet.',
    ],
  },
  overhead_triceps_extension: {
    name: 'Triceps boven het hoofd (dumbbell)',
    photo: 'Standing_Dumbbell_Triceps_Extension',
    steps: [
      'Houd één dumbbell met twee handen boven je hoofd.',
      'Laat hem achter je hoofd zakken door je ellebogen te buigen; ellebogen wijzen naar voren.',
      'Strek je armen weer tot boven je hoofd.',
    ],
  },
  skull_crusher: {
    name: 'Skull crusher (EZ-stang)',
    photo: 'EZ-Bar_Skullcrusher',
    steps: [
      'Lig op de bank met de EZ-stang boven je borst, armen gestrekt.',
      'Buig alleen je ellebogen en laat de stang zakken naar je voorhoofd.',
      'Strek je armen weer; je bovenarmen blijven stil.',
    ],
  },
  bench_dip: {
    name: 'Dips op een bank',
    photo: 'Bench_Dips',
    steps: [
      'Zet je handen achter je op de rand van een bank, benen naar voren.',
      'Zak door je ellebogen te buigen tot je bovenarmen ongeveer horizontaal zijn.',
      'Duw jezelf terug omhoog. Zwaarder: leg je voeten op een tweede bank.',
    ],
  },
  band_pushdown: {
    name: 'Triceps pushdown (elastiek)',
    photo: 'Triceps_Pushdown',
    similar: 'De foto’s tonen de pushdown aan een kabel; met een hoog vastgemaakt elastiek is het hetzelfde.',
    steps: [
      'Maak het elastiek hoog vast en pak de uiteinden, ellebogen tegen je zij.',
      'Duw je handen omlaag tot je armen gestrekt zijn.',
      'Laat gecontroleerd terugkomen.',
    ],
  },

  // Core
  cable_crunch: {
    name: 'Cable crunch',
    photo: 'Cable_Crunch',
    steps: [
      'Kniel voor de hoge kabel en houd het touw naast je hoofd.',
      'Rol je romp naar beneden door je buikspieren aan te spannen; je heupen blijven stil.',
      'Kom gecontroleerd terug omhoog.',
    ],
  },
  pallof_press: {
    name: 'Pallof press',
    photo: 'Pallof_Press',
    steps: [
      'Sta zijwaarts naast de kabel op borsthoogte, handgreep met twee handen tegen je borst.',
      'Duw je handen recht naar voren en weersta de trek naar de machine.',
      'Houd kort vast, breng je handen terug en wissel na de set van kant.',
    ],
  },
  hanging_knee_raise: {
    name: 'Hangend knieheffen',
    photo: 'Hanging_Leg_Raise',
    similar: 'De foto’s tonen de zwaardere variant met gestrekte benen; trek voor knieheffen je knieën op.',
    steps: [
      'Hang aan de stang met gestrekte armen.',
      'Trek je knieën op richting je borst en kantel je bekken.',
      'Laat je benen gecontroleerd zakken zonder te zwaaien.',
    ],
  },
  dead_bug: {
    name: 'Dead bug',
    photo: 'Dead_Bug',
    steps: [
      'Lig op je rug met je armen omhoog en je knieën 90° boven je heupen.',
      'Druk je onderrug tegen de grond.',
      'Strek tegelijk één arm en het andere been uit, zonder dat je rug loskomt.',
      'Kom terug en wissel van kant.',
    ],
  },
};
