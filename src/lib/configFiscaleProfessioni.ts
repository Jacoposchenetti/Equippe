/**
 * Configurazione fiscale per professione sanitaria.
 * Ogni professione ha regole diverse per cassa previdenziale, prestazioni, esenzioni IVA.
 * Struttura parametrica: aggiungere nuove professioni è semplice.
 */

export interface PrestazionePreconfigurata {
  codice: string;
  descrizione: string;
  prezzoDefault?: number;
  sanitaria: boolean;          // Se true → esenzione IVA art.10 per persone fisiche
  aliquotaIva: number;         // 0 se sanitaria esente, 22 se non sanitaria
  naturaEsenzione?: string;    // "N4" se esente art.10
}

export interface ConfigFiscaleProfessione {
  professione: string;

  // Cassa previdenziale
  cassaPrevidenziale: {
    nome: string;              // es. "ENPAP"
    codice: string;            // Codice FatturaPA (es. "TC22")
    aliquota: number;          // Percentuale (es. 2)
    descrizioneRiga: string;   // Descrizione in fattura
  };

  // Codice ATECO principale
  codiceAteco: string;

  // Prestazioni tipiche pre-configurate
  prestazioni: PrestazionePreconfigurata[];

  // Regole specifiche
  regole: {
    // Se le prestazioni sanitarie sono esenti IVA art.10
    esenzioneIvaSanitaria: boolean;
    // Riferimento normativo esenzione
    riferimentoEsenzione: string;
    // Se applicare ritenuta d'acconto a persone giuridiche
    ritenutaAccontoAziende: boolean;
    // Aliquota ritenuta d'acconto
    aliquotaRitenuta: number;
  };
}

// ===== CONFIGURAZIONI PER PROFESSIONE =====

const CONFIG_PSICOLOGO: ConfigFiscaleProfessione = {
  professione: 'Psicologo',
  cassaPrevidenziale: {
    nome: 'ENPAP',
    codice: 'TC22',
    aliquota: 2,
    descrizioneRiga: 'Contributo integrativo ENPAP 2%',
  },
  codiceAteco: '86.90.30',
  prestazioni: [
    {
      codice: 'PSI-001',
      descrizione: 'Seduta psicologica individuale',
      prezzoDefault: 60,
      sanitaria: true,
      aliquotaIva: 0,
      naturaEsenzione: 'N4',
    },
    {
      codice: 'PSI-002',
      descrizione: 'Seduta psicologica di coppia',
      prezzoDefault: 80,
      sanitaria: true,
      aliquotaIva: 0,
      naturaEsenzione: 'N4',
    },
    {
      codice: 'PSI-003',
      descrizione: 'Seduta psicologica familiare',
      prezzoDefault: 90,
      sanitaria: true,
      aliquotaIva: 0,
      naturaEsenzione: 'N4',
    },
    {
      codice: 'PSI-004',
      descrizione: 'Colloquio psicologico clinico',
      prezzoDefault: 60,
      sanitaria: true,
      aliquotaIva: 0,
      naturaEsenzione: 'N4',
    },
    {
      codice: 'PSI-005',
      descrizione: 'Valutazione psicodiagnostica',
      prezzoDefault: 120,
      sanitaria: true,
      aliquotaIva: 0,
      naturaEsenzione: 'N4',
    },
    {
      codice: 'PSI-006',
      descrizione: 'Somministrazione test psicologici',
      prezzoDefault: 80,
      sanitaria: true,
      aliquotaIva: 0,
      naturaEsenzione: 'N4',
    },
    {
      codice: 'PSI-007',
      descrizione: 'Relazione psicodiagnostica',
      prezzoDefault: 150,
      sanitaria: true,
      aliquotaIva: 0,
      naturaEsenzione: 'N4',
    },
    {
      codice: 'PSI-008',
      descrizione: 'Supervisione professionale',
      prezzoDefault: 80,
      sanitaria: false,
      aliquotaIva: 22,
    },
    {
      codice: 'PSI-009',
      descrizione: 'Consulenza psicologica aziendale',
      prezzoDefault: 100,
      sanitaria: false,
      aliquotaIva: 22,
    },
    {
      codice: 'PSI-010',
      descrizione: 'Perizia psicologica / CTP',
      prezzoDefault: 200,
      sanitaria: false,
      aliquotaIva: 22,
    },
    {
      codice: 'PSI-011',
      descrizione: 'Seduta di psicoterapia individuale',
      prezzoDefault: 70,
      sanitaria: true,
      aliquotaIva: 0,
      naturaEsenzione: 'N4',
    },
    {
      codice: 'PSI-012',
      descrizione: 'Seduta di psicoterapia di coppia',
      prezzoDefault: 90,
      sanitaria: true,
      aliquotaIva: 0,
      naturaEsenzione: 'N4',
    },
    {
      codice: 'PSI-013',
      descrizione: 'Seduta di psicoterapia di gruppo',
      prezzoDefault: 40,
      sanitaria: true,
      aliquotaIva: 0,
      naturaEsenzione: 'N4',
    },
    {
      codice: 'PSI-014',
      descrizione: 'Corso di formazione / docenza',
      prezzoDefault: 150,
      sanitaria: false,
      aliquotaIva: 22,
    },
  ],
  regole: {
    esenzioneIvaSanitaria: true,
    riferimentoEsenzione: 'Art. 10, c.1, n.18 DPR 633/72',
    ritenutaAccontoAziende: true,
    aliquotaRitenuta: 20,
  },
};

