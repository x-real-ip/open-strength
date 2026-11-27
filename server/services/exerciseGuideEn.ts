// English how-to steps for the curated exercises (the Dutch ones live in exerciseGuide.ts).
// `similar` explains photos that show a close variant rather than the exact exercise.

export interface ExerciseGuideEn {
  steps: string[];
  similar?: string;
}

export const GUIDES_EN: Record<string, ExerciseGuideEn> = {
  barbell_bench_press: {
    steps: [
      'Lie on the bench with your eyes under the bar, feet flat on the floor.',
      'Grip the bar slightly wider than shoulder width; pull your shoulder blades back and down.',
      'Lower the bar under control to your lower chest, elbows about 45° from your torso.',
      'Press the bar up until your arms are straight, without lifting your glutes off the bench.',
    ],
  },
  incline_barbell_bench_press: {
    steps: [
      'Set the bench to 30–45° and lie with your eyes under the bar.',
      'Grip the bar slightly wider than shoulder width, shoulder blades back.',
      'Lower the bar to your upper chest, just below your collarbones.',
      'Press straight up until your arms are straight.',
    ],
  },
  dumbbell_bench_press: {
    steps: [
      'Lie on the bench with a dumbbell in each hand at chest height.',
      'Pull your shoulder blades back, feet flat on the floor.',
      'Press the dumbbells up until your arms are straight; they meet above your chest.',
      'Lower them under control until you feel a light stretch in your chest.',
    ],
  },
  incline_dumbbell_press: {
    steps: [
      'Set the bench to 30–45° and hold the dumbbells next to your upper chest.',
      'Press them up and slightly together until your arms are straight.',
      'Lower them slowly until your elbows are just below shoulder height.',
    ],
  },
  machine_chest_press: {
    steps: [
      'Adjust the seat so the handles are at chest height.',
      'Back against the pad, shoulder blades back.',
      'Push the handles forward until your arms are almost straight.',
      'Let them come back under control without the weight touching down.',
    ],
  },
  push_up: {
    steps: [
      'Hands slightly wider than your shoulders, body in one straight line from head to heels.',
      'Brace your abs and glutes.',
      'Lower until your chest is just above the floor, elbows angled back.',
      'Push back up without letting your hips sag. Too hard? Put your hands on a bench.',
    ],
  },
  close_grip_bench_press: {
    steps: [
      'Lie on the bench and grip the bar at shoulder width.',
      'Lower the bar to your lower chest, elbows close to your body.',
      'Press up with your triceps until your arms are straight.',
    ],
  },
  cable_fly: {
    steps: [
      'Set both cables high, take the handles and step forward.',
      'Lean forward slightly, arms out with a small bend in your elbows.',
      'Bring your hands together in an arc in front of your body.',
      'Let them return under control until you feel a stretch in your chest.',
    ],
  },
  dumbbell_fly: {
    steps: [
      'Lie on the bench with the dumbbells above your chest, palms facing each other.',
      'Keep a slight bend in your elbows and lower your arms out to the sides in an arc.',
      'Stop when you feel a clear stretch in your chest.',
      'Bring the dumbbells back up along the same arc.',
    ],
  },
  pec_deck: {
    steps: [
      'Adjust the seat so your hands are at chest height.',
      'Back against the pad, elbows slightly bent.',
      'Bring your arms together in front of your chest and squeeze briefly.',
      'Let them return under control.',
    ],
  },
  overhead_press: {
    steps: [
      'Stand with the bar on your upper chest, hands just outside shoulder width.',
      'Brace your abs and glutes so your lower back does not arch.',
      'Press the bar straight up; move your head back briefly, then under the bar.',
      'Lower the bar under control to your chest.',
    ],
  },
  dumbbell_shoulder_press: {
    steps: [
      'Sit upright (bench upright) with the dumbbells next to your shoulders.',
      'Press them up until your arms are almost straight.',
      'Lower them slowly until your elbows are about at shoulder height.',
    ],
  },
  machine_shoulder_press: {
    steps: [
      'Adjust the seat so the handles are at shoulder height.',
      'Press the handles up until your arms are almost straight.',
      'Lower them under control without the weight touching down.',
    ],
  },
  kettlebell_press: {
    steps: [
      'Hold the kettlebells in the rack position: against your forearm, at shoulder height.',
      'Brace your abs and glutes.',
      'Press the kettlebells up until your arms are straight, wrists neutral.',
      'Bring them back to the rack position under control.',
    ],
  },
  pike_push_up: {
    similar: 'The photos show a handstand push-up; the pike push-up is the same movement with your feet on the floor.',
    steps: [
      'Start in a push-up position and walk your feet towards your hands until your hips are high (an upside-down V).',
      'Bend your elbows and lower your head towards the floor between your hands.',
      'Push back up. To make it harder, put your feet on a bench.',
    ],
  },
  lateral_raise: {
    steps: [
      'Stand tall with a dumbbell in each hand by your sides.',
      'Raise your arms out to the sides with a slight bend in your elbows.',
      'Stop at shoulder height; your elbows lead, not your hands.',
      'Lower slowly. No swinging.',
    ],
  },
  cable_lateral_raise: {
    steps: [
      'Set the cable low and take the handle with the hand furthest from the machine.',
      'Raise your arm out to the side to shoulder height, elbow slightly bent.',
      'Lower under control; the cable keeps tension through the whole movement.',
    ],
  },
  band_lateral_raise: {
    steps: [
      'Stand on the middle of the band and hold the ends.',
      'Raise your arms out to the sides to shoulder height, elbows slightly bent.',
      'Lower slowly.',
    ],
  },
  face_pull: {
    steps: [
      'Set the cable at eye height with a rope; hold both ends with your thumbs pointing back.',
      'Pull the rope towards your face and pull the ends apart.',
      'Finish with your hands next to your ears, elbows high.',
      'Let it return under control.',
    ],
  },
  reverse_dumbbell_fly: {
    steps: [
      'Hinge forward at the hips with a straight back, dumbbells under your chest.',
      'Raise your arms out to the sides with a slight bend in your elbows.',
      'Squeeze your shoulder blades together briefly at the top and lower slowly.',
    ],
  },
  band_pull_apart: {
    steps: [
      'Hold the band in front of you at shoulder height with straight arms.',
      'Pull it apart until your hands are next to your body.',
      'Squeeze your shoulder blades together and let it return under control.',
    ],
  },
  barbell_row: {
    steps: [
      'Grip the bar at shoulder width and hinge forward at the hips, back straight, knees slightly bent.',
      'Let the bar hang below your shoulders.',
      'Pull the bar towards your belly button, elbows close to your body.',
      'Lower under control without swinging your torso up.',
    ],
  },
  dumbbell_row: {
    steps: [
      'Put one knee and one hand on the bench, back straight and parallel to the floor.',
      'Let the dumbbell hang below your shoulder.',
      'Pull it towards your hip, elbow close to your body.',
      'Lower under control until your arm is straight.',
    ],
  },
  seated_cable_row: {
    steps: [
      'Sit with your feet against the platform, knees slightly bent, back straight.',
      'Pull the handle to your belly and squeeze your shoulder blades together.',
      'Let it return under control until your arms are straight, without rocking your torso.',
    ],
  },
  chest_supported_row: {
    steps: [
      'Adjust the seat so the handles are at chest height, chest against the pad.',
      'Pull the handles towards you and squeeze your shoulder blades together.',
      'Let them return under control until your arms are straight.',
    ],
  },
  kettlebell_row: {
    steps: [
      'Hinge forward at the hips with a straight back, kettlebell in one hand.',
      'Pull the kettlebell towards your hip, elbow close to your body.',
      'Lower under control and switch sides after the set.',
    ],
  },
  band_row: {
    similar: 'The photos show a cable row; with a band around your feet or a post the movement is the same.',
    steps: [
      'Sit with straight legs and the band around your feet, or anchor it at belly height.',
      'Pull the ends towards your belly and squeeze your shoulder blades together.',
      'Let it return under control.',
    ],
  },
  pull_up: {
    steps: [
      'Hang from the bar with your hands slightly wider than shoulder width, palms facing away.',
      'Pull your shoulders down and pull yourself up until your chin is over the bar.',
      'Lower yourself under control until your arms are straight.',
    ],
  },
  chin_up: {
    steps: [
      'Hang from the bar with your hands at shoulder width, palms facing you.',
      'Pull yourself up until your chin is over the bar, elbows driving down.',
      'Lower yourself under control until your arms are straight.',
    ],
  },
  lat_pulldown: {
    steps: [
      'Put your knees under the pad and grip the bar slightly wider than shoulder width.',
      'Lean back slightly and pull the bar to your upper chest.',
      'Drive your elbows down and back, shoulders away from your ears.',
      'Let the bar go back up under control.',
    ],
  },
  band_pulldown: {
    similar: 'The photos show the lat pulldown on a cable; with a band anchored high the movement is the same.',
    steps: [
      'Anchor the band high and hold the ends with straight arms.',
      'Pull your elbows down to your sides.',
      'Let it return under control.',
    ],
  },
  back_squat: {
    steps: [
      'Rest the bar on your upper back (not your neck), feet shoulder-width apart, toes slightly out.',
      'Breathe in, brace your abs and bend at the hips and knees at the same time.',
      'Go as deep as you can with a straight back, knees tracking over your toes.',
      'Drive back up through your whole foot.',
    ],
  },
  front_squat: {
    steps: [
      'Rest the bar on the front of your shoulders, elbows high and forward.',
      'Squat straight down with an upright torso.',
      'Keep your elbows high and drive back up.',
    ],
  },
  leg_press: {
    steps: [
      'Sit with your back and glutes against the pad, feet shoulder-width apart on the platform.',
      'Release the weight and lower the platform until your knees are at about 90°.',
      'Push the platform away through your heels, without locking your knees.',
    ],
  },
  hack_squat: {
    steps: [
      'Stand with your back against the pad, shoulders under the supports, feet shoulder-width apart.',
      'Lower under control until your thighs are about parallel to the platform.',
      'Drive back up through your whole foot.',
    ],
  },
  goblet_squat: {
    steps: [
      'Hold one dumbbell upright against your chest, feet slightly wider than shoulder width.',
      'Squat down between your knees, torso upright, elbows inside your knees.',
      'Drive back up.',
    ],
  },
  kettlebell_goblet_squat: {
    similar: 'The photos show the goblet squat with a dumbbell; holding a kettlebell by the handle it is the same.',
    steps: [
      'Hold the kettlebell by the handle against your chest, feet slightly wider than shoulder width.',
      'Squat down between your knees with an upright torso.',
      'Drive back up.',
    ],
  },
  bodyweight_squat: {
    steps: [
      'Stand with your feet shoulder-width apart, arms out in front.',
      'Bend at the hips and knees as deep as you can with a straight back.',
      'Drive back up.',
    ],
  },
  bulgarian_split_squat: {
    steps: [
      'Stand in front of a bench and rest the top of your back foot on it, dumbbells in your hands.',
      'Lower straight down until your front thigh is about parallel to the floor.',
      'Drive up through the heel of your front foot. Do all reps, then switch legs.',
    ],
  },
  walking_lunge: {
    steps: [
      'Stand tall with a dumbbell in each hand.',
      'Take a long step forward and lower until your back knee almost touches the floor.',
      'Push up and step through with your other leg.',
    ],
  },
  step_up: {
    steps: [
      'Stand in front of a bench with a dumbbell in each hand.',
      'Put one foot fully on the bench and push yourself up through that foot.',
      'Step back down under control. Switch legs after the set.',
    ],
  },
  reverse_lunge: {
    similar: 'The photos show the movement with dumbbells; without weight it works exactly the same.',
    steps: [
      'Stand tall with your feet hip-width apart.',
      'Take a long step back and lower until your back knee almost touches the floor.',
      'Push back to the start through your front foot and switch legs.',
    ],
  },
  deadlift: {
    steps: [
      'Stand with the bar over the middle of your feet, feet hip-width apart.',
      'Grip the bar just outside your knees, back straight, chest up, shoulders over the bar.',
      'Push the floor away and stand up with the bar close to your legs.',
      'Lower the bar by pushing your hips back first.',
    ],
  },
  romanian_deadlift: {
    steps: [
      'Stand tall with the bar in front of your thighs, knees slightly bent.',
      'Push your hips back and lower the bar along your legs, back straight.',
      'Stop when you feel a strong stretch in your hamstrings (usually just below your knees).',
      'Come up by driving your hips forward.',
    ],
  },
  dumbbell_romanian_deadlift: {
    steps: [
      'Stand tall with the dumbbells in front of your thighs, knees slightly bent.',
      'Push your hips back and lower the dumbbells along your legs, back straight.',
      'Come up by driving your hips forward.',
    ],
  },
  kettlebell_swing: {
    similar: 'The photos show the one-arm version; the app assumes two hands on the kettlebell.',
    steps: [
      'Stand with your feet slightly wider than hip width, kettlebell in both hands.',
      'Swing the kettlebell back between your legs by pushing your hips back.',
      'Drive your hips forward hard; the kettlebell swings up to chest height.',
      'The power comes from your hips, not your arms.',
    ],
  },
  hip_thrust: {
    steps: [
      'Sit with your upper back against the bench, bar (with a pad) across your hips.',
      'Place your feet flat so your knees are at 90° at the top.',
      'Drive your hips up until your body is straight from shoulders to knees and squeeze your glutes.',
      'Lower your hips under control.',
    ],
  },
  glute_bridge: {
    steps: [
      'Lie on your back with bent knees, feet flat on the floor.',
      'Push your hips up until your body is straight from shoulders to knees.',
      'Squeeze your glutes briefly at the top and lower slowly.',
    ],
  },
  leg_extension: {
    steps: [
      'Adjust the machine so your knees line up with the pivot and the pad rests on your ankles.',
      'Straighten your legs until they are almost straight.',
      'Lower under control.',
    ],
  },
  leg_curl: {
    steps: [
      'Lie (or sit) in the machine with the pad just above your heels.',
      'Bend your knees and pull the pad towards your glutes.',
      'Let it return under control until your legs are almost straight.',
    ],
  },
  standing_calf_raise: {
    steps: [
      'Stand with the balls of your feet on the edge, shoulders under the pads.',
      'Lower your heels as far as you can.',
      'Rise as high as you can onto your toes and hold briefly.',
    ],
  },
  dumbbell_calf_raise: {
    steps: [
      'Stand with a dumbbell in each hand, optionally with the front of your feet on a step.',
      'Rise as high as you can onto your toes and hold briefly.',
      'Lower your heels slowly.',
    ],
  },
  bodyweight_calf_raise: {
    similar: 'The photos show calf raises with dumbbells on two legs; on one leg without weight the movement is the same.',
    steps: [
      'Stand on one leg with the ball of your foot on a step; hold on for balance.',
      'Lower your heel as far as you can.',
      'Rise as high as you can onto your toes. Switch legs after the set.',
    ],
  },
  barbell_curl: {
    steps: [
      'Stand tall holding the bar at shoulder width, palms facing forward.',
      'Bend your elbows and curl the bar up; your elbows stay by your sides.',
      'Lower under control. Do not swing with your back.',
    ],
  },
  dumbbell_curl: {
    steps: [
      'Stand tall with a dumbbell in each hand, palms facing forward.',
      'Curl the dumbbells up, elbows by your sides.',
      'Lower under control until your arms are straight.',
    ],
  },
  hammer_curl: {
    steps: [
      'Stand tall with the dumbbells by your sides, palms facing each other.',
      'Curl them up without rotating your wrists.',
      'Lower under control.',
    ],
  },
  cable_curl: {
    steps: [
      'Set the cable low with a bar and stand tall, palms facing up.',
      'Curl the bar up, elbows by your sides.',
      'Lower under control; the cable keeps the tension.',
    ],
  },
  band_curl: {
    similar: 'The photos show the curl on a cable; standing on a band it works the same.',
    steps: [
      'Stand on the middle of the band and hold the ends, palms facing forward.',
      'Curl your hands up, elbows by your sides.',
      'Lower under control.',
    ],
  },
  triceps_pushdown: {
    steps: [
      'Set the cable high and take the bar or rope, elbows against your sides.',
      'Push the handle down until your arms are straight.',
      'Let it return under control until your forearms are about horizontal; your elbows do not move.',
    ],
  },
  overhead_triceps_extension: {
    steps: [
      'Hold one dumbbell with both hands above your head.',
      'Lower it behind your head by bending your elbows; elbows point forward.',
      'Straighten your arms above your head again.',
    ],
  },
  skull_crusher: {
    steps: [
      'Lie on the bench with the EZ bar above your chest, arms straight.',
      'Bend only your elbows and lower the bar towards your forehead.',
      'Straighten your arms again; your upper arms stay still.',
    ],
  },
  bench_dip: {
    steps: [
      'Put your hands behind you on the edge of a bench, legs out in front.',
      'Lower by bending your elbows until your upper arms are about horizontal.',
      'Push back up. Harder: put your feet on a second bench.',
    ],
  },
  band_pushdown: {
    similar: 'The photos show the pushdown on a cable; with a band anchored high it is the same.',
    steps: [
      'Anchor the band high and hold the ends, elbows against your sides.',
      'Push your hands down until your arms are straight.',
      'Let it return under control.',
    ],
  },
  cable_crunch: {
    steps: [
      'Kneel in front of the high cable and hold the rope next to your head.',
      'Curl your torso down by contracting your abs; your hips stay still.',
      'Come back up under control.',
    ],
  },
  pallof_press: {
    steps: [
      'Stand side-on to the cable at chest height, handle in both hands against your chest.',
      'Press your hands straight out and resist the pull towards the machine.',
      'Hold briefly, bring your hands back, and switch sides after the set.',
    ],
  },
  hanging_knee_raise: {
    similar: 'The photos show the harder straight-leg version; for knee raises, pull your knees up.',
    steps: [
      'Hang from the bar with straight arms.',
      'Pull your knees up towards your chest and tilt your pelvis.',
      'Lower your legs under control without swinging.',
    ],
  },
  dead_bug: {
    steps: [
      'Lie on your back with your arms up and your knees bent 90° above your hips.',
      'Press your lower back into the floor.',
      'Extend one arm and the opposite leg at the same time, without your back lifting.',
      'Come back and switch sides.',
    ],
  },
};
