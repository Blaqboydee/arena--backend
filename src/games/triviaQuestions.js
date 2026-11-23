/**
 * triviaQuestions.js
 * The built-in Trivia Royale question bank, organized into named packs.
 *
 * Single source of truth: the server owns the questions (so every player gets the
 * same bank, and hosts never need to paste anything). The lobby fetches pack
 * metadata via /api/trivia/packs. Each question is { q, options[4], answer:0-3 }.
 */

// ── General Knowledge (broad, approachable — the party default) ────────────────
const GENERAL = [
  { q: "How many continents are there on Earth?", options: ["5", "6", "7", "8"], answer: 2 },
  { q: "Which is the largest planet in our solar system?", options: ["Saturn", "Jupiter", "Neptune", "Earth"], answer: 1 },
  { q: "Who wrote the play 'Hamlet'?", options: ["Charles Dickens", "Leo Tolstoy", "William Shakespeare", "Mark Twain"], answer: 2 },
  { q: "What is the largest country in the world by land area?", options: ["Russia", "Canada", "China", "USA"], answer: 0 },
  { q: "How many legs does a spider have?", options: ["6", "8", "10", "12"], answer: 1 },
  { q: "Which sea creature has three hearts?", options: ["Shark", "Dolphin", "Octopus", "Jellyfish"], answer: 2 },
  { q: "In which country would you find the ancient city of Petra?", options: ["Egypt", "Greece", "Italy", "Jordan"], answer: 3 },
  { q: "What is the main ingredient in guacamole?", options: ["Avocado", "Tomato", "Pea", "Cucumber"], answer: 0 },
  { q: "How often are the Summer Olympic Games held?", options: ["Every 2 years", "Every 4 years", "Every 5 years", "Every year"], answer: 1 },
  { q: "Which metal is liquid at room temperature?", options: ["Aluminium", "Iron", "Mercury", "Copper"], answer: 2 },
  { q: "Who painted 'The Starry Night'?", options: ["Pablo Picasso", "Claude Monet", "Salvador Dalí", "Vincent van Gogh"], answer: 3 },
  { q: "What is the fastest land animal?", options: ["Cheetah", "Lion", "Horse", "Greyhound"], answer: 0 },
  { q: "Which country gifted the Statue of Liberty to the USA?", options: ["Britain", "France", "Spain", "Italy"], answer: 1 },
  { q: "How many colours are there in a rainbow?", options: ["5", "6", "7", "9"], answer: 2 },
  { q: "What is the currency used in the United Kingdom?", options: ["Euro", "Dollar", "Franc", "Pound Sterling"], answer: 3 },
  { q: "What is the smallest country in the world?", options: ["Monaco", "Vatican City", "Malta", "San Marino"], answer: 1 },
  { q: "Which gas do humans need to breathe to survive?", options: ["Oxygen", "Nitrogen", "Carbon Dioxide", "Hydrogen"], answer: 0 },
  { q: "How many players are on a standard soccer team on the field?", options: ["9", "10", "11", "12"], answer: 2 },
  { q: "Which planet is closest to the Sun?", options: ["Venus", "Earth", "Mars", "Mercury"], answer: 3 },
  { q: "What is the longest river in the world?", options: ["Nile", "Amazon", "Yangtze", "Mississippi"], answer: 0 },
  { q: "Which instrument has 88 keys?", options: ["Guitar", "Piano", "Violin", "Flute"], answer: 1 },
  { q: "What is the tallest animal in the world?", options: ["Elephant", "Horse", "Giraffe", "Camel"], answer: 2 },
  { q: "In which country did the Olympic Games originate?", options: ["Italy", "Egypt", "China", "Greece"], answer: 3 },
  { q: "What is frozen water called?", options: ["Ice", "Steam", "Snowflake", "Vapor"], answer: 0 },
  { q: "Which organ is responsible for pumping blood?", options: ["Liver", "Heart", "Lungs", "Kidney"], answer: 1 },
  { q: "How many sides does a triangle have?", options: ["2", "4", "3", "5"], answer: 2 },
  { q: "Which ocean is the largest?", options: ["Atlantic", "Indian", "Arctic", "Pacific"], answer: 3 },
  { q: "What do bees collect from flowers to make honey?", options: ["Nectar", "Pollen", "Water", "Sap"], answer: 0 },
  { q: "Which country is home to the kangaroo?", options: ["South Africa", "Australia", "Brazil", "India"], answer: 1 },
  { q: "How many days are there in a leap year?", options: ["364", "365", "366", "367"], answer: 2 },
  { q: "What is the capital city of Japan?", options: ["Tokyo", "Kyoto", "Osaka", "Seoul"], answer: 0 },
  { q: "Which animal is known as the 'King of the Jungle'?", options: ["Tiger", "Lion", "Elephant", "Gorilla"], answer: 1 },
  { q: "How many strings does a standard violin have?", options: ["3", "5", "4", "6"], answer: 2 },
  { q: "What is the hardest naturally occurring substance?", options: ["Gold", "Iron", "Quartz", "Diamond"], answer: 3 },
  { q: "Which fruit is traditionally used to make wine?", options: ["Grapes", "Apples", "Berries", "Plums"], answer: 0 },
  { q: "On which continent is the Sahara Desert located?", options: ["Asia", "Africa", "Australia", "South America"], answer: 1 },
  { q: "How many minutes are in one hour?", options: ["30", "45", "60", "90"], answer: 2 },
  { q: "Which famous scientist developed the theory of relativity?", options: ["Isaac Newton", "Galileo Galilei", "Nikola Tesla", "Albert Einstein"], answer: 3 },
  { q: "What is the largest mammal in the world?", options: ["Blue whale", "Elephant", "Giraffe", "Hippopotamus"], answer: 0 },
  { q: "Which country is famous for building the pyramids of Giza?", options: ["Greece", "Egypt", "Mexico", "Iraq"], answer: 1 },
  { q: "What colour do you get by mixing blue and yellow?", options: ["Purple", "Orange", "Green", "Brown"], answer: 2 },
  { q: "How many planets are in our solar system?", options: ["7", "9", "10", "8"], answer: 3 },
  { q: "What is the main language spoken in Mexico?", options: ["Spanish", "Portuguese", "French", "English"], answer: 0 },
  { q: "Which bird is famous for being unable to fly and native to Antarctica?", options: ["Ostrich", "Penguin", "Emu", "Kiwi"], answer: 1 },
  { q: "How many zeros are there in one thousand?", options: ["1", "2", "3", "4"], answer: 2 },
  { q: "What is the capital of Canada?", options: ["Ottawa", "Toronto", "Vancouver", "Montreal"], answer: 0 },
  { q: "Which planet is known as the 'Red Planet'?", options: ["Venus", "Mars", "Jupiter", "Mercury"], answer: 1 },
  { q: "How many teeth does a typical adult human have?", options: ["28", "30", "32", "34"], answer: 2 },
  { q: "Which is the smallest ocean in the world?", options: ["Indian", "Atlantic", "Pacific", "Arctic"], answer: 3 },
  { q: "What is a baby kangaroo called?", options: ["Joey", "Cub", "Kit", "Calf"], answer: 0 },
  { q: "Which country has the Eiffel Tower?", options: ["Italy", "France", "Spain", "Belgium"], answer: 1 },
  { q: "What is the chemical symbol for water?", options: ["O2", "CO2", "H2O", "NaCl"], answer: 2 },
  { q: "Who is known as the 'Father of the Computer'?", options: ["Albert Einstein", "Thomas Edison", "Isaac Newton", "Charles Babbage"], answer: 3 },
  { q: "How many wonders are there in the 'Seven Wonders of the World'?", options: ["7", "8", "9", "10"], answer: 0 },
  { q: "Which large land animal has a trunk?", options: ["Rhino", "Elephant", "Hippo", "Buffalo"], answer: 1 },
  { q: "What is the freezing point of water in Celsius?", options: ["10°C", "5°C", "0°C", "-5°C"], answer: 2 },
  { q: "Which sport uses a shuttlecock?", options: ["Tennis", "Squash", "Table Tennis", "Badminton"], answer: 3 },
  { q: "What do caterpillars turn into?", options: ["Butterflies", "Beetles", "Spiders", "Bees"], answer: 0 },
  { q: "Which country is shaped like a boot?", options: ["Spain", "Italy", "Greece", "Portugal"], answer: 1 },
  { q: "How many months have exactly 31 days?", options: ["5", "6", "7", "8"], answer: 2 },
];

