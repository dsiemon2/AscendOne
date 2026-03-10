/**
 * holidays.ts
 * Generates major public holidays for a given year and country.
 * Holidays are computed on-the-fly — nothing stored in the DB.
 */

export interface Holiday {
  date: string;   // YYYY-MM-DD
  name: string;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function ymd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Nth weekday of a month. n > 0 = from start, n < 0 = from end. weekday 0=Sun..6=Sat */
function nthWeekday(year: number, month: number, weekday: number, n: number): string {
  if (n > 0) {
    const d = new Date(year, month - 1, 1);
    let count = 0;
    while (count < n) {
      if (d.getDay() === weekday) count++;
      if (count < n) d.setDate(d.getDate() + 1);
    }
    return ymd(year, month, d.getDate());
  } else {
    const d = new Date(year, month, 0); // last day of month
    while (d.getDay() !== weekday) d.setDate(d.getDate() - 1);
    return ymd(year, month, d.getDate());
  }
}

/** Easter Sunday — Anonymous Gregorian algorithm */
function easter(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day   = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function shift(d: Date, days: number): string {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return ymd(r.getFullYear(), r.getMonth() + 1, r.getDate());
}

// ─── Country holiday functions ────────────────────────────────────────────────

function usHolidays(year: number): Holiday[] {
  const e = easter(year);
  return [
    { date: ymd(year, 1, 1),               name: "🎆 New Year's Day" },
    { date: nthWeekday(year, 1, 1, 3),     name: "✊ MLK Day" },
    { date: nthWeekday(year, 2, 1, 3),     name: "🇺🇸 Presidents' Day" },
    { date: shift(e, -2),                  name: "✝️ Good Friday" },
    { date: shift(e, 0),                   name: "🐣 Easter Sunday" },
    { date: nthWeekday(year, 5, 1, -1),   name: "🪖 Memorial Day" },
    { date: ymd(year, 6, 19),              name: "✊ Juneteenth" },
    { date: ymd(year, 7, 4),               name: "🇺🇸 Independence Day" },
    { date: nthWeekday(year, 9, 1, 1),    name: "👷 Labor Day" },
    { date: nthWeekday(year, 10, 1, 2),   name: "⛵ Columbus Day" },
    { date: ymd(year, 10, 31),             name: "🎃 Halloween" },
    { date: ymd(year, 11, 11),             name: "🎖️ Veterans Day" },
    { date: nthWeekday(year, 11, 4, 4),   name: "🦃 Thanksgiving" },
    { date: ymd(year, 12, 24),             name: "🎄 Christmas Eve" },
    { date: ymd(year, 12, 25),             name: "🎄 Christmas Day" },
    { date: ymd(year, 12, 31),             name: "🎆 New Year's Eve" },
  ];
}

function caHolidays(year: number): Holiday[] {
  const e = easter(year);
  const may25 = new Date(year, 4, 25);
  while (may25.getDay() !== 1) may25.setDate(may25.getDate() - 1);
  const vicDay = ymd(year, 5, may25.getDate());
  return [
    { date: ymd(year, 1, 1),              name: "🎆 New Year's Day" },
    { date: shift(e, -2),                 name: "✝️ Good Friday" },
    { date: shift(e, 1),                  name: "🐣 Easter Monday" },
    { date: vicDay,                       name: "👑 Victoria Day" },
    { date: ymd(year, 7, 1),              name: "🇨🇦 Canada Day" },
    { date: nthWeekday(year, 9, 1, 1),   name: "👷 Labour Day" },
    { date: nthWeekday(year, 10, 1, 2),  name: "🦃 Thanksgiving" },
    { date: ymd(year, 11, 11),            name: "🎖️ Remembrance Day" },
    { date: ymd(year, 12, 25),            name: "🎄 Christmas Day" },
    { date: ymd(year, 12, 26),            name: "🎁 Boxing Day" },
    { date: ymd(year, 12, 31),            name: "🎆 New Year's Eve" },
  ];
}

function ukHolidays(year: number): Holiday[] {
  const e = easter(year);
  return [
    { date: ymd(year, 1, 1),              name: "🎆 New Year's Day" },
    { date: shift(e, -2),                 name: "✝️ Good Friday" },
    { date: shift(e, 1),                  name: "🐣 Easter Monday" },
    { date: nthWeekday(year, 5, 1, 1),   name: "🏛️ Early May Bank Holiday" },
    { date: nthWeekday(year, 5, 1, -1),  name: "🌸 Spring Bank Holiday" },
    { date: nthWeekday(year, 8, 1, -1),  name: "☀️ Summer Bank Holiday" },
    { date: ymd(year, 12, 25),            name: "🎄 Christmas Day" },
    { date: ymd(year, 12, 26),            name: "🎁 Boxing Day" },
    { date: ymd(year, 12, 31),            name: "🎆 New Year's Eve" },
  ];
}

function auHolidays(year: number): Holiday[] {
  const e = easter(year);
  return [
    { date: ymd(year, 1, 1),              name: "🎆 New Year's Day" },
    { date: ymd(year, 1, 26),             name: "🇦🇺 Australia Day" },
    { date: shift(e, -2),                 name: "✝️ Good Friday" },
    { date: shift(e, 0),                  name: "🐣 Easter Sunday" },
    { date: shift(e, 1),                  name: "🐣 Easter Monday" },
    { date: ymd(year, 4, 25),             name: "🎖️ Anzac Day" },
    { date: nthWeekday(year, 6, 1, 2),   name: "👑 King's Birthday" },
    { date: ymd(year, 10, 31),            name: "🎃 Halloween" },
    { date: ymd(year, 12, 25),            name: "🎄 Christmas Day" },
    { date: ymd(year, 12, 26),            name: "🎁 Boxing Day" },
    { date: ymd(year, 12, 31),            name: "🎆 New Year's Eve" },
  ];
}

function nzHolidays(year: number): Holiday[] {
  const e = easter(year);
  let waitangi = new Date(year, 1, 6);
  if (waitangi.getDay() === 0) waitangi.setDate(7);
  if (waitangi.getDay() === 6) waitangi.setDate(8);
  return [
    { date: ymd(year, 1, 1),                     name: "🎆 New Year's Day" },
    { date: ymd(year, 1, 2),                     name: "🎆 Day after New Year's" },
    { date: ymd(waitangi.getFullYear(), waitangi.getMonth()+1, waitangi.getDate()), name: "🇳🇿 Waitangi Day" },
    { date: shift(e, -2),                        name: "✝️ Good Friday" },
    { date: shift(e, 1),                         name: "🐣 Easter Monday" },
    { date: ymd(year, 4, 25),                    name: "🎖️ Anzac Day" },
    { date: nthWeekday(year, 6, 1, 1),           name: "👑 King's Birthday" },
    { date: nthWeekday(year, 10, 1, 4),          name: "👷 Labour Day" },
    { date: ymd(year, 12, 25),                   name: "🎄 Christmas Day" },
    { date: ymd(year, 12, 26),                   name: "🎁 Boxing Day" },
    { date: ymd(year, 12, 31),                   name: "🎆 New Year's Eve" },
  ];
}

function irHolidays(year: number): Holiday[] {
  const e = easter(year);
  return [
    { date: ymd(year, 1, 1),              name: "🎆 New Year's Day" },
    { date: ymd(year, 2, 1),              name: "🌸 St. Brigid's Day" },
    { date: ymd(year, 3, 17),             name: "🍀 St. Patrick's Day" },
    { date: shift(e, -2),                 name: "✝️ Good Friday" },
    { date: shift(e, 1),                  name: "🐣 Easter Monday" },
    { date: nthWeekday(year, 5, 1, 1),   name: "🏛️ May Bank Holiday" },
    { date: nthWeekday(year, 6, 1, 1),   name: "🏛️ June Bank Holiday" },
    { date: nthWeekday(year, 8, 1, 1),   name: "☀️ August Bank Holiday" },
    { date: nthWeekday(year, 10, 1, -1), name: "🍂 October Bank Holiday" },
    { date: ymd(year, 12, 25),            name: "🎄 Christmas Day" },
    { date: ymd(year, 12, 26),            name: "🎁 St. Stephen's Day" },
    { date: ymd(year, 12, 31),            name: "🎆 New Year's Eve" },
  ];
}

function mxHolidays(year: number): Holiday[] {
  return [
    { date: ymd(year, 1, 1),              name: "🎆 Año Nuevo" },
    { date: nthWeekday(year, 2, 1, 1),   name: "🏛️ Día de la Constitución" },
    { date: nthWeekday(year, 3, 1, 3),   name: "🌟 Natalicio de Benito Juárez" },
    { date: ymd(year, 5, 1),              name: "👷 Día del Trabajo" },
    { date: ymd(year, 9, 16),             name: "🇲🇽 Día de la Independencia" },
    { date: ymd(year, 10, 31),            name: "💀 Día de Muertos Eve" },
    { date: ymd(year, 11, 1),             name: "💀 Día de Muertos" },
    { date: ymd(year, 11, 2),             name: "💀 Día de Muertos" },
    { date: nthWeekday(year, 11, 1, 3),  name: "🏛️ Día de la Revolución" },
    { date: ymd(year, 12, 12),            name: "🙏 Día de la Virgen de Guadalupe" },
    { date: ymd(year, 12, 25),            name: "🎄 Navidad" },
    { date: ymd(year, 12, 31),            name: "🎆 Víspera de Año Nuevo" },
  ];
}

function brHolidays(year: number): Holiday[] {
  const e = easter(year);
  return [
    { date: ymd(year, 1, 1),    name: "🎆 Confraternização Universal" },
    { date: shift(e, -48),      name: "🎭 Carnaval" },
    { date: shift(e, -47),      name: "🎭 Carnaval" },
    { date: shift(e, -2),       name: "✝️ Sexta-Feira Santa" },
    { date: shift(e, 0),        name: "🐣 Páscoa" },
    { date: ymd(year, 4, 21),   name: "🏛️ Tiradentes" },
    { date: ymd(year, 5, 1),    name: "👷 Dia do Trabalho" },
    { date: shift(e, 60),       name: "✝️ Corpus Christi" },
    { date: ymd(year, 9, 7),    name: "🇧🇷 Independência do Brasil" },
    { date: ymd(year, 10, 12),  name: "🙏 Nossa Senhora Aparecida" },
    { date: ymd(year, 11, 2),   name: "🕯️ Finados" },
    { date: ymd(year, 11, 15),  name: "🏛️ Proclamação da República" },
    { date: ymd(year, 12, 25),  name: "🎄 Natal" },
    { date: ymd(year, 12, 31),  name: "🎆 Véspera de Ano Novo" },
  ];
}

function deHolidays(year: number): Holiday[] {
  const e = easter(year);
  return [
    { date: ymd(year, 1, 1),    name: "🎆 Neujahr" },
    { date: shift(e, -2),       name: "✝️ Karfreitag" },
    { date: shift(e, 0),        name: "🐣 Ostersonntag" },
    { date: shift(e, 1),        name: "🐣 Ostermontag" },
    { date: ymd(year, 5, 1),    name: "👷 Tag der Arbeit" },
    { date: shift(e, 39),       name: "✝️ Christi Himmelfahrt" },
    { date: shift(e, 49),       name: "✝️ Pfingstsonntag" },
    { date: shift(e, 50),       name: "✝️ Pfingstmontag" },
    { date: ymd(year, 10, 3),   name: "🇩🇪 Tag der Deutschen Einheit" },
    { date: ymd(year, 12, 25),  name: "🎄 1. Weihnachtstag" },
    { date: ymd(year, 12, 26),  name: "🎄 2. Weihnachtstag" },
    { date: ymd(year, 12, 31),  name: "🎆 Silvester" },
  ];
}

function frHolidays(year: number): Holiday[] {
  const e = easter(year);
  return [
    { date: ymd(year, 1, 1),    name: "🎆 Jour de l'An" },
    { date: shift(e, 1),        name: "🐣 Lundi de Pâques" },
    { date: ymd(year, 5, 1),    name: "👷 Fête du Travail" },
    { date: ymd(year, 5, 8),    name: "🕊️ Victoire 1945" },
    { date: shift(e, 39),       name: "✝️ Ascension" },
    { date: shift(e, 50),       name: "✝️ Lundi de Pentecôte" },
    { date: ymd(year, 7, 14),   name: "🇫🇷 Fête Nationale" },
    { date: ymd(year, 8, 15),   name: "🙏 Assomption" },
    { date: ymd(year, 11, 1),   name: "🕯️ Toussaint" },
    { date: ymd(year, 11, 11),  name: "🎖️ Armistice" },
    { date: ymd(year, 12, 25),  name: "🎄 Noël" },
    { date: ymd(year, 12, 31),  name: "🎆 Réveillon" },
  ];
}

function inHolidays(year: number): Holiday[] {
  return [
    { date: ymd(year, 1, 1),   name: "🎆 New Year's Day" },
    { date: ymd(year, 1, 26),  name: "🇮🇳 Republic Day" },
    { date: ymd(year, 3, 8),   name: "💜 Women's Day" },
    { date: ymd(year, 4, 14),  name: "🏛️ Ambedkar Jayanti" },
    { date: ymd(year, 5, 1),   name: "👷 Labour Day" },
    { date: ymd(year, 8, 15),  name: "🇮🇳 Independence Day" },
    { date: ymd(year, 10, 2),  name: "🕊️ Gandhi Jayanti" },
    { date: ymd(year, 10, 24), name: "🪔 Diwali (approx)" },
    { date: ymd(year, 11, 14), name: "🧒 Children's Day" },
    { date: ymd(year, 12, 25), name: "🎄 Christmas Day" },
    { date: ymd(year, 12, 31), name: "🎆 New Year's Eve" },
  ];
}

function jpHolidays(year: number): Holiday[] {
  return [
    { date: ymd(year, 1, 1),              name: "🎆 元日 New Year's Day" },
    { date: nthWeekday(year, 1, 1, 2),   name: "🎊 成人の日 Coming of Age Day" },
    { date: ymd(year, 2, 11),             name: "🇯🇵 建国記念の日 National Foundation Day" },
    { date: ymd(year, 2, 23),             name: "👑 天皇誕生日 Emperor's Birthday" },
    { date: ymd(year, 3, 20),             name: "🌸 春分の日 Vernal Equinox" },
    { date: ymd(year, 4, 29),             name: "🌿 昭和の日 Showa Day" },
    { date: ymd(year, 5, 3),              name: "📜 憲法記念日 Constitution Day" },
    { date: ymd(year, 5, 4),              name: "🌳 みどりの日 Greenery Day" },
    { date: ymd(year, 5, 5),              name: "🎏 こどもの日 Children's Day" },
    { date: nthWeekday(year, 7, 1, 3),   name: "🌊 海の日 Marine Day" },
    { date: ymd(year, 8, 11),             name: "⛰️ 山の日 Mountain Day" },
    { date: nthWeekday(year, 9, 1, 3),   name: "🧓 敬老の日 Respect for Aged Day" },
    { date: ymd(year, 9, 23),             name: "🍂 秋分の日 Autumnal Equinox" },
    { date: nthWeekday(year, 10, 1, 2),  name: "🏅 スポーツの日 Sports Day" },
    { date: ymd(year, 11, 3),             name: "🎨 文化の日 Culture Day" },
    { date: ymd(year, 11, 23),            name: "🌾 勤労感謝の日 Labour Thanksgiving" },
    { date: ymd(year, 12, 31),            name: "🎆 大晦日 New Year's Eve" },
  ];
}

function zaHolidays(year: number): Holiday[] {
  const e = easter(year);
  return [
    { date: ymd(year, 1, 1),   name: "🎆 New Year's Day" },
    { date: ymd(year, 3, 21),  name: "✊ Human Rights Day" },
    { date: shift(e, -2),      name: "✝️ Good Friday" },
    { date: shift(e, 1),       name: "👪 Family Day" },
    { date: ymd(year, 4, 27),  name: "🇿🇦 Freedom Day" },
    { date: ymd(year, 5, 1),   name: "👷 Workers' Day" },
    { date: ymd(year, 6, 16),  name: "🎓 Youth Day" },
    { date: ymd(year, 8, 9),   name: "💜 National Women's Day" },
    { date: ymd(year, 9, 24),  name: "🌍 Heritage Day" },
    { date: ymd(year, 12, 16), name: "🕊️ Day of Reconciliation" },
    { date: ymd(year, 12, 25), name: "🎄 Christmas Day" },
    { date: ymd(year, 12, 26), name: "🎁 Day of Goodwill" },
    { date: ymd(year, 12, 31), name: "🎆 New Year's Eve" },
  ];
}

function phHolidays(year: number): Holiday[] {
  const e = easter(year);
  return [
    { date: ymd(year, 1, 1),              name: "🎆 New Year's Day" },
    { date: shift(e, -3),                 name: "✝️ Maundy Thursday" },
    { date: shift(e, -2),                 name: "✝️ Good Friday" },
    { date: shift(e, 0),                  name: "🐣 Easter Sunday" },
    { date: ymd(year, 4, 9),              name: "🎖️ Day of Valor" },
    { date: ymd(year, 5, 1),              name: "👷 Labour Day" },
    { date: ymd(year, 6, 12),             name: "🇵🇭 Independence Day" },
    { date: nthWeekday(year, 8, 1, -1),  name: "🏅 National Heroes Day" },
    { date: ymd(year, 11, 1),             name: "🕯️ All Saints' Day" },
    { date: ymd(year, 11, 2),             name: "🕯️ All Souls' Day" },
    { date: ymd(year, 11, 30),            name: "🏛️ Bonifacio Day" },
    { date: ymd(year, 12, 25),            name: "🎄 Christmas Day" },
    { date: ymd(year, 12, 30),            name: "🏛️ Rizal Day" },
    { date: ymd(year, 12, 31),            name: "🎆 New Year's Eve" },
  ];
}

function esHolidays(year: number): Holiday[] {
  const e = easter(year);
  return [
    { date: ymd(year, 1, 1),   name: "🎆 Año Nuevo" },
    { date: ymd(year, 1, 6),   name: "👑 Reyes Magos" },
    { date: shift(e, -3),      name: "✝️ Jueves Santo" },
    { date: shift(e, -2),      name: "✝️ Viernes Santo" },
    { date: ymd(year, 5, 1),   name: "👷 Día del Trabajo" },
    { date: ymd(year, 8, 15),  name: "🙏 Asunción de la Virgen" },
    { date: ymd(year, 10, 12), name: "🇪🇸 Fiesta Nacional" },
    { date: ymd(year, 11, 1),  name: "🕯️ Todos los Santos" },
    { date: ymd(year, 12, 6),  name: "🏛️ Día de la Constitución" },
    { date: ymd(year, 12, 8),  name: "🙏 Inmaculada Concepción" },
    { date: ymd(year, 12, 25), name: "🎄 Navidad" },
    { date: ymd(year, 12, 31), name: "🎆 Nochevieja" },
  ];
}

function itHolidays(year: number): Holiday[] {
  const e = easter(year);
  return [
    { date: ymd(year, 1, 1),   name: "🎆 Capodanno" },
    { date: ymd(year, 1, 6),   name: "👑 Epifania" },
    { date: shift(e, 0),       name: "🐣 Pasqua" },
    { date: shift(e, 1),       name: "🐣 Lunedì dell'Angelo" },
    { date: ymd(year, 4, 25),  name: "🇮🇹 Festa della Liberazione" },
    { date: ymd(year, 5, 1),   name: "👷 Festa del Lavoro" },
    { date: ymd(year, 6, 2),   name: "🏛️ Festa della Repubblica" },
    { date: ymd(year, 8, 15),  name: "☀️ Ferragosto" },
    { date: ymd(year, 11, 1),  name: "🕯️ Ognissanti" },
    { date: ymd(year, 12, 8),  name: "🙏 Immacolata Concezione" },
    { date: ymd(year, 12, 25), name: "🎄 Natale" },
    { date: ymd(year, 12, 26), name: "🎄 Santo Stefano" },
    { date: ymd(year, 12, 31), name: "🎆 Capodanno Eve" },
  ];
}

function nlHolidays(year: number): Holiday[] {
  const e = easter(year);
  return [
    { date: ymd(year, 1, 1),   name: "🎆 Nieuwjaarsdag" },
    { date: shift(e, -2),      name: "✝️ Goede Vrijdag" },
    { date: shift(e, 0),       name: "🐣 Eerste Paasdag" },
    { date: shift(e, 1),       name: "🐣 Tweede Paasdag" },
    { date: ymd(year, 4, 27),  name: "👑 Koningsdag" },
    { date: ymd(year, 5, 5),   name: "🕊️ Bevrijdingsdag" },
    { date: shift(e, 39),      name: "✝️ Hemelvaartsdag" },
    { date: shift(e, 49),      name: "✝️ Eerste Pinksterdag" },
    { date: shift(e, 50),      name: "✝️ Tweede Pinksterdag" },
    { date: ymd(year, 12, 25), name: "🎄 Eerste Kerstdag" },
    { date: ymd(year, 12, 26), name: "🎄 Tweede Kerstdag" },
    { date: ymd(year, 12, 31), name: "🎆 Oudejaarsavond" },
  ];
}

// ─── Country map ──────────────────────────────────────────────────────────────

const COUNTRY_HOLIDAYS: Record<string, (year: number) => Holiday[]> = {
  "United States":  usHolidays,
  "Canada":         caHolidays,
  "United Kingdom": ukHolidays,
  "Australia":      auHolidays,
  "New Zealand":    nzHolidays,
  "Ireland":        irHolidays,
  "Mexico":         mxHolidays,
  "Brazil":         brHolidays,
  "Germany":        deHolidays,
  "France":         frHolidays,
  "India":          inHolidays,
  "Japan":          jpHolidays,
  "South Africa":   zaHolidays,
  "Philippines":    phHolidays,
  "Spain":          esHolidays,
  "Italy":          itHolidays,
  "Netherlands":    nlHolidays,
};

/** Minimal holidays shown for countries not in the map above */
function defaultHolidays(year: number): Holiday[] {
  const e = easter(year);
  return [
    { date: ymd(year, 1, 1),   name: "🎆 New Year's Day" },
    { date: shift(e, -2),      name: "✝️ Good Friday" },
    { date: shift(e, 0),       name: "🐣 Easter Sunday" },
    { date: ymd(year, 12, 25), name: "🎄 Christmas Day" },
    { date: ymd(year, 12, 31), name: "🎆 New Year's Eve" },
  ];
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Returns holidays for the given country that fall within [rangeStart, rangeEnd].
 * Spans multiple years automatically if the range crosses a year boundary.
 */
export function getHolidaysForRange(
  country: string | null | undefined,
  rangeStart: string,
  rangeEnd: string,
): Holiday[] {
  const fn = country ? (COUNTRY_HOLIDAYS[country] ?? defaultHolidays) : null;
  if (!fn) return [];

  const startYear = parseInt(rangeStart.slice(0, 4));
  const endYear   = parseInt(rangeEnd.slice(0, 4));
  const result: Holiday[] = [];
  for (let y = startYear; y <= endYear; y++) {
    for (const h of fn(y)) {
      if (h.date >= rangeStart && h.date <= rangeEnd) result.push(h);
    }
  }
  return result;
}

/** Whether a country has a dedicated holiday list */
export function hasHolidaySupport(country: string): boolean {
  return country in COUNTRY_HOLIDAYS;
}
