/**
 * KHMER ROMANIZATION MODULE — BGN/PCGN Standard
 * Handles Khmer → Latin and Latin → Khmer transliteration with
 * coeng handling, series 1 & 2 consonant/vowel registers, and overrides.
 */

'use strict';

// === Khmer consonant → Latin ===
const CONSONANT_TO_LATIN = {
  "ក": "k", "គ": "k", "ខ": "kh", "ឃ": "kh",
  "ង": "ng", "ច": "ch", "ជ": "ch", "ឆ": "chh", "ឈ": "chh",
  "ញ": "nh", "ដ": "d", "ឌ": "d", "ណ": "n", "ន": "n",
  "ត": "t", "ទ": "t", "ឋ": "th", "ថ": "th", "ធ": "th",
  "ប": "b", "ព": "p", "ផ": "ph", "ភ": "ph",
  "ម": "m", "យ": "y", "រ": "r", "ឡ": "l", "ល": "l",
  "វ": "v", "ស": "s", "ហ": "h", "អ": "",
};

const SERIES_2_CONSONANTS = new Set([
  "គ", "ឃ", "ង", "ជ", "ឈ", "ញ", "ឌ", "ឍ", "ន",
  "ទ", "ធ", "ព", "ភ", "ម", "យ", "រ", "ល", "វ",
]);

const INDEPENDENT_VOWELS = {
  "ឥ": "e", "ឦ": "i", "ឧ": "o", "ឩ": "u", "ឪ": "au",
  "ឫ": "roe", "ឬ": "roe", "ឭ": "loe", "ឮ": "loe",
  "ឯ": "e", "ឱ": "ao", "ឲ": "ao", "ឳ": "au",
};

const VOWEL_SERIES_1 = {
  "ា": "a", "ិ": "e", "ី": "ei", "ឹ": "oe", "ឺ": "oe",
  "ុ": "o", "ូ": "o", "ួ": "uo", "ើ": "aeu", "ឿ": "oea",
  "ៀ": "ie", "េ": "e", "ែ": "e", "ៃ": "ai", "ោ": "ao", "ៅ": "au",
};

const VOWEL_SERIES_2 = {
  "ា": "ea", "ិ": "i", "ី": "i", "ឹ": "oe", "ឺ": "oe",
  "ុ": "u", "ូ": "u", "ួ": "uo", "ើ": "eu", "ឿ": "oea",
  "ៀ": "ie", "េ": "e", "ែ": "e", "ៃ": "ey", "ោ": "o", "ៅ": "ou",
};

// === Latin consonant → Khmer with Register Support ===
const CONSONANT_REGISTER_MAP = {
  "chh": { s1: "ឆ", s2: "ឈ" },
  "ch": { s1: "ច", s2: "ជ" },
  "kh": { s1: "ខ", s2: "ឃ" },
  "th": { s1: "ថ", s2: "ធ" },
  "ph": { s1: "ផ", s2: "ភ" },
  "ng": { s1: "ង", s2: "ង" },
  "nh": { s1: "ញ", s2: "ញ" },
  "k": { s1: "ក", s2: "គ" },
  "d": { s1: "ដ", s2: "ឌ" },
  "n": { s1: "ណ", s2: "ន" },
  "t": { s1: "ត", s2: "ទ" },
  "b": { s1: "ប", s2: "ព" },
  "p": { s1: "ប", s2: "ព" },
  "m": { s1: "ម", s2: "ម" },
  "y": { s1: "យ", s2: "យ" },
  "r": { s1: "រ", s2: "រ" },
  "l": { s1: "ឡ", s2: "ល" },
  "v": { s1: "វ", s2: "វ" },
  "w": { s1: "វ", s2: "វ" },
  "s": { s1: "ស", s2: "ស" },
  "h": { s1: "ហ", s2: "ហ" },
  "j": { s1: "ច", s2: "ជ" },
  "q": { s1: "អ", s2: "អ" },
};