// ── Tech & Digital (design, code, marketing, security, trends) ─────────────────
const TECH = [
  { q: "Which pair of colors are complementary (opposite on the color wheel)?", options: ["Red & Green", "Red & Blue", "Blue & Green", "Yellow & Orange"], answer: 0 },
  { q: "In UX, what does the 'F-pattern' describe?", options: ["A font-pairing rule", "How users scan content on a page", "A 12-column grid", "A button hover state"], answer: 1 },
  { q: "In design, 'white space' (negative space) refers to:", options: ["Only white backgrounds", "Unused color swatches", "The empty space around elements", "Print margins only"], answer: 2 },
  { q: "What does 'API' stand for?", options: ["Application Programming Interface", "Applied Protocol Interface", "Automated Program Input", "Active Process Integration"], answer: 0 },
  { q: "Which data structure works as Last In, First Out (LIFO)?", options: ["Queue", "Stack", "Array", "Linked List"], answer: 1 },
  { q: "In Git, which command creates a new branch AND switches to it?", options: ["git branch", "git merge", "git checkout -b", "git clone"], answer: 2 },
  { q: "What does 'SEO' stand for?", options: ["Search Engine Optimization", "Social Engagement Online", "Search Engine Operations", "Site Enhancement Option"], answer: 0 },
  { q: "In advertising, what does 'CTR' measure?", options: ["Cost To Reach", "Click-Through Rate", "Customer Trust Ranking", "Conversion Tracking Rate"], answer: 1 },
  { q: "A 'conversion' in digital marketing happens when:", options: ["A site is redesigned", "A file format is changed", "A user completes a desired action", "Ad currency is switched"], answer: 2 },
  { q: "What is 'phishing'?", options: ["Tricking people into revealing sensitive info", "Flooding a server with traffic", "Encrypting files for ransom", "Scanning open ports"], answer: 0 },
  { q: "What does '2FA' stand for?", options: ["Two-File Access", "Two-Factor Authentication", "Second Firewall Agent", "Twin Form Authorization"], answer: 1 },
  { q: "A 'DDoS' attack mainly aims to:", options: ["Steal stored passwords", "Inject malicious SQL", "Overwhelm a service with traffic", "Spoof an email sender"], answer: 2 },
  { q: "In AI, what does 'LLM' stand for?", options: ["Large Language Model", "Logical Learning Machine", "Linked List Model", "Low-Latency Memory"], answer: 0 },
  { q: "Which company created ChatGPT?", options: ["Google", "OpenAI", "Meta", "Microsoft"], answer: 1 },
  { q: "'Web3' is primarily associated with:", options: ["3D web graphics", "Faster page loading", "Decentralization and blockchain", "Three-column layouts"], answer: 2 },
  { q: "In typography, what does 'kerning' adjust?", options: ["Spacing between individual letters", "The height of each line", "The weight of the font", "Paragraph alignment"], answer: 0 },
  { q: "Which image format is lossless and supports transparency (ideal for web logos)?", options: ["JPEG", "PNG", "RAW", "TIFF"], answer: 1 },
  { q: "'Responsive design' means a layout that:", options: ["Loads faster than normal", "Uses lots of animation", "Adapts to different screen sizes", "Collects user feedback"], answer: 2 },
  { q: "Which language runs natively inside web browsers?", options: ["Python", "JavaScript", "Java", "C++"], answer: 1 },
  { q: "What does 'HTML' stand for?", options: ["HyperText Markup Language", "High Transfer Markup Logic", "Hyperlink Text Mode Language", "Home Tool Markup Language"], answer: 0 },
  { q: "A 'boolean' value can only be:", options: ["A whole number", "True or false", "A text string", "A list of items"], answer: 1 },
  { q: "What does 'ROI' stand for?", options: ["Rate Of Interaction", "Reach Over Impressions", "Return On Investment", "Revenue On Index"], answer: 2 },
  { q: "What is 'A/B testing'?", options: ["Comparing two versions to see which performs better", "Testing only on Apple devices", "Backing up two servers", "Sorting content alphabetically"], answer: 0 },
  { q: "In web analytics, 'bounce rate' is the percentage of visitors who:", options: ["Click every link on a page", "Leave after viewing only one page", "Return the next day", "Complete a purchase"], answer: 1 },
  { q: "What is 'malware'?", options: ["Software designed to harm or exploit systems", "A type of hardware firewall", "An email client", "A file backup tool"], answer: 0 },
  { q: "What does a 'VPN' primarily do?", options: ["Speeds up your processor", "Blocks all advertisements", "Encrypts your internet connection", "Stores your passwords"], answer: 2 },
  { q: "What is 'ransomware'?", options: ["A free password manager", "Malware that encrypts files and demands payment", "A browser extension", "A firewall setting"], answer: 1 },
  { q: "What does 'IoT' stand for?", options: ["Internet of Things", "Index of Technology", "Input Output Transfer", "Internet of Transactions"], answer: 0 },
  { q: "'Cloud computing' means:", options: ["Weather-prediction software", "Local-only storage", "Delivering computing services over the internet", "A type of CPU chip"], answer: 2 },
  { q: "Which technology underpins cryptocurrencies like Bitcoin?", options: ["Blockchain", "SQL databases", "Bluetooth", "HTML"], answer: 0 },
];

