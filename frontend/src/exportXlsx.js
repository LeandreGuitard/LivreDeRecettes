import * as XLSX from 'xlsx';

function telechargerClasseur(classeur, nomFichier) {
  XLSX.writeFile(classeur, nomFichier);
}

export function exporterRecette(recette, composants, etapes, calculs) {
  const classeur = XLSX.utils.book_new();

  const feuilleInfo = XLSX.utils.json_to_sheet([
    {
      Nom: recette.nom,
      Type: recette.type_nom,
      Portions: recette.portions_base,
      Description: recette.description || '',
      'Coût estimé (€)': calculs?.cout_estime ?? '',
      'Temps actif (min)': calculs?.temps_actif_min ?? '',
      'Temps de repos (min)': calculs?.temps_inactif_min ?? '',
    },
  ]);
  XLSX.utils.book_append_sheet(classeur, feuilleInfo, 'Recette');

  const feuilleIngredients = XLSX.utils.json_to_sheet(
    composants.map((c) => ({
      Nom: c.nom,
      Type: c.type === 'ingredient' ? 'Ingrédient' : 'Sous-recette',
      Quantité: c.quantite,
    }))
  );
  XLSX.utils.book_append_sheet(classeur, feuilleIngredients, 'Ingrédients');

  const feuilleEtapes = XLSX.utils.json_to_sheet(
    etapes.map((e) => ({
      Description: e.description,
      'Temps actif (min)': e.duree_active_min,
      'Temps de repos (min)': e.delai_attente_min,
      Ressources: e.ressources.map((r) => r.nom).join(', '),
    }))
  );
  XLSX.utils.book_append_sheet(classeur, feuilleEtapes, 'Étapes');

  telechargerClasseur(classeur, `${recette.nom}.xlsx`);
}

export function exporterPlanning(dateCible, calendrier, listeCourses) {
  const classeur = XLSX.utils.book_new();

  const feuilleCalendrier = XLSX.utils.json_to_sheet(
    calendrier.map((e) => ({
      Début: new Date(e.debut).toLocaleString('fr-FR'),
      Fin: new Date(e.fin).toLocaleString('fr-FR'),
      Recette: e.recette_nom,
      Étape: e.description,
      'Temps actif (min)': e.duree_active_min,
      'Temps de repos (min)': e.delai_attente_min,
      Ressources: e.ressources.map((r) => r.nom).join(', '),
    }))
  );
  XLSX.utils.book_append_sheet(classeur, feuilleCalendrier, 'Calendrier');

  const feuilleCourses = XLSX.utils.json_to_sheet(
    listeCourses.map((i) => ({
      Ingrédient: i.nom,
      Quantité: i.quantite,
      Unité: i.unite,
    }))
  );
  XLSX.utils.book_append_sheet(classeur, feuilleCourses, 'Liste de courses');

  const nomFichier = `repas-${new Date(dateCible)
    .toISOString()
    .slice(0, 10)}.xlsx`;
  telechargerClasseur(classeur, nomFichier);
}