const VOWEL_REGISTER_MAP = {
  "aeu": { s1: "ើ", s2: "ើ", register: 1 },
  "oea": { s1: "ឿ", s2: "ឿ", register: 0 },
  "eah": { s1: "ះ", s2: "ះ", register: 2 },
  "aoh": { s1: "ោះ", s2: "ោះ", register: 1 },
  "ea": { s1: "ៀ", s2: "ា", register: 2 },
  "ei": { s1: "ី", s2: "ី", register: 1 },
  "ee": { s1: "ី", s2: "ី", register: 0 },
  "ii": { s1: "ី", s2: "ី", register: 0 },
  "ae": { s1: "ែ", s2: "ែ", register: 1 },
  "ai": { s1: "ៃ", s2: "ៃ", register: 1 },
  "ay": { s1: "ៃ", s2: "ៃ", register: 1 },
  "ey": { s1: "ៃ", s2: "ៃ", register: 2 },
  "ao": { s1: "ោ", s2: "ោ", register: 1 },
  "aw": { s1: "ៅ", s2: "ៅ", register: 1 },
  "au": { s1: "ៅ", s2: "ៅ", register: 1 },
  "ou": { s1: "ៅ", s2: "ៅ", register: 2 },
  "oo": { s1: "ូ", s2: "ូ", register: 0 },
  "uu": { s1: "ូ", s2: "ូ", register: 0 },
  "uo": { s1: "ួ", s2: "ួ", register: 0 },
  "ie": { s1: "ៀ", s2: "ៀ", register: 0 },
  "eu": { s1: "ើ", s2: "ើ", register: 2 },
  "oe": { s1: "ឹ", s2: "ឹ", register: 0 },
  "ah": { s1: "ះ", s2: "ះ", register: 1 },
  "oh": { s1: "ុះ", s2: "ោះ", register: 1 },
  "uh": { s1: "ុះ", s2: "ុះ", register: 2 },
  "eh": { s1: "េះ", s2: "េះ", register: 0 },
  "am": { s1: "ំ", s2: "ំ", register: 1 },
  "um": { s1: "ំ", s2: "ំ", register: 2 },
  "om": { s1: "ុំ", s2: "ុំ", register: 1 },
  "a": { s1: "ា", s2: "ា", register: 1 },
  "i": { s1: "ិ", s2: "ី", register: 2 },
  "e": { s1: "េ", s2: "េ", register: 1 },
  "o": { s1: "ុ", s2: "ុ", register: 2 },
  "u": { s1: "ុ", s2: "ុ", register: 2 },
};

const CONSONANT_KEYS = Object.keys(CONSONANT_REGISTER_MAP).sort((a, b) => b.length - a.length);
const VOWEL_KEYS = Object.keys(VOWEL_REGISTER_MAP).sort((a, b) => b.length - a.length);

// Default general-purpose overrides (accurate standard terms)
const DEFAULT_KH_OVERRIDES = {
  "អរគុណ": "arkun",
  "សួស្តី": "sousdey",
  "ភ្នំពេញ": "phnom penh",
  "បន្ទាយមានជ័យ": "banteay meanchey",
  "មង្គលបូរី": "mongkol borei",
  "ប៉ោយប៉ែត": "poipet",
  "សិរីសោភ័ណ": "serei saophoan",
  "បាត់ដំបង": "battambang",
  "កំពង់ចាម": "kampong cham",
  "កំពង់ឆ្នាំង": "kampong chhnang",
  "កំពង់ស្ពឺ": "kampong speu",
  "កំពង់ធំ": "kampong thom",
  "កំពត": "kampot",
  "កណ្ដាល": "kandal",
  "កែប": "kep",
  "ក្រចេះ": "kratie",
  "មណ្ឌលគិរី": "mondulkiri",
  "ព្រះវិហារ": "preah vihear",
  "ព្រៃវែង": "prey veng",
  "ពោធិ៍សាត់": "pursat",
  "រតនគិរី": "ratanakiri",
  "សៀមរាប": "siem reap",
  "ព្រះសីហនុ": "sihanoukville",
  "ស្ទឹងត្រែង": "stung treng",
  "ស្វាយរៀង": "svay rieng",
  "តាកែវ": "takeo",
  "ត្បូងឃ្មុំ": "tboung khmum",
  "ផ្សារ": "phsar",
  "ផ្សារធំថ្មី": "phsar thmei",
  "ផ្សារអូឡាំពិក": "olympic market",
  "ផ្សារទួលទំពូង": "russian market",
};