// ── Science & Nature ───────────────────────────────────────────────────────────
const SCIENCE = [
  { q: "What is the chemical symbol for gold?", options: ["Ag", "Fe", "Au", "Cu"], answer: 2 },
  { q: "How many bones are in the adult human body?", options: ["186", "206", "226", "246"], answer: 1 },
  { q: "What is the smallest prime number?", options: ["0", "1", "2", "3"], answer: 2 },
  { q: "Which element has the atomic number 1?", options: ["Helium", "Hydrogen", "Lithium", "Carbon"], answer: 1 },
  { q: "What is the speed of light in km/s (approx)?", options: ["150,000", "300,000", "450,000", "600,000"], answer: 1 },
  { q: "What gas do plants absorb from the atmosphere?", options: ["Oxygen", "Carbon Dioxide", "Nitrogen", "Hydrogen"], answer: 1 },
  { q: "What is the hardest natural substance?", options: ["Gold", "Iron", "Diamond", "Platinum"], answer: 2 },
  { q: "Which planet has the most moons?", options: ["Jupiter", "Saturn", "Uranus", "Neptune"], answer: 1 },
  { q: "What is the boiling point of water in Celsius?", options: ["90°C", "100°C", "110°C", "120°C"], answer: 1 },
  { q: "Which organ pumps blood through the body?", options: ["Brain", "Heart", "Lungs", "Liver"], answer: 1 },
  { q: "How many sides does a hexagon have?", options: ["5", "6", "7", "8"], answer: 1 },
  { q: "What does DNA stand for?", options: ["Deoxyribonucleic Acid", "Dinitrogen Acid", "Dynamic Neural Array", "Dense Nucleic Acid"], answer: 0 },
  { q: "How many teeth does an adult human have?", options: ["28", "30", "32", "34"], answer: 2 },
  { q: "What is the square root of 144?", options: ["10", "11", "12", "13"], answer: 2 },
  { q: "Which gas makes up most of Earth's atmosphere?", options: ["Oxygen", "Carbon Dioxide", "Nitrogen", "Argon"], answer: 2 },
  { q: "How many minutes are in a day?", options: ["1240", "1340", "1440", "1540"], answer: 2 },
  { q: "What vitamin does the sun provide?", options: ["A", "B", "C", "D"], answer: 3 },
  { q: "Which animal can fly backwards?", options: ["Eagle", "Hummingbird", "Bat", "Parrot"], answer: 1 },
  { q: "What is the largest organ in the human body?", options: ["Liver", "Brain", "Skin", "Heart"], answer: 2 },
  { q: "How many zeros are in a million?", options: ["5", "6", "7", "8"], answer: 1 },
];

