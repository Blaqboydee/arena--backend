/**
 * wordleCore.js
 * Shared Wordle primitives: the answer pool and the grading function.
 *
 * Used by the Daily Challenge (server-authoritative solo mode). The live
 * multiplayer WordleDuel keeps its own copy intentionally untouched — this
 * module is additive and does not change that engine.
 */

export const WORD_LENGTH = 5;

// Curated common 5-letter words (same pool as the duel for a consistent feel).
const ANSWER_WORDS = [
  "about","above","abuse","actor","adapt","admit","adopt","adult","after","again",
  "agent","agree","ahead","alarm","album","alien","align","alive","allow","alone",
  "along","alter","amaze","among","angel","anger","angle","angry","anime","ankle",
  "annoy","apart","apple","apply","arena","argue","arise","armor","array",
  "aside","asset","avoid","awake","award","aware","badly","basic","basis","batch",
  "beach","begun","being","belly","bench","berry","birth","black","blade","blame",
  "blank","blast","blaze","bleed","blend","bless","blind","block","blood","bloom",
  "blown","blues","blunt","board","bonus","boost","booth","bound","brain","brand",
  "brave","bread","break","breed","brick","bride","brief","bring","broad","broke",
  "brook","brown","brush","buddy","build","built","bunch","burst","buyer","cabin",
  "cable","candy","cargo","carry","catch","cause","chain","chair","chalk",
  "champ","chaos","charm","chart","chase","cheap","check","cheer","chess","chest",
  "chief","child","chill","china","chips","choir","chord","chose","chunk","civil",
  "claim","clash","class","clean","clear","clerk","click","cliff","climb","cling",
  "clock","clone","close","cloth","cloud","coach","coast","color","comic","coral",
  "couch","could","count","court","cover","crack","craft","crane","crash","crazy",
  "cream","crime","crisp","cross","crowd","crown","cruel","crush","cubic","curve",
  "cycle","daily","dance","death","debut","decay","delay","delta","demon","dense",
  "depot","depth","derby","devil","dirty","disco","ditch","doing","donor",
  "doubt","dough","draft","drain","drama","drank","drape","drawn","dream","dress",
  "dried","drift","drill","drink","drive","drone","drops","drove","drugs","drunk",
  "dryer","dying","eager","eagle","early","earth","eight","elect","elite","embed",
  "ember","empty","ended","enemy","enjoy","enter","entry","equal","equip","erase",
  "error","essay","ethic","event","every","exact","exist","extra","fable",
  "facet","fairy","faith","false","fancy","fatal","fault","feast","fence",
  "fetch","fever","fiber","field","fifty","fight","filed","final","first","fixed",
  "flame","flash","fleet","flesh","float","flood","floor","flour","fluid","flush",
  "flute","focus","force","forge","forth","forum","found","frame","frank","fraud",
  "fresh","front","froze","fruit","funds","funny","genre","ghost","giant","given",
  "glare","glass","globe","gloom","glory","glove","going","grace","grade","grain",
  "grand","grant","graph","grasp","grass","grave","great","green","greet","grief",
  "grill","grind","groan","gross","group","grove","grown","guard","guess","guest",
  "guide","guilt","guise","happy","harsh","haven","heard","heart","heavy",
  "hedge","hello","hence","herbs","hobby","honor","horse","hotel","house",
  "human","humor","hurry","hyper","ideal","image","imply","inbox","index","indie",
  "inner","input","intro","irony","ivory","jeans","jewel","joint","joker","jolly",
  "judge","juice","juicy","jumbo","jumps","karma","kayak","knack","kneel","knife",
  "knock","known","label","labor","lance","large","laser","later","laugh","layer",
  "leads","learn","lease","least","leave","legal","lemon","level","light","limit",
  "linen","liver","local","lodge","logic","login","looks","loose","lorry","lover",
  "lower","loyal","lucky","lunch","lying","magic","major","maker","manga","manor",
  "maple","march","marry","mason","match","maybe","mayor","meant","medal","media",
  "melon","mercy","merge","merit","metal","meter","might","minor","minus","mixed",
  "model","money","month","moral","motor","mount","mouse","mouth","moved","movie",
  "music","nasty","naval","nerve","never","newer","newly","night","noble","noise",
  "north","noted","novel","nurse","nylon","occur","ocean","olive","onset","opera",
  "orbit","order","organ","other","ought","outer","owned","owner","oxide","ozone",
  "paint","panel","panic","paper","paste","patch","pause","peace","peach","pearl",
  "penny","perch","phase","phone","photo","piano","piece","pilot","pinch","pixel",
  "pizza","place","plain","plane","plant","plate","plaza","plead","plumb","plume",
  "plush","point","polar","polls","pouch","pound","power","press","price",
  "pride","prime","print","prior","prize","probe","prone","proof","prose","proud",
  "prove","proxy","psalm","pulse","punch","pupil","purse","queen","query","quest",
  "queue","quick","quiet","quota","quote","radar","radio","raise","rally","ranch",
  "range","rapid","ratio","reach","react","realm","rebel","refer","reign","relax",
  "relay","renew","reply","resin","rider","ridge","rifle","rigid","risen","risky",
  "rival","river","robin","robot","rocky","rouge","rough","round","route","royal",
  "rugby","ruins","ruler","rural","sadly","saint","salad","sauce","scale","scare",
  "scene","scent","scope","score","scout","scrap","seize","sense","serve","setup",
  "seven","shade","shake","shall","shame","shape","share","shark","sharp","sheep",
  "sheer","sheet","shelf","shell","shift","shine","shirt","shock","shoot","shore",
  "shout","shown","sight","silly","since","sixth","sixty","sized","skill","skull",
  "slash","slate","slave","sleep","slide","slope","small","smart","smell","smile",
  "smoke","snake","solar","solid","solve","sorry","south","space","spare","spark",
  "speak","speed","spell","spend","spent","spice","spine","spite","split","spoke",
  "spoon","sport","spray","squad","stack","staff","stage","stain","stake","stale",
  "stall","stamp","stand","stare","stark","start","state","stave","stays","steak",
  "steal","steam","steel","steep","steer","stern","stick","stiff","still","stock",
  "stone","stood","store","storm","story","stove","strap","straw","stray","strip",
  "stuck","study","stuff","stump","style","sugar","suite","super","surge","swamp",
  "swear","sweep","sweet","swept","swift","swing","sword","swore","sworn","swung",
  "table","taste","teach","teeth","tempo","tends","tenth","terms","theme","there",
  "thick","thing","think","third","thorn","those","three","threw","throw","thumb",
  "tiger","tight","timer","tired","title","today","token","total","touch","tough",
  "towel","tower","toxic","trace","track","trade","trail","train","trait","trash",
  "treat","trend","trial","tribe","trick","tried","troop","truck","truly","trump",
  "trunk","trust","truth","tumor","tuner","twice","twist","ultra","uncle","under",
  "unify","union","unite","unity","until","upper","upset","urban","usage","usual",
  "utter","valid","value","valve","vapor","vault","venue","verse","vigor","vinyl",
  "viral","virus","visit","vital","vivid","vocal","vodka","voice","voter","waist",
  "waste","watch","water","weary","weave","wedge","weigh","weird","whale","wheat",
  "wheel","where","which","while","white","whole","whose","wider","widow","width",
  "witch","woman","women","world","worry","worse","worst","worth","would","wound",
  "wreck","write","wrong","wrote","yacht","young","youth","zebra","zones",
];

