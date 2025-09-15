// A sample of Italian municipalities with their provinces and regions
// This is a truncated list - in a real app, you might want to include all ~8000+ municipalities

export interface ItalianMunicipality {
  id: string;
  nome: string;
  regione: {
    nome: string;
  };
  provincia: {
    nome: string;
    sigla: string;
  };
  sigla: string;
  codice: string;
}

export const italianMunicipalities: ItalianMunicipality[] = [
  {
    id: 'a001',
    nome: 'Roma',
    regione: { nome: 'Lazio' },
    provincia: { nome: 'Roma', sigla: 'RM' },
    sigla: 'RM',
    codice: 'H501'
  },
  {
    id: 'a002',
    nome: 'Milano',
    regione: { nome: 'Lombardia' },
    provincia: { nome: 'Milano', sigla: 'MI' },
    sigla: 'MI',
    codice: 'F205'
  },
  {
    id: 'a003',
    nome: 'Napoli',
    regione: { nome: 'Campania' },
    provincia: { nome: 'Napoli', sigla: 'NA' },
    sigla: 'NA',
    codice: 'F839'
  },
  {
    id: 'a004',
    nome: 'Torino',
    regione: { nome: 'Piemonte' },
    provincia: { nome: 'Torino', sigla: 'TO' },
    sigla: 'TO',
    codice: 'L219'
  },
  {
    id: 'a005',
    nome: 'Palermo',
    regione: { nome: 'Sicilia' },
    provincia: { nome: 'Palermo', sigla: 'PA' },
    sigla: 'PA',
    codice: 'G273'
  },
  {
    id: 'a006',
    nome: 'Firenze',
    regione: { nome: 'Toscana' },
    provincia: { nome: 'Firenze', sigla: 'FI' },
    sigla: 'FI',
    codice: 'D612'
  },
  {
    id: 'a007',
    nome: 'Bologna',
    regione: { nome: 'Emilia-Romagna' },
    provincia: { nome: 'Bologna', sigla: 'BO' },
    sigla: 'BO',
    codice: 'A944'
  },
  {
    id: 'a008',
    nome: 'Venezia',
    regione: { nome: 'Veneto' },
    provincia: { nome: 'Venezia', sigla: 'VE' },
    sigla: 'VE',
    codice: 'L736'
  },
  {
    id: 'a009',
    nome: 'Genova',
    regione: { nome: 'Liguria' },
    provincia: { nome: 'Genova', sigla: 'GE' },
    sigla: 'GE',
    codice: 'D969'
  },
  {
    id: 'a010',
    nome: 'Bari',
    regione: { nome: 'Puglia' },
    provincia: { nome: 'Bari', sigla: 'BA' },
    sigla: 'BA',
    codice: 'A662'
  }
  // Add more cities as needed, or use a complete dataset
];