// ── Geography & World ──────────────────────────────────────────────────────────
const GEOGRAPHY = [
  { q: "Which country has the most natural lakes?", options: ["USA", "Russia", "Canada", "Brazil"], answer: 2 },
  { q: "What is the largest ocean on Earth?", options: ["Atlantic", "Indian", "Pacific", "Arctic"], answer: 2 },
  { q: "How many continents are there?", options: ["5", "6", "7", "8"], answer: 2 },
  { q: "What is the currency of Japan?", options: ["Yuan", "Won", "Yen", "Peso"], answer: 2 },
  { q: "What is the tallest mountain in the world?", options: ["K2", "Everest", "Kangchenjunga", "Lhotse"], answer: 1 },
  { q: "Which is the longest river in the world?", options: ["Amazon", "Nile", "Mississippi", "Yangtze"], answer: 1 },
  { q: "What is the main language spoken in Brazil?", options: ["Spanish", "Portuguese", "French", "English"], answer: 1 },
  { q: "What is the capital of Australia?", options: ["Sydney", "Melbourne", "Canberra", "Perth"], answer: 2 },
  { q: "Which country has the largest population?", options: ["USA", "India", "China", "Indonesia"], answer: 1 },
];

// ── History & Culture ──────────────────────────────────────────────────────────
const CULTURE = [
  { q: "What year did the Berlin Wall fall?", options: ["1987", "1989", "1991", "1993"], answer: 1 },
  { q: "Who painted the Mona Lisa?", options: ["Michelangelo", "Da Vinci", "Raphael", "Donatello"], answer: 1 },
  { q: "In what year did World War I begin?", options: ["1912", "1914", "1916", "1918"], answer: 1 },
  { q: "Who wrote 'Romeo and Juliet'?", options: ["Dickens", "Shakespeare", "Austen", "Hemingway"], answer: 1 },
  { q: "Which country invented pizza?", options: ["Greece", "Italy", "France", "Spain"], answer: 1 },
  { q: "What color is a ruby?", options: ["Blue", "Green", "Red", "Yellow"], answer: 2 },
  { q: "How many strings does a standard guitar have?", options: ["4", "5", "6", "7"], answer: 2 },
  { q: "What creature is known as 'man's best friend'?", options: ["Cat", "Dog", "Horse", "Parrot"], answer: 1 },
  { q: "What year was the first iPhone released?", options: ["2005", "2006", "2007", "2008"], answer: 2 },
];

