const fs = require('fs');
const routes = JSON.parse(fs.readFileSync('data/routes.json', 'utf-8'));
const keywords = [
  'Phsar Thmei', 'Central Market', 'Russian Market', 'Tuol Tom Poung', 'Orussey Market', 'Olympic Market', 'Phnom Penh Night Market',
  'Old Market', 'Psar Chas', 'Phsar Leu Thom Thmey', 'Angkor Night Market', 'Made in Cambodia Market',
  'Phsar Nath', 'Psar Nat', 'Boeung Chhouk Market', 'Battambang Night Market',
  'Phsar Leu Sihanoukville', 'Phsar Krom', 'Sihanoukville Market',
  'Phsar Samaki', 'Kampot Market', 'Kampot Night Market',
  'Kep Crab Market', 'Phsar Kdam', 'Kep Market',
  'Takhmao Market', 'Phsar Takhmao', 'Kien Svay Market', 'Arey Ksat Market',
  'Kampong Cham Market', 'Phsar Thom Kampong Cham', 'Skun Market',
  'Suong Market', 'Phsar Suong', 'Memot Market', 'Tboung Khmum Market',
  'Takeo Market', 'Phsar Takeo', 'Ang Ta Som Market', 'Kirivong Market',
  'Prey Veng Market', 'Phsar Prey Veng', 'Neak Leung Market',
  'Svay Rieng Market', 'Psar Nat Svay Rieng', 'Bavet Market',
  'Kampong Speu Market', 'Chbar Mon Market', 'Phsar Chbar Mon',
  'Kampong Chhnang Market', 'Phsar Leu Kampong Chhnang',
  'Kampong Thom Market', 'Phsar Kampong Thom', 'Stoung Market',
  'Pursat Market', 'Phsar Thmey Pursat', 'Krakor Market',
  'Poipet Market', 'Serei Saophoan Market', 'Sisophon Market', 'Rong Kluea Market',
  'Samraong Market', 'Phsar Samraong', 'Anlong Veng Market',
  'Samaki Market', 'Pahi Market', 'Phsar Thmey Pailin', 'Pailin Market',
  'Koh Kong Market', 'Dong Tong Market', 'Phsar Leu Koh Kong',
  'Kratie Central Market', 'Phsar Kratie', 'Kratie Night Market',
  'Stung Treng Market', 'Phsar Samaki Stung Treng',
  'Banlung Market', 'Phsar Banlung', 'Ratanakiri Market',
  'Sen Monorom Market', 'Mondulkiri Market',
  'Tbeng Meanchey Market', 'Preah Vihear Market'
];

keywords.forEach(kw => {
  const normKw = kw.toLowerCase().trim();
  const matches = routes.filter(r => {
    const m = (r.market || '').toLowerCase();
    const mKh = (r.market_kh || '').toLowerCase();
    const p = (r.province || '').toLowerCase();
    const pKh = (r.province_kh || '').toLowerCase();
    
    return m.includes(normKw) || mKh.includes(normKw) || normKw.includes(m) && m.length > 3;
  });
  if (matches.length > 0) {
    console.log(`Keyword: [${kw}] -> found ${matches.length} matches. Top: ${matches[0].market} (${matches[0].province}, id: ${matches[0].id}, coords: ${matches[0].latitude}, ${matches[0].longitude})`);
  } else {
    console.log(`Keyword: [${kw}] -> ❌ NOT FOUND`);
  }
});