const DEFAULT_LATIN_OVERRIDES = {
  "arkun": "អរគុណ",
  "sousdey": "សួស្តី",
  "ortkun": "អរគុណ",
  "kampuchea": "កម្ពុជា",
  "phnompenh": "ភ្នំពេញ",
  "phnumpenh": "ភ្នំពេញ",
  "phnom penh": "ភ្នំពេញ",
  "phnum penh": "ភ្នំពេញ",
  "poipet": "ប៉ោយប៉ែត",
  "siem reap": "សៀមរាប",
  "battambang": "បាត់ដំបង",
};

function capitalize(text, options = {}) {
  if (options.keepCase) return text;
  return text
    .split(" ")
    .map((w) => (w.length === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}

/**
 * Khmer → Latin transliteration
 */
function khmerToLatin(khmerText, overrides, options = {}) {
  if (!khmerText || typeof khmerText !== "string") return "";
  const allOverrides = { ...DEFAULT_KH_OVERRIDES, ...overrides };

  let processedText = khmerText;
  const overrideKeys = Object.keys(allOverrides).sort((a, b) => b.length - a.length);
  
  for (const key of overrideKeys) {
    processedText = processedText.split(key).join(" " + allOverrides[key] + " ");
  }

  return capitalize(
    processedText.split(" ").filter((w) => w.length > 0).map((word) => {
      if (!/[\u1780-\u17FF]/.test(word)) return word;
      return transliterateKhmerWord(word);
    }).join(" "),
    options
  );
}

function transliterateKhmerWord(word) {
  let result = "";
  const chars = Array.from(word);
  let i = 0;

  while (i < chars.length) {
    const ch = chars[i];

    if (INDEPENDENT_VOWELS[ch]) { result += INDEPENDENT_VOWELS[ch]; i++; continue; }

    if (CONSONANT_TO_LATIN[ch] !== undefined) {
      let isSeries2 = SERIES_2_CONSONANTS.has(ch);
      if (i + 1 < chars.length) {
        if (chars[i + 1] === "៊") { isSeries2 = true; i++; }
        else if (chars[i + 1] === "៉") { isSeries2 = false; i++; }
      }

      result += CONSONANT_TO_LATIN[ch];
      i++;

      if (i < chars.length && chars[i] === "្") {
        i++;
        if (i < chars.length && CONSONANT_TO_LATIN[chars[i]]) {
          const sub = chars[i];
          result += CONSONANT_TO_LATIN[sub];
          if (SERIES_2_CONSONANTS.has(sub)) isSeries2 = true;
          i++;
        }
      }

      let hasVowel = false;
      let hasBantak = false;
      while (i < chars.length) {
        const vch = chars[i];
        const vowelMap = isSeries2 ? VOWEL_SERIES_2 : VOWEL_SERIES_1;
        if (vowelMap[vch]) { result += vowelMap[vch]; hasVowel = true; i++; continue; }
        
        if (vch === "ំ") {
          result += hasVowel ? "m" : (isSeries2 ? "um" : "am");
          hasVowel = true;
          i++;
          continue;
        }

        if (vch === "ះ") {
          result += hasVowel ? "h" : (isSeries2 ? "eah" : "ah");
          hasVowel = true;
          i++;
          continue;
        }
        
        if (vch === "់") { hasBantak = true; i++; continue; }
        if (CONSONANT_TO_LATIN[vch] !== undefined || vch === "្" || INDEPENDENT_VOWELS[vch]) break;
        i++;
      }

      if (!hasVowel && !hasBantak && i < chars.length &&
          (CONSONANT_TO_LATIN[chars[i]] !== undefined || INDEPENDENT_VOWELS[chars[i]])) {
        result += isSeries2 ? "o" : "a";
      }
      continue;
    }

    if (ch !== "\u200B" && ch !== "\u200C") result += ch;
    i++;
  }

  return result;
}

/**
 * Latin → Khmer transliteration
 */
function latinToKhmer(latinText, overrides) {
  if (!latinText || typeof latinText !== "string") return "";
  const allOverrides = { ...DEFAULT_LATIN_OVERRIDES, ...overrides };
  const lowerOverrides = {};
  for (const [k, v] of Object.entries(allOverrides)) lowerOverrides[k.toLowerCase()] = v;

  let processedText = latinText.toLowerCase();
  const overrideKeys = Object.keys(lowerOverrides).sort((a, b) => b.length - a.length);
  
  for (const key of overrideKeys) {
    if (key.includes(" ")) {
      const regex = new RegExp(`\\b${key}\\b`, 'g');
      processedText = processedText.replace(regex, lowerOverrides[key]);
    }
  }

  return processedText.split(" ").filter((w) => w.length > 0).map((word) => {
    if (/[\u1780-\u17FF]/.test(word)) return word;
    return lowerOverrides[word] || transliterateLatinWord(word);
  }).join(" ");
}

function transliterateLatinWord(word) {
  let result = "";
  let i = 0;
  let lastWasConsonant = false;
  let hasVowelInSyllable = false;
  let hasAnyConsonant = false;

  function peekRegister(startIndex) {
    let index = startIndex;
    while (index < word.length) {
      let foundConsonant = false;
      for (const ck of CONSONANT_KEYS) {
        if (word.substring(index, index + ck.length) === ck) {
          index += ck.length;
          foundConsonant = true;
          break;
        }
      }
      if (!foundConsonant) break;
    }
    
    for (const vk of VOWEL_KEYS) {
      if (word.substring(index, index + vk.length) === vk) {
        const vInfo = VOWEL_REGISTER_MAP[vk];
        if (vInfo.register === 1) return 1;
        if (vInfo.register === 2) return 2;
      }
    }
    return 1;
  }

  while (i < word.length) {
    let matched = false;
    for (const ck of CONSONANT_KEYS) {
      if (word.substring(i, i + ck.length) === ck) {
        const reg = peekRegister(i);
        const mappedConsonant = reg === 2 ? CONSONANT_REGISTER_MAP[ck].s2 : CONSONANT_REGISTER_MAP[ck].s1;

        if (lastWasConsonant && !hasVowelInSyllable && hasAnyConsonant) {
          result += "្";
        }
        result += mappedConsonant;
        lastWasConsonant = true;
        hasAnyConsonant = true;
        if (hasVowelInSyllable) hasVowelInSyllable = false;
        
        i += ck.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    for (const vk of VOWEL_KEYS) {
      if (word.substring(i, i + vk.length) === vk) {
        const vInfo = VOWEL_REGISTER_MAP[vk];
        const reg = vInfo.register === 2 ? 2 : 1;
        
        if (!hasAnyConsonant || (!lastWasConsonant && !hasVowelInSyllable)) {
          result += "អ";
          hasAnyConsonant = true;
        }
        
        result += reg === 2 ? vInfo.s2 : vInfo.s1;
        lastWasConsonant = false;
        hasVowelInSyllable = true;
        i += vk.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    if (word[i] === "m" && i === word.length - 1 && hasAnyConsonant) {
      result += "ំ";
      i++;
      continue;
    }

    if (word[i] === "h" && i === word.length - 1 && !lastWasConsonant && hasVowelInSyllable) {
      result += "ះ";
      i++;
      continue;
    }

    lastWasConsonant = false;
    i++;
  }

  return result;
}

module.exports = {
  khmerToLatin,
  latinToKhmer
};
