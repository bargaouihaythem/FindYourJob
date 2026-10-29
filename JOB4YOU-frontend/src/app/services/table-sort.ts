/**
 * Tri de tableau partagé : mêmes flèches que la page « Candidats », étendu aux colonnes de dates.
 * Une colonne de dates s'ouvre toujours sur les éléments les plus récents, une colonne de texte
 * sur l'ordre alphabétique — c'est le sens qui répond à la question posée par l'utilisateur.
 */
export type SortOrder = 'asc' | 'desc';

const COLONNE_DATE = /(date|sentat|performedat|updatedat|createdat|time)/i;

/** Sens d'ouverture d'une colonne : les dates démarrent sur le plus récent, le texte sur l'ordre alphabétique. */
export function defaultOrderFor(field: string): SortOrder {
  return COLONNE_DATE.test(field) ? 'desc' : 'asc';
}

export class TableSort {
  field: string;
  order: SortOrder;

  constructor(field: string, order: SortOrder = 'desc') {
    this.field = field;
    this.order = order;
  }

  toggle(field: string): void {
    if (this.field === field) {
      this.order = this.order === 'asc' ? 'desc' : 'asc';
    } else {
      this.field = field;
      this.order = defaultOrderFor(field);
    }
  }

  icon(field: string): string {
    if (this.field !== field) return 'fas fa-sort';
    return this.order === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
  }

  isActive(field: string): boolean {
    return this.field === field;
  }

  /** Tri sans mutation : les lignes affichées restent le tableau de référence du service. */
  apply<T>(rows: T[]): T[] {
    const cle = this.field as keyof T;
    const signe = this.order === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = valeur(a?.[cle]);
      const y = valeur(b?.[cle]);
      // Une valeur manquante ne remonte jamais en tête d'une colonne décroissante.
      if (x === null && y === null) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      if (x < y) return -signe;
      if (x > y) return signe;
      return 0;
    });
  }
}

function valeur(v: unknown): string | number | null {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number' || typeof v === 'boolean') return Number(v);
  if (typeof v === 'string') return v;
  return String(v);
}