// Psicoterapeuta usa stessa config di Psicologo (stessa cassa ENPAP, stesse regole)
const CONFIG_PSICOTERAPEUTA: ConfigFiscaleProfessione = {
  ...CONFIG_PSICOLOGO,
  professione: 'Psicoterapeuta',
};

// ===== MEDICI (ENPAM TC01 2%) =====

const CASSA_ENPAM = {
  nome: 'ENPAM',
  codice: 'TC01',
  aliquota: 2,
  descrizioneRiga: 'Contributo integrativo ENPAM 2%',
};

const REGOLE_SANITARIE = {
  esenzioneIvaSanitaria: true,
  riferimentoEsenzione: 'Art. 10, c.1, n.18 DPR 633/72',
  ritenutaAccontoAziende: true,
  aliquotaRitenuta: 20,
};

const CONFIG_PSICHIATRA: ConfigFiscaleProfessione = {
  professione: 'Psichiatra',
  cassaPrevidenziale: { ...CASSA_ENPAM },
  codiceAteco: '86.22.09',
  prestazioni: [
    { codice: 'PSQ-001', descrizione: 'Visita psichiatrica', prezzoDefault: 120, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'PSQ-002', descrizione: 'Controllo psichiatrico', prezzoDefault: 80, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'PSQ-003', descrizione: 'Valutazione diagnostica psichiatrica', prezzoDefault: 150, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'PSQ-004', descrizione: 'Colloquio clinico psichiatrico', prezzoDefault: 100, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'PSQ-005', descrizione: 'Certificato medico psichiatrico', prezzoDefault: 50, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'PSQ-006', descrizione: 'Perizia psichiatrica / CTP', prezzoDefault: 300, sanitaria: false, aliquotaIva: 22 },
    { codice: 'PSQ-007', descrizione: 'Consulenza psicofarmacologica', prezzoDefault: 100, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
  ],
  regole: { ...REGOLE_SANITARIE },
};

const CONFIG_DIETOLOGO: ConfigFiscaleProfessione = {
  professione: 'Dietologo',
  cassaPrevidenziale: { ...CASSA_ENPAM },
  codiceAteco: '86.22.09',
  prestazioni: [
    { codice: 'DTL-001', descrizione: 'Visita dietologica', prezzoDefault: 120, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'DTL-002', descrizione: 'Controllo dietologico', prezzoDefault: 60, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'DTL-003', descrizione: 'Piano alimentare personalizzato', prezzoDefault: 100, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'DTL-004', descrizione: 'Valutazione composizione corporea', prezzoDefault: 50, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'DTL-005', descrizione: 'Consulenza nutrizionale', prezzoDefault: 80, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
  ],
  regole: { ...REGOLE_SANITARIE },
};

const CONFIG_MEDICO_BASE: ConfigFiscaleProfessione = {
  professione: 'Medico di Base',
  cassaPrevidenziale: { ...CASSA_ENPAM },
  codiceAteco: '86.21.00',
  prestazioni: [
    { codice: 'MDB-001', descrizione: 'Visita medica generale', prezzoDefault: 50, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'MDB-002', descrizione: 'Certificato medico', prezzoDefault: 30, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'MDB-003', descrizione: 'Visita domiciliare', prezzoDefault: 80, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'MDB-004', descrizione: 'Vaccinazione', prezzoDefault: 25, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'MDB-005', descrizione: 'Elettrocardiogramma', prezzoDefault: 40, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
  ],
  regole: { ...REGOLE_SANITARIE },
};

const CONFIG_MEDICO_SPECIALISTA: ConfigFiscaleProfessione = {
  professione: 'Medico Specialista',
  cassaPrevidenziale: { ...CASSA_ENPAM },
  codiceAteco: '86.22.09',
  prestazioni: [
    { codice: 'MDS-001', descrizione: 'Visita specialistica', prezzoDefault: 120, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'MDS-002', descrizione: 'Controllo specialistico', prezzoDefault: 80, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'MDS-003', descrizione: 'Ecografia', prezzoDefault: 80, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'MDS-004', descrizione: 'Accertamento diagnostico', prezzoDefault: 100, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'MDS-005', descrizione: 'Certificato medico specialistico', prezzoDefault: 50, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'MDS-006', descrizione: 'Perizia medico-legale / CTP', prezzoDefault: 300, sanitaria: false, aliquotaIva: 22 },
  ],
  regole: { ...REGOLE_SANITARIE },
};

const CONFIG_GINECOLOGO: ConfigFiscaleProfessione = {
  professione: 'Ginecologo',
  cassaPrevidenziale: { ...CASSA_ENPAM },
  codiceAteco: '86.22.09',
  prestazioni: [
    { codice: 'GIN-001', descrizione: 'Visita ginecologica', prezzoDefault: 120, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'GIN-002', descrizione: 'Ecografia ginecologica', prezzoDefault: 80, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'GIN-003', descrizione: 'Ecografia ostetrica', prezzoDefault: 100, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'GIN-004', descrizione: 'Pap test', prezzoDefault: 50, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'GIN-005', descrizione: 'Controllo ostetrico', prezzoDefault: 80, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'GIN-006', descrizione: 'Consulenza fertilità', prezzoDefault: 150, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
  ],
  regole: { ...REGOLE_SANITARIE },
};

const CONFIG_ANDROLOGO: ConfigFiscaleProfessione = {
  professione: 'Andrologo',
  cassaPrevidenziale: { ...CASSA_ENPAM },
  codiceAteco: '86.22.09',
  prestazioni: [
    { codice: 'AND-001', descrizione: 'Visita andrologica', prezzoDefault: 120, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'AND-002', descrizione: 'Ecografia andrologica', prezzoDefault: 80, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'AND-003', descrizione: 'Valutazione fertilità maschile', prezzoDefault: 150, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'AND-004', descrizione: 'Controllo andrologico', prezzoDefault: 80, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
  ],
  regole: { ...REGOLE_SANITARIE },
};

// ===== BIOLOGI (ENPAB TC07 4%) =====

const CONFIG_NUTRIZIONISTA: ConfigFiscaleProfessione = {
  professione: 'Nutrizionista',
  cassaPrevidenziale: {
    nome: 'ENPAB',
    codice: 'TC07',
    aliquota: 4,
    descrizioneRiga: 'Contributo integrativo ENPAB 4%',
  },
  codiceAteco: '86.90.29',
  prestazioni: [
    { codice: 'NUT-001', descrizione: 'Visita nutrizionale', prezzoDefault: 80, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'NUT-002', descrizione: 'Controllo nutrizionale', prezzoDefault: 50, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'NUT-003', descrizione: 'Piano alimentare personalizzato', prezzoDefault: 100, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'NUT-004', descrizione: 'Valutazione composizione corporea (BIA)', prezzoDefault: 40, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'NUT-005', descrizione: 'Educazione alimentare', prezzoDefault: 60, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'NUT-006', descrizione: 'Consulenza nutrizionale sportiva', prezzoDefault: 80, sanitaria: false, aliquotaIva: 22 },
  ],
  regole: { ...REGOLE_SANITARIE },
};

// ===== PROFESSIONI SANITARIE SENZA CASSA PROPRIA (INPS gestione separata) =====

const CASSA_NESSUNA = {
  nome: '',
  codice: '',
  aliquota: 0,
  descrizioneRiga: '',
};

const CONFIG_DIETISTA: ConfigFiscaleProfessione = {
  professione: 'Dietista',
  cassaPrevidenziale: { ...CASSA_NESSUNA },
  codiceAteco: '86.90.29',
  prestazioni: [
    { codice: 'DIT-001', descrizione: 'Visita dietistica', prezzoDefault: 60, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'DIT-002', descrizione: 'Controllo dietistico', prezzoDefault: 40, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'DIT-003', descrizione: 'Piano alimentare personalizzato', prezzoDefault: 80, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'DIT-004', descrizione: 'Educazione alimentare', prezzoDefault: 50, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'DIT-005', descrizione: 'Valutazione antropometrica', prezzoDefault: 30, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
  ],
  regole: { ...REGOLE_SANITARIE },
};

const CONFIG_LOGOPEDISTA: ConfigFiscaleProfessione = {
  professione: 'Logopedista',
  cassaPrevidenziale: { ...CASSA_NESSUNA },
  codiceAteco: '86.90.29',
  prestazioni: [
    { codice: 'LOG-001', descrizione: 'Seduta di logopedia', prezzoDefault: 50, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'LOG-002', descrizione: 'Valutazione logopedica', prezzoDefault: 80, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'LOG-003', descrizione: 'Trattamento disturbi del linguaggio', prezzoDefault: 50, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'LOG-004', descrizione: 'Trattamento deglutizione/disfagia', prezzoDefault: 50, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'LOG-005', descrizione: 'Valutazione DSA', prezzoDefault: 100, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'LOG-006', descrizione: 'Relazione logopedica', prezzoDefault: 80, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
  ],
  regole: { ...REGOLE_SANITARIE },
};

const CONFIG_FISIOTERAPISTA: ConfigFiscaleProfessione = {
  professione: 'Fisioterapista',
  cassaPrevidenziale: { ...CASSA_NESSUNA },
  codiceAteco: '86.90.21',
  prestazioni: [
    { codice: 'FIS-001', descrizione: 'Seduta di fisioterapia', prezzoDefault: 50, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'FIS-002', descrizione: 'Valutazione fisioterapica', prezzoDefault: 60, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'FIS-003', descrizione: 'Riabilitazione ortopedica', prezzoDefault: 50, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'FIS-004', descrizione: 'Riabilitazione neurologica', prezzoDefault: 60, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'FIS-005', descrizione: 'Terapia manuale', prezzoDefault: 50, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'FIS-006', descrizione: 'Linfodrenaggio manuale', prezzoDefault: 50, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'FIS-007', descrizione: 'Rieducazione posturale', prezzoDefault: 50, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
  ],
  regole: { ...REGOLE_SANITARIE },
};

const CONFIG_TERAPISTA_OCCUPAZIONALE: ConfigFiscaleProfessione = {
  professione: 'Terapista Occupazionale',
  cassaPrevidenziale: { ...CASSA_NESSUNA },
  codiceAteco: '86.90.29',
  prestazioni: [
    { codice: 'TOC-001', descrizione: 'Seduta di terapia occupazionale', prezzoDefault: 50, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'TOC-002', descrizione: 'Valutazione funzionale', prezzoDefault: 70, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'TOC-003', descrizione: 'Riabilitazione autonomia quotidiana', prezzoDefault: 50, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'TOC-004', descrizione: 'Consulenza ausili e adattamento ambientale', prezzoDefault: 80, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'TOC-005', descrizione: 'Riabilitazione della mano', prezzoDefault: 50, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
  ],
  regole: { ...REGOLE_SANITARIE },
};

const CONFIG_INFERMIERE: ConfigFiscaleProfessione = {
  professione: 'Infermiere',
  cassaPrevidenziale: { ...CASSA_NESSUNA },
  codiceAteco: '86.90.10',
  prestazioni: [
    { codice: 'INF-001', descrizione: 'Prestazione infermieristica domiciliare', prezzoDefault: 30, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'INF-002', descrizione: 'Medicazione', prezzoDefault: 25, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'INF-003', descrizione: 'Prelievo ematico', prezzoDefault: 15, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'INF-004', descrizione: 'Iniezione intramuscolare/endovenosa', prezzoDefault: 15, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'INF-005', descrizione: 'Gestione catetere/stomia', prezzoDefault: 30, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'INF-006', descrizione: 'Assistenza infermieristica continuativa (per ora)', prezzoDefault: 20, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
  ],
  regole: { ...REGOLE_SANITARIE },
};

const CONFIG_NEUROPSICOMOTRICISTA: ConfigFiscaleProfessione = {
  professione: 'Neuropsicomotricista',
  cassaPrevidenziale: { ...CASSA_NESSUNA },
  codiceAteco: '86.90.29',
  prestazioni: [
    { codice: 'NPM-001', descrizione: 'Seduta di neuropsicomotricità', prezzoDefault: 50, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'NPM-002', descrizione: 'Valutazione neuropsicomotoria', prezzoDefault: 80, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'NPM-003', descrizione: 'Trattamento disturbi dello sviluppo', prezzoDefault: 50, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'NPM-004', descrizione: 'Intervento precoce', prezzoDefault: 50, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'NPM-005', descrizione: 'Relazione neuropsicomotoria', prezzoDefault: 100, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
  ],
  regole: { ...REGOLE_SANITARIE },
};

const CONFIG_OSTEOPATA: ConfigFiscaleProfessione = {
  professione: 'Osteopata',
  cassaPrevidenziale: { ...CASSA_NESSUNA },
  codiceAteco: '86.90.29',
  prestazioni: [
    { codice: 'OST-001', descrizione: 'Trattamento osteopatico', prezzoDefault: 70, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'OST-002', descrizione: 'Valutazione osteopatica', prezzoDefault: 80, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'OST-003', descrizione: 'Trattamento cranio-sacrale', prezzoDefault: 70, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'OST-004', descrizione: 'Trattamento osteopatico pediatrico', prezzoDefault: 60, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
  ],
  regole: { ...REGOLE_SANITARIE },
};

// ===== PROFESSIONI NON SANITARIE =====

const CONFIG_ASSISTENTE_SOCIALE: ConfigFiscaleProfessione = {
  professione: 'Assistente Sociale',
  cassaPrevidenziale: { ...CASSA_NESSUNA },
  codiceAteco: '88.99.00',
  prestazioni: [
    { codice: 'ASS-001', descrizione: 'Colloquio sociale', prezzoDefault: 50, sanitaria: false, aliquotaIva: 22 },
    { codice: 'ASS-002', descrizione: 'Relazione sociale', prezzoDefault: 100, sanitaria: false, aliquotaIva: 22 },
    { codice: 'ASS-003', descrizione: 'Mediazione familiare', prezzoDefault: 70, sanitaria: false, aliquotaIva: 22 },
    { codice: 'ASS-004', descrizione: 'Consulenza servizi sociali', prezzoDefault: 60, sanitaria: false, aliquotaIva: 22 },
    { codice: 'ASS-005', descrizione: 'Perizia sociale / CTP', prezzoDefault: 200, sanitaria: false, aliquotaIva: 22 },
  ],
  regole: {
    esenzioneIvaSanitaria: false,
    riferimentoEsenzione: '',
    ritenutaAccontoAziende: true,
    aliquotaRitenuta: 20,
  },
};

const CONFIG_EDUCATORE_PROFESSIONALE: ConfigFiscaleProfessione = {
  professione: 'Educatore Professionale',
  cassaPrevidenziale: { ...CASSA_NESSUNA },
  codiceAteco: '88.99.00',
  prestazioni: [
    { codice: 'EDU-001', descrizione: 'Seduta educativa individuale', prezzoDefault: 40, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'EDU-002', descrizione: 'Progetto educativo individualizzato (PEI)', prezzoDefault: 100, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'EDU-003', descrizione: 'Intervento educativo domiciliare', prezzoDefault: 40, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'EDU-004', descrizione: 'Relazione educativa', prezzoDefault: 80, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
  ],
  regole: { ...REGOLE_SANITARIE },
};

const CONFIG_SESSUOLOGO: ConfigFiscaleProfessione = {
  professione: 'Sessuologo',
  // La cassa dipende dalla professione base (Psicologo→ENPAP, Medico→ENPAM).
  // L'utente sceglierà la cassa corretta nella configurazione fatturazione.
  cassaPrevidenziale: { ...CASSA_NESSUNA },
  codiceAteco: '86.90.30',
  prestazioni: [
    { codice: 'SEX-001', descrizione: 'Consulenza sessuologica', prezzoDefault: 80, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'SEX-002', descrizione: 'Seduta di sessuologia clinica', prezzoDefault: 70, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'SEX-003', descrizione: 'Terapia sessuale di coppia', prezzoDefault: 90, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
    { codice: 'SEX-004', descrizione: 'Valutazione sessuologica', prezzoDefault: 100, sanitaria: true, aliquotaIva: 0, naturaEsenzione: 'N4' },
  ],
  regole: { ...REGOLE_SANITARIE },
};

// Config generica per professioni non ancora mappate (senza cassa specifica)
const CONFIG_GENERICA: ConfigFiscaleProfessione = {
  professione: 'Generico',
  cassaPrevidenziale: { ...CASSA_NESSUNA },
  codiceAteco: '',
  prestazioni: [],
  regole: { ...REGOLE_SANITARIE },
};

// ===== REGISTRO CONFIGURAZIONI =====

const CONFIGURAZIONI_FISCALI: Record<string, ConfigFiscaleProfessione> = {
  // ENPAP (Psicologi)
  'Psicologo': CONFIG_PSICOLOGO,
  'Psicoterapeuta': CONFIG_PSICOTERAPEUTA,
  // ENPAM (Medici)
  'Psichiatra': CONFIG_PSICHIATRA,
  'Dietologo': CONFIG_DIETOLOGO,
  'Medico di Base': CONFIG_MEDICO_BASE,
  'Medico Specialista': CONFIG_MEDICO_SPECIALISTA,
  'Ginecologo': CONFIG_GINECOLOGO,
  'Andrologo': CONFIG_ANDROLOGO,
  // ENPAB (Biologi)
  'Nutrizionista': CONFIG_NUTRIZIONISTA,
  // INPS gestione separata (prof. sanitarie)
  'Dietista': CONFIG_DIETISTA,
  'Logopedista': CONFIG_LOGOPEDISTA,
  'Fisioterapista': CONFIG_FISIOTERAPISTA,
  'Terapista Occupazionale': CONFIG_TERAPISTA_OCCUPAZIONALE,
  'Infermiere': CONFIG_INFERMIERE,
  'Neuropsicomotricista': CONFIG_NEUROPSICOMOTRICISTA,
  'Osteopata': CONFIG_OSTEOPATA,
  // Altre
  'Assistente Sociale': CONFIG_ASSISTENTE_SOCIALE,
  'Educatore Professionale': CONFIG_EDUCATORE_PROFESSIONALE,
  'Sessuologo': CONFIG_SESSUOLOGO,
};

// Lookup case-insensitive
const CONFIGURAZIONI_LOWER = Object.fromEntries(
  Object.entries(CONFIGURAZIONI_FISCALI).map(([k, v]) => [k.toLowerCase(), v])
);

/**
 * Restituisce la configurazione fiscale per una professione.
 * Fallback a config generica se la professione non ha una configurazione dedicata.
 */
export function getConfigFiscale(professione: string): ConfigFiscaleProfessione {
  return CONFIGURAZIONI_LOWER[professione.toLowerCase()] || CONFIG_GENERICA;
}

/**
 * Restituisce le professioni che hanno una configurazione fiscale disponibile.
 */
export function getProfessioniConFatturazione(): string[] {
  return Object.keys(CONFIGURAZIONI_FISCALI);
}

/**
 * Restituisce le prestazioni pre-configurate per una professione.
 */
export function getPrestazioniProfessione(professione: string): PrestazionePreconfigurata[] {
  return CONFIGURAZIONI_FISCALI[professione]?.prestazioni ?? [];
}