// ── Packs ─────────────────────────────────────────────────────────────────────

export const PACKS = [
  { id: "general",   label: "General Knowledge", icon: "🌍", questions: GENERAL },
  { id: "tech",      label: "Tech & Digital",    icon: "💻", questions: TECH },
  { id: "science",   label: "Science & Nature",  icon: "🔬", questions: SCIENCE },
  { id: "geography", label: "Geography & World", icon: "🗺️", questions: GEOGRAPHY },
  { id: "culture",   label: "History & Culture", icon: "📜", questions: CULTURE },
];

// Everything, for the "mixed" / random mode and cross-pack supplementation.
const ALL = PACKS.flatMap((p) => p.questions);

// Lightweight pack metadata for the lobby (no answers leaked).
export const PACK_META = PACKS.map((p) => ({
  id: p.id, label: p.label, icon: p.icon, count: p.questions.length,
}));

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** `count` random questions from a pack, topped up from the full bank if short. */
export function questionsForPack(id, count) {
  const pack = PACKS.find((p) => p.id === id);
  const pool = pack ? pack.questions : ALL;
  const picked = shuffle(pool).slice(0, count);
  if (picked.length < count) {
    const have = new Set(picked);
    const extra = shuffle(ALL.filter((q) => !have.has(q))).slice(0, count - picked.length);
    return [...picked, ...extra];
  }
  return picked;
}

/** `count` random questions across every pack. */
export function randomMix(count) {
  return shuffle(ALL).slice(0, count);
}