// Lower-cased, deduped, exactly WORD_LENGTH. Frozen so callers can't mutate it.
export const ANSWERS = Object.freeze([
  ...new Set(
    ANSWER_WORDS.map((w) => w.toLowerCase().trim()).filter((w) => w.length === WORD_LENGTH),
  ),
]);

// Casual rule (matches the duel): any 5-letter alphabetic string is a legal guess.
export const GUESS_RE = /^[a-z]{5}$/;

export function normalizeGuess(raw) {
  return typeof raw === "string" ? raw.toLowerCase().trim() : "";
}

/**
 * Grade a guess against the answer.
 * @returns {("correct"|"present"|"absent")[]} one entry per letter.
 */
export function gradeGuess(guess, answer) {
  const result = Array(WORD_LENGTH).fill("absent");
  const answerChars = answer.split("");
  const guessChars  = guess.split("");
  const used = Array(WORD_LENGTH).fill(false);

  // Pass 1: correct (green)
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guessChars[i] === answerChars[i]) {
      result[i] = "correct";
      used[i] = true;
    }
  }
  // Pass 2: present (yellow)
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i] === "correct") continue;
    for (let j = 0; j < WORD_LENGTH; j++) {
      if (!used[j] && guessChars[i] === answerChars[j]) {
        result[i] = "present";
        used[j] = true;
        break;
      }
    }
  }
  return result;
}
