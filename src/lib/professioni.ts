// Configurazione delle professioni e documenti richiesti per la verifica

export interface DocumentoRichiesto {
  tipo: 'albo' | 'certificato' | 'altro';
  nome: string;
  obbligatorio: boolean;
  placeholder?: string;
  descrizione?: string;
}

export interface ConfigurazioneProfessione {
  nome: string;
  hasAlbo: boolean; // True se la professione ha un albo professionale
  documentiRichiesti: DocumentoRichiesto[];
  tematiche: string[]; // Tematiche specifiche per questa professione
  noteAggiuntive?: string; // Informazioni aggiuntive per l'utente
}

// Configurazione delle professioni disponibili
export const CONFIGURAZIONI_PROFESSIONI: Record<string, ConfigurazioneProfessione> = {
  'Psicologo': {
    nome: 'Psicologo',
    hasAlbo: true,
    tematiche: [
      'Sostegno psicologico',
      'Valutazione psicologica e psicodiagnostica',
      'Psicologia scolastica',
      'Psicologia del lavoro e delle organizzazioni',
      'Psicologia di comunità e prevenzione',
      'Psicologia giuridica',
      'Psicoeducazione',
      'Mindfulness'
    ],
    documentiRichiesti: [
      {
        tipo: 'albo',
        nome: 'Numero iscrizione Albo degli Psicologi',
        obbligatorio: true,
        placeholder: 'es. 12345',
        descrizione: 'Inserisci il numero di iscrizione all\'Albo degli Psicologi della tua regione'
      },
      {
        tipo: 'albo',
        nome: 'Sezione Albo (A o B)',
        obbligatorio: true,
        placeholder: 'A o B',
        descrizione: 'Sezione A: Laurea magistrale/vecchio ordinamento. Sezione B: Laurea triennale'
      }
    ],
    noteAggiuntive: 'Verranno verificati i dati presso l\'Albo regionale di appartenenza'
  },
  
  'Psicoterapeuta': {
    nome: 'Psicoterapeuta',
    hasAlbo: true,
    tematiche: [
      'Disturbi d\'ansia',
      'Depressione',
      'Disturbi alimentari',
      'Trauma e PTSD',
      'Dipendenze',
      'Disturbi di personalità',
      'Disturbi dell\'umore',
      'Terapia di coppia',
      'Terapia familiare',
      'Terapia cognitivo-comportamentale',
      'Terapia psicodinamica',
      'Terapia sistemico-relazionale',
      'EMDR',
      'Schema Therapy',
      'ACT (Acceptance and Commitment Therapy)',
      'Problemi della sfera sessuale'
    ],
    documentiRichiesti: [
      {
        tipo: 'albo',
        nome: 'Numero iscrizione Albo degli Psicologi',
        obbligatorio: true,
        placeholder: 'es. 12345',
        descrizione: 'Inserisci il numero di iscrizione all\'Albo degli Psicologi'
      },
      {
        tipo: 'certificato',
        nome: 'Specializzazione in Psicoterapia',
        obbligatorio: true,
        placeholder: 'Nome scuola e anno conseguimento',
        descrizione: 'Scuola di specializzazione e anno di conseguimento del titolo'
      }
    ],
    noteAggiuntive: 'È richiesta la specializzazione post-lauream in psicoterapia'
  },
  
  'Psichiatra': {
    nome: 'Psichiatra',
    hasAlbo: true,
    tematiche: [
      'Disturbi d\'ansia',
      'Depressione e disturbi dell\'umore',
      'Disturbi psicotici',
      'Disturbo bipolare',
      'Disturbi di personalità',
      'Dipendenze e abuso di sostanze',
      'Disturbi del sonno',
      'Disturbi alimentari',
      'ADHD',
      'Disturbi dello spettro autistico',
      'Psicofarmacologia',
      'Psichiatria di emergenza',
      'Psichiatria infantile',
      'Neuropsichiatria'
    ],
    documentiRichiesti: [
      {
        tipo: 'albo',
        nome: 'Numero iscrizione Ordine dei Medici',
        obbligatorio: true,
        placeholder: 'es. 12345',
        descrizione: 'Inserisci il numero di iscrizione all\'Ordine dei Medici della tua provincia'
      },
      {
        tipo: 'certificato',
        nome: 'Specializzazione in Psichiatria',
        obbligatorio: true,
        placeholder: 'Anno conseguimento',
        descrizione: 'Anno di conseguimento della specializzazione in Psichiatria'
      }
    ]
  },
  
  'Nutrizionista': {
    nome: 'Nutrizionista',
    hasAlbo: true,
    tematiche: [
      'Diete dimagranti',
      'Nutrizione sportiva',
      'Disturbi alimentari',
      'Diabete e alimentazione',
      'Alimentazione in gravidanza',
      'Nutrizione pediatrica',
      'Intolleranze e allergie alimentari',
      'Nutrizione vegetariana/vegana',
      'Obesità',
      'Nutrizione oncologica',
      'Malattie cardiovascolari',
      'Educazione alimentare'
    ],
    documentiRichiesti: [
      {
        tipo: 'albo',
        nome: 'Numero iscrizione Ordine dei Biologi (Sez. A)',
        obbligatorio: true,
        placeholder: 'es. AA_12345',
        descrizione: 'Numero iscrizione all\'Ordine Nazionale dei Biologi, Sezione A'
      }
    ],
    noteAggiuntive: 'Solo biologi iscritti alla Sezione A possono esercitare come nutrizionisti'
  },
  
  'Dietista': {
    nome: 'Dietista',
    hasAlbo: true,
    tematiche: [
      'Diete dimagranti',
      'Nutrizione clinica',
      'Diabete e alimentazione',
      'Malattie renali',
      'Malattie cardiovascolari',
      'Nutrizione enterale e parenterale',
      'Intolleranze alimentari',
      'Nutrizione pediatrica',
      'Nutrizione geriatrica',
      'Nutrizione sportiva',
      'Obesità',
      'Educazione alimentare'
    ],
    documentiRichiesti: [
      {
        tipo: 'albo',
        nome: 'Numero iscrizione Ordine TSRM e PSTRP',
        obbligatorio: true,
        placeholder: 'es. 12345',
        descrizione: 'Numero iscrizione all\'Ordine dei Tecnici Sanitari di Radiologia Medica e delle Professioni Sanitarie Tecniche, della Riabilitazione e della Prevenzione'
      }
    ]
  },
  
  'Dietologo': {
    nome: 'Dietologo',
    hasAlbo: true,
    tematiche: [
      'Diete terapeutiche',
      'Obesità',
      'Disturbi metabolici',
      'Diabete',
      'Malattie cardiovascolari',
      'Nutrizione clinica',
      'Chirurgia bariatrica',
      'Nutrizione enterale',
      'Intolleranze alimentari',
      'Allergie alimentari',
      'Nutrizione preventiva'
    ],
    documentiRichiesti: [
      {
        tipo: 'albo',
        nome: 'Numero iscrizione Ordine dei Medici',
        obbligatorio: true,
        placeholder: 'es. 12345',
        descrizione: 'Inserisci il numero di iscrizione all\'Ordine dei Medici'
      },
      {
        tipo: 'certificato',
        nome: 'Specializzazione in Scienza dell\'Alimentazione',
        obbligatorio: false,
        placeholder: 'Anno conseguimento (opzionale)',
        descrizione: 'Se specializzato, indica l\'anno di conseguimento'
      }
    ]
  },
  
  'Assistente Sociale': {
    nome: 'Assistente Sociale',
    hasAlbo: true,
    tematiche: [
      'Minori e famiglia',
      'Anziani',
      'Disabilità',
      'Dipendenze',
      'Salute mentale',
      'Immigrazione',
      'Violenza di genere',
      'Povertà ed esclusione sociale',
      'Tutela e curatela',
      'Mediazione familiare',
      'Affido e adozione',
      'Servizi territoriali'
    ],
    documentiRichiesti: [
      {
        tipo: 'albo',
        nome: 'Numero iscrizione Ordine Assistenti Sociali',
        obbligatorio: true,
        placeholder: 'es. 12345',
        descrizione: 'Numero iscrizione all\'Ordine degli Assistenti Sociali della tua regione'
      },
      {
        tipo: 'albo',
        nome: 'Sezione Albo (A o B)',
        obbligatorio: true,
        placeholder: 'A o B',
        descrizione: 'Sezione A: Laurea magistrale. Sezione B: Laurea triennale'
      }
    ]
  },
  
  'Educatore Professionale': {
    nome: 'Educatore Professionale',
    hasAlbo: true,
    tematiche: [
      'Minori e adolescenti',
      'Disabilità intellettiva',
      'Autismo',
      'Salute mentale',
      'Dipendenze',
      'Anziani',
      'Reinserimento sociale',
      'Comunità terapeutiche',
      'Servizi domiciliari',
      'Centri diurni',
      'Progetti educativi individualizzati'
    ],
    documentiRichiesti: [
      {
        tipo: 'albo',
        nome: 'Numero iscrizione Ordine TSRM e PSTRP',
        obbligatorio: true,
        placeholder: 'es. 12345',
        descrizione: 'Numero iscrizione all\'Ordine TSRM e PSTRP (per educatori sanitari)'
      }
    ],
    noteAggiuntive: 'Obbligo di iscrizione all\'albo per educatori professionali sanitari (L. 3/2018)'
  },
  
  'Logopedista': {
    nome: 'Logopedista',
    hasAlbo: true,
    tematiche: [
      'Disturbi del linguaggio',
      'Disturbi della voce',
      'Deglutizione e disfagia',
      'Balbuzie',
      'Disturbi specifici dell\'apprendimento (DSA)',
      'Riabilitazione post-ictus',
      'Afasia',
      'Disturbi articolatori',
      'Sordità',
      'Logopedia pediatrica',
      'Logopedia geriatrica'
    ],
    documentiRichiesti: [
      {
        tipo: 'albo',
        nome: 'Numero iscrizione Ordine TSRM e PSTRP',
        obbligatorio: true,
        placeholder: 'es. 12345',
        descrizione: 'Numero iscrizione all\'Ordine dei Tecnici Sanitari'
      }
    ]
  },
  
  'Fisioterapista': {
    nome: 'Fisioterapista',
    hasAlbo: true,
    tematiche: [
      'Riabilitazione ortopedica',
      'Riabilitazione neurologica',
      'Riabilitazione respiratoria',
      'Riabilitazione cardiovascolare',
      'Riabilitazione sportiva',
      'Terapia manuale',
      'Dolore cronico',
      'Postura',
      'Riabilitazione post-chirurgica',
      'Fisioterapia pediatrica',
      'Fisioterapia geriatrica',
      'Linfodrenaggio'
    ],
    documentiRichiesti: [
      {
        tipo: 'albo',
        nome: 'Numero iscrizione Ordine TSRM e PSTRP',
        obbligatorio: true,
        placeholder: 'es. 12345',
        descrizione: 'Numero iscrizione all\'Ordine dei Tecnici Sanitari'
      }
    ]
  },
  
  'Terapista Occupazionale': {
    nome: 'Terapista Occupazionale',
    hasAlbo: true,
    tematiche: [
      'Autonomia nelle attività quotidiane',
      'Riabilitazione neurologica',
      'Riabilitazione ortopedica',
      'Adattamento ambientale',
      'Ausili e tecnologie assistive',
      'Riabilitazione pediatrica',
      'Geriatria',
      'Salute mentale',
      'Riabilitazione della mano',
      'Integrazione sensoriale',
      'Ritorno al lavoro'
    ],
    documentiRichiesti: [
      {
        tipo: 'albo',
        nome: 'Numero iscrizione Ordine TSRM e PSTRP',
        obbligatorio: true,
        placeholder: 'es. 12345',
        descrizione: 'Numero iscrizione all\'Ordine dei Tecnici Sanitari'
      }
    ]
  },
  
  'Infermiere': {
    nome: 'Infermiere',
    hasAlbo: true,
    tematiche: [
      'Assistenza domiciliare',
      'Wound care (gestione lesioni)',
      'Cure palliative',
      'Stomie e incontinenza',
      'Gestione del dolore',
      'Nutrizione enterale',
      'Infermieristica pediatrica',
      'Infermieristica geriatrica',
      'Educazione sanitaria',
      'Prevenzione',
      'Riabilitazione',
      'Assistenza post-operatoria'
    ],
    documentiRichiesti: [
      {
        tipo: 'albo',
        nome: 'Numero iscrizione Ordine delle Professioni Infermieristiche (OPI)',
        obbligatorio: true,
        placeholder: 'es. 12345',
        descrizione: 'Numero iscrizione all\'Ordine delle Professioni Infermieristiche'
      }
    ]
  },
  
  'Medico di Base': {
    nome: 'Medico di Base',
    hasAlbo: true,    tematiche: [
      'Medicina generale',
      'Pediatria',
      'Geriatria',
      'Malattie croniche',
      'Diabete',
      'Ipertensione',
      'Malattie cardiovascolari',
      'Malattie respiratorie',
      'Prevenzione e screening',
      'Vaccinazioni',
      'Medicina preventiva',
      'Assistenza domiciliare'
    ],    documentiRichiesti: [
      {
        tipo: 'albo',
        nome: 'Numero iscrizione Ordine dei Medici',
        obbligatorio: true,
        placeholder: 'es. 12345',
        descrizione: 'Numero iscrizione all\'Ordine dei Medici'
      }
    ]
  },
  
  'Medico Specialista': {
    nome: 'Medico Specialista',
    hasAlbo: true,
    tematiche: [
      'Cardiologia',
      'Dermatologia',
      'Endocrinologia',
      'Gastroenterologia',
      'Neurologia',
      'Oncologia',
      'Ortopedia',
      'Otorinolaringoiatria',
      'Pneumologia',
      'Reumatologia',
      'Urologia',
      'Altre specializzazioni'
    ],
    documentiRichiesti: [
      {
        tipo: 'albo',
        nome: 'Numero iscrizione Ordine dei Medici',
        obbligatorio: true,
        placeholder: 'es. 12345',
        descrizione: 'Numero iscrizione all\'Ordine dei Medici'
      },
      {
        tipo: 'certificato',
        nome: 'Specializzazione medica',
        obbligatorio: true,
        placeholder: 'Nome specializzazione',
        descrizione: 'Indica la tua specializzazione medica'
      }
    ]
  },
  
  'Ginecologo': {
    nome: 'Ginecologo',
    hasAlbo: true,
    tematiche: [
      'Gravidanza e parto',
      'Ginecologia oncologica',
      'Endocrinologia ginecologica',
      'Menopausa',
      'Fertilità e procreazione assistita',
      'Contraccezione',
      'Patologie dell\'utero e ovaie',
      'Endometriosi',
      'Disturbi del ciclo mestruale',
      'Ecografia ostetrica',
      'Medicina feto-maternale',
      'Chirurgia ginecologica'
    ],
    documentiRichiesti: [
      {
        tipo: 'albo',
        nome: 'Numero iscrizione Ordine dei Medici',
        obbligatorio: true,
        placeholder: 'es. 12345',
        descrizione: 'Numero iscrizione all\'Ordine dei Medici'
      },
      {
        tipo: 'certificato',
        nome: 'Specializzazione in Ginecologia e Ostetricia',
        obbligatorio: true,
        placeholder: 'Anno conseguimento',
        descrizione: 'Anno conseguimento specializzazione'
      }
    ]
  },
  
  'Andrologo': {
    nome: 'Andrologo',
    hasAlbo: true,
    tematiche: [
      'Disfunzione erettile',
      'Eiaculazione precoce',
      'Infertilità maschile',
      'Ipogonadismo',
      'Varicocele',
      'Malattie sessualmente trasmissibili',
      'Tumore prostatico',
      'Andropausa',
      'Disturbi ormonali maschili',
      'Chirurgia andrologica'
    ],
    documentiRichiesti: [
      {
        tipo: 'albo',
        nome: 'Numero iscrizione Ordine dei Medici',
        obbligatorio: true,
        placeholder: 'es. 12345',
        descrizione: 'Numero iscrizione all\'Ordine dei Medici'
      },
      {
        tipo: 'certificato',
        nome: 'Specializzazione in Andrologia o Urologia',
        obbligatorio: true,
        placeholder: 'Nome specializzazione e anno',
        descrizione: 'Specializzazione in Andrologia o Urologia'
      }
    ]
  },
  
  'Sessuologo': {
    nome: 'Sessuologo',
    hasAlbo: false,
    tematiche: [
      'Disfunzioni sessuali',
      'Desiderio sessuale',
      'Terapia di coppia sessuale',
      'Educazione sessuale',
      'Identità di genere',
      'Orientamento sessuale',
      'Disforia di genere',
      'Trauma sessuale',
      'Dipendenza sessuale',
      'Vaginismo e dispareunia',
      'Consulenza di coppia'
    ],
    documentiRichiesti: [
      {
        tipo: 'certificato',
        nome: 'Titolo di base (Medico, Psicologo, ecc.)',
        obbligatorio: true,
        placeholder: 'es. Psicologo',
        descrizione: 'Professione di base (deve essere sanitaria abilitata)'
      },
      {
        tipo: 'albo',
        nome: 'Numero iscrizione Albo professione base',
        obbligatorio: true,
        placeholder: 'es. 12345',
        descrizione: 'Numero iscrizione all\'albo della professione di base'
      },
      {
        tipo: 'certificato',
        nome: 'Formazione in Sessuologia',
        obbligatorio: true,
        placeholder: 'Nome scuola/corso e anno',
        descrizione: 'Master o specializzazione in Sessuologia clinica'
      }
    ],
    noteAggiuntive: 'Il sessuologo deve essere un professionista sanitario (medico, psicologo, ecc.) con formazione specifica'
  }
};

// Lista delle professioni disponibili (per dropdown)
const PROFESSIONI_BLOCCATE_MVP = new Set([
  'Dietista',
  'Assistente Sociale',
  'Educatore Professionale',
  'Fisioterapista',
  'Terapista Occupazionale',
  'Infermiere',
  'Medico di Base',
  'Medico Specialista',
  'Ginecologo',
  'Andrologo',
  'Sessuologo'
]);

export const PROFESSIONI_DISPONIBILI = Object.keys(CONFIGURAZIONI_PROFESSIONI)
  .filter((professione) => !PROFESSIONI_BLOCCATE_MVP.has(professione))
  .sort();

// Helper per ottenere la configurazione di una professione
export function getConfigurazioneProfessione(professione: string): ConfigurazioneProfessione | undefined {
  if (PROFESSIONI_BLOCCATE_MVP.has(professione)) {
    return undefined;
  }
  return CONFIGURAZIONI_PROFESSIONI[professione];
}
