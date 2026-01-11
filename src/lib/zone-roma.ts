// Municipi e zone di Roma
export const MUNICIPI_ROMA = [
  'Municipio I - Centro Storico',
  'Municipio II - Parioli/Nomentano',
  'Municipio III - Monte Sacro/Montesacro Alto',
  'Municipio IV - Tiburtino',
  'Municipio V - Prenestino/Centocelle',
  'Municipio VI - Torri/Romanina',
  'Municipio VII - Tuscolano/Cinecittà',
  'Municipio VIII - Ostiense/Garbatella',
  'Municipio IX - EUR',
  'Municipio X - Ostia/Acilia',
  'Municipio XI - Portuense/Magliana',
  'Municipio XII - Monte Verde/Gianicolense',
  'Municipio XIII - Aurelia/Casalotti',
  'Municipio XIV - Monte Mario',
  'Municipio XV - Cassia/Flaminia',
] as const;

export const QUARTIERI_MILANO = [
  'Centro Storico',
  'Porta Romana/Corvetto',
  'Porta Venezia/Città Studi',
  'Porta Vittoria/Lodi',
  'Vigentino',
  'Barona',
  'Baggio/De Angeli',
  'Fiera/Gallaratese',
  'Porta Garibaldi/Isola',
  'Niguarda/Bovisa',
] as const;

export const QUARTIERI_NAPOLI = [
  'Centro Storico',
  'Chiaia/Posillipo',
  'Vomero',
  'Fuorigrotta/Bagnoli',
  'Arenella',
  'Capodimonte',
  'San Carlo all\'Arena',
  'Stella',
  'Avvocata',
  'Montecalvario',
  'Mercato/Pendino',
  'Vicaria',
  'Poggioreale',
  'Zona Orientale',
  'Barra/San Giovanni',
] as const;

// Mappa città -> zone
export const ZONE_PER_CITTA: Record<string, readonly string[]> = {
  'Roma': MUNICIPI_ROMA,
  'Milano': QUARTIERI_MILANO,
  'Napoli': QUARTIERI_NAPOLI,
};

// Funzione helper per ottenere le zone di una città
export function getZonePerCitta(citta: string): string[] {
  return (ZONE_PER_CITTA[citta] || []) as string[];
}
