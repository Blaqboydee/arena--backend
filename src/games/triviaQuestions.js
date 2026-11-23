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
  { q: "What is the capital of France?", options: ["Paris", "Lyon", "Marseille", "Nice"], answer: 0 },
  { q: "Which country has the largest land area in Africa?", options: ["Nigeria", "Algeria", "Egypt", "Sudan"], answer: 1 },
  { q: "Off the coast of which country is the Great Barrier Reef?", options: ["Brazil", "Australia", "Mexico", "India"], answer: 1 },
  { q: "Mount Kilimanjaro is located in which country?", options: ["Kenya", "Tanzania", "Uganda", "Ethiopia"], answer: 1 },
  { q: "What is the largest hot desert in the world?", options: ["Gobi", "Kalahari", "Sahara", "Arabian"], answer: 2 },
  { q: "The Nile River empties into which sea?", options: ["Red Sea", "Mediterranean Sea", "Arabian Sea", "Black Sea"], answer: 1 },
  { q: "Which is the smallest continent?", options: ["Europe", "Antarctica", "Australia", "South America"], answer: 2 },
  { q: "What is the capital of Egypt?", options: ["Cairo", "Alexandria", "Giza", "Luxor"], answer: 0 },
  { q: "Which city is split between Europe and Asia?", options: ["Istanbul", "Moscow", "Athens", "Cairo"], answer: 0 },
  { q: "The Amazon rainforest is mostly located in which country?", options: ["Peru", "Colombia", "Brazil", "Venezuela"], answer: 2 },
  { q: "What is the capital of Germany?", options: ["Munich", "Hamburg", "Berlin", "Frankfurt"], answer: 2 },
  { q: "Which ocean lies between Africa and Australia?", options: ["Atlantic", "Pacific", "Indian", "Arctic"], answer: 2 },
  { q: "Mount Everest sits on the border of Nepal and which country?", options: ["India", "China", "Bhutan", "Pakistan"], answer: 1 },
  { q: "What is the capital of Nigeria?", options: ["Lagos", "Abuja", "Kano", "Ibadan"], answer: 1 },
  { q: "Which country is famous for tulips and windmills?", options: ["Belgium", "Netherlands", "Denmark", "Sweden"], answer: 1 },
  { q: "Who was the first President of the United States?", options: ["Abraham Lincoln", "George Washington", "Thomas Jefferson", "John Adams"], answer: 1 },
  { q: "In which year did World War II end?", options: ["1943", "1945", "1947", "1950"], answer: 1 },
  { q: "Which Egyptian queen was linked to Julius Caesar and Mark Antony?", options: ["Nefertiti", "Cleopatra", "Hatshepsut", "Isis"], answer: 1 },
  { q: "The Titanic sank in which year?", options: ["1905", "1912", "1918", "1923"], answer: 1 },
  { q: "Who reached the Americas in 1492?", options: ["Vasco da Gama", "Christopher Columbus", "Ferdinand Magellan", "Marco Polo"], answer: 1 },
  { q: "Who was the UK Prime Minister nicknamed the 'Iron Lady'?", options: ["Theresa May", "Margaret Thatcher", "Queen Elizabeth", "Angela Merkel"], answer: 1 },
  { q: "The ancient Colosseum is located in which city?", options: ["Athens", "Rome", "Cairo", "Istanbul"], answer: 1 },
  { q: "Who led India to independence through non-violent protest?", options: ["Nehru", "Gandhi", "Bose", "Patel"], answer: 1 },
  { q: "Who was the first person to walk on the Moon?", options: ["Buzz Aldrin", "Yuri Gagarin", "Neil Armstrong", "Michael Collins"], answer: 2 },
  { q: "What is the centre of an atom called?", options: ["Electron", "Nucleus", "Proton", "Neutron"], answer: 1 },
  { q: "Which blood type is the universal donor?", options: ["A", "B", "O negative", "AB"], answer: 2 },
  { q: "What is often called the 'powerhouse of the cell'?", options: ["Nucleus", "Mitochondria", "Ribosome", "Membrane"], answer: 1 },
  { q: "How many bones does a shark have?", options: ["0", "50", "100", "206"], answer: 0 },
  { q: "What is the most abundant element in the universe?", options: ["Oxygen", "Helium", "Hydrogen", "Nitrogen"], answer: 2 },
  { q: "Which planet is famous for its prominent ring system?", options: ["Mars", "Saturn", "Venus", "Mercury"], answer: 1 },
  { q: "What do you call animals that eat only plants?", options: ["Carnivores", "Herbivores", "Omnivores", "Insectivores"], answer: 1 },
  { q: "The scientific study of weather is called:", options: ["Geology", "Meteorology", "Astronomy", "Biology"], answer: 1 },
  { q: "Which metal is the best conductor of electricity?", options: ["Gold", "Copper", "Silver", "Iron"], answer: 2 },
  { q: "Which part of a plant carries out most photosynthesis?", options: ["Roots", "Leaves", "Stem", "Flowers"], answer: 1 },
  { q: "What is the largest living reptile?", options: ["Python", "Saltwater Crocodile", "Komodo Dragon", "Anaconda"], answer: 1 },
  { q: "How many rings are on the Olympic flag?", options: ["3", "4", "5", "6"], answer: 2 },
  { q: "In which sport would you perform a 'slam dunk'?", options: ["Football", "Basketball", "Tennis", "Golf"], answer: 1 },
  { q: "The FIFA World Cup is held every how many years?", options: ["2", "3", "4", "5"], answer: 2 },
  { q: "In tennis, what is a score of zero called?", options: ["Nil", "Love", "Duck", "Blank"], answer: 1 },
  { q: "Which country has won the most FIFA World Cups?", options: ["Germany", "Brazil", "Italy", "Argentina"], answer: 1 },
  { q: "In which sport is the term 'birdie' used?", options: ["Golf", "Cricket", "Boxing", "Swimming"], answer: 0 },
  { q: "How many points is a touchdown worth in American football?", options: ["3", "6", "7", "10"], answer: 1 },
  { q: "Who wrote the Harry Potter book series?", options: ["J.R.R. Tolkien", "J.K. Rowling", "Roald Dahl", "C.S. Lewis"], answer: 1 },
  { q: "In the fairy tale, who climbed a giant beanstalk?", options: ["Hansel", "Jack", "Peter", "Jim"], answer: 1 },
  { q: "Who composed the famous 'Fifth Symphony'?", options: ["Mozart", "Beethoven", "Bach", "Chopin"], answer: 1 },
  { q: "What nationality was the painter Pablo Picasso?", options: ["Italian", "Spanish", "French", "Dutch"], answer: 1 },
  { q: "In Greek mythology, who is the king of the gods?", options: ["Zeus", "Poseidon", "Hades", "Apollo"], answer: 0 },
  { q: "Which fruit is said to 'keep the doctor away'?", options: ["Banana", "Apple", "Orange", "Grape"], answer: 1 },
  { q: "What is the main ingredient in bread?", options: ["Flour", "Sugar", "Rice", "Corn"], answer: 0 },
  { q: "Sushi originates from which country?", options: ["China", "Japan", "Korea", "Thailand"], answer: 1 },
  { q: "Which spice is the most expensive by weight?", options: ["Pepper", "Saffron", "Cinnamon", "Vanilla"], answer: 1 },
  { q: "What kind of animal is a Komodo dragon?", options: ["Snake", "Lizard", "Fish", "Bird"], answer: 1 },
  { q: "How many legs does an insect have?", options: ["4", "6", "8", "10"], answer: 1 },
  { q: "What is a group of lions called?", options: ["Pack", "Herd", "Pride", "Flock"], answer: 2 },
  { q: "Which bird is a traditional symbol of peace?", options: ["Eagle", "Dove", "Owl", "Crow"], answer: 1 },
  { q: "What is the fastest bird in the world?", options: ["Eagle", "Peregrine Falcon", "Ostrich", "Hawk"], answer: 1 },
  { q: "What is the largest species of penguin?", options: ["King", "Emperor", "Gentoo", "Rockhopper"], answer: 1 },
  { q: "How many letters are in the English alphabet?", options: ["24", "25", "26", "27"], answer: 2 },
  { q: "What is the Roman numeral for 50?", options: ["L", "C", "D", "X"], answer: 0 },
  { q: "On which planet do humans live?", options: ["Mars", "Venus", "Earth", "Jupiter"], answer: 2 },
  { q: "How many sides does a pentagon have?", options: ["4", "5", "6", "7"], answer: 1 },
  { q: "What is 9 squared (9 × 9)?", options: ["18", "72", "81", "99"], answer: 2 },
  { q: "How many hours are there in two days?", options: ["24", "36", "48", "60"], answer: 2 },
  { q: "What colour are emeralds?", options: ["Red", "Blue", "Green", "Yellow"], answer: 2 },
  { q: "Which weighs more: a kilogram of feathers or a kilogram of steel?", options: ["Feathers", "Steel", "They weigh the same", "It depends"], answer: 2 },
  { q: "What is the capital of Spain?", options: ["Barcelona", "Madrid", "Seville", "Valencia"], answer: 1 },
  { q: "Which planet is the hottest in our solar system?", options: ["Mercury", "Venus", "Mars", "Jupiter"], answer: 1 },
  { q: "What do bees live in?", options: ["Nest", "Hive", "Den", "Burrow"], answer: 1 },
  { q: "Which country is home to the Great Wall?", options: ["Japan", "China", "India", "Mongolia"], answer: 1 },
  { q: "What is the hardest working muscle in the human body?", options: ["Biceps", "Heart", "Tongue", "Jaw"], answer: 1 },
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

/**
 * Draw `count` questions avoiding anything in `used` (a Set of question texts
 * carried on the room, so back-to-back rounds don't repeat). When the eligible
 * pool is exhausted, `used` resets and a fresh cycle begins. Mutates `used`.
 *
 * @param {string|null} packId  pack id, or null/"random" for the whole bank
 * @param {number} count
 * @param {Set<string>} used    question texts already asked this session
 */
export function drawQuestions(packId, count, used) {
  const pack = packId && packId !== "random" ? PACKS.find((p) => p.id === packId) : null;
  const pool = pack ? pack.questions : ALL;

  let eligible = pool.filter((q) => !used.has(q.q));
  if (eligible.length < count) {
    // Exhausted this pack's fresh questions — start the cycle over.
    used.clear();
    eligible = pool;
  }

  const picked = shuffle(eligible).slice(0, count);

  // Top up a small pack from the rest of the bank if it still can't fill a round.
  if (picked.length < count) {
    const have = new Set(picked.map((q) => q.q));
    const extra = shuffle(ALL.filter((q) => !have.has(q.q))).slice(0, count - picked.length);
    picked.push(...extra);
  }

  picked.forEach((q) => used.add(q.q));
  return picked;
}
