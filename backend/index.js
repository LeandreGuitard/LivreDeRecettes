const express = require('express');
const cors = require('cors');
const { initDB, getDB, sauvegarder } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ---------- HELPERS PARTAGES (recettes, étapes, alternatives) ----------

// Parmi un groupe d'étapes alternatives (même groupe_alternatif), on retient la plus rapide
function selectionnerAlternatives(etapes) {
  const groupes = {};
  etapes.forEach((e) => {
    const cle = e.groupe_alternatif ?? `seule-${e.id}`;
    if (!groupes[cle]) groupes[cle] = [];
    groupes[cle].push(e);
  });
  return Object.values(groupes).map((options) =>
    options.reduce((meilleure, actuelle) => {
      const dureeActuelle =
        actuelle.duree_active_min + actuelle.delai_attente_min;
      const dureeMeilleure =
        meilleure.duree_active_min + meilleure.delai_attente_min;
      return dureeActuelle < dureeMeilleure ? actuelle : meilleure;
    })
  );
}

// Parmi les lignes d'ingrédients d'une étape partageant un même groupe_alternatif, on n'en retient qu'une
function selectionnerAlternativesComposants(lignes, etapeId) {
  const groupes = {};
  lignes.forEach((l) => {
    const cle =
      l.groupe_alternatif ??
      `seule-${l.ingredient_id ?? 's' + l.sous_recette_id}-${etapeId}`;
    if (!groupes[cle]) groupes[cle] = l; // on garde la première option rencontrée
  });
  return Object.values(groupes);
}

function chargerEtapesRecette(db, recetteId) {
  const resultat = db.exec(
    'SELECT id, description, duree_active_min, delai_attente_min, groupe_alternatif FROM etapes WHERE recette_id = ?',
    [recetteId]
  );
  if (resultat.length === 0) return [];

  const colonnes = resultat[0].columns;
  return resultat[0].values.map((valeurs) => {
    const etape = Object.fromEntries(
      colonnes.map((col, i) => [col, valeurs[i]])
    );

    const resDep = db.exec(
      'SELECT depend_de_etape_id FROM etapes_dependances WHERE etape_id = ?',
      [etape.id]
    );
    etape.depend_de =
      resDep.length === 0 ? [] : resDep[0].values.map((v) => v[0]);

    const resRess = db.exec(
      `
      SELECT ressources.id, ressources.nom
      FROM ressources
      JOIN etapes_ressources ON ressources.id = etapes_ressources.ressource_id
      WHERE etapes_ressources.etape_id = ?
    `,
      [etape.id]
    );
    etape.ressources =
      resRess.length === 0
        ? []
        : resRess[0].values.map((v) => ({ id: v[0], nom: v[1] }));

    return etape;
  });
}

function chargerComposantsEtape(db, etapeId) {
  const resultat = db.exec(
    `
    SELECT etape_composants.id, etape_composants.quantite, etape_composants.groupe_alternatif,
           etape_composants.ingredient_id, etape_composants.sous_recette_id,
           ingredients.nom AS ingredient_nom,
           recettes.nom AS sous_recette_nom
    FROM etape_composants
    LEFT JOIN ingredients ON etape_composants.ingredient_id = ingredients.id
    LEFT JOIN recettes ON etape_composants.sous_recette_id = recettes.id
    WHERE etape_composants.etape_id = ?
  `,
    [etapeId]
  );
  if (resultat.length === 0) return [];

  const colonnes = resultat[0].columns;
  return resultat[0].values.map((valeurs) => {
    const c = Object.fromEntries(colonnes.map((col, i) => [col, valeurs[i]]));
    c.nom = c.ingredient_nom ?? c.sous_recette_nom;
    c.type = c.ingredient_nom ? 'ingredient' : 'sous_recette';
    return c;
  });
}

// ---------- RECETTES ----------

app.get('/recettes', (req, res) => {
  const db = getDB();
  const resultat = db.exec(`
    SELECT recettes.id, recettes.nom, recettes.portions_base, recettes.description,
           types_recette.nom AS type_nom
    FROM recettes
    JOIN types_recette ON recettes.type_id = types_recette.id
  `);

  if (resultat.length === 0) return res.json([]);
  const colonnes = resultat[0].columns;
  res.json(
    resultat[0].values.map((v) =>
      Object.fromEntries(colonnes.map((col, i) => [col, v[i]]))
    )
  );
});

app.get('/recettes/:id', (req, res) => {
  const db = getDB();
  const id = req.params.id;

  const resultatRecette = db.exec(
    `
    SELECT recettes.id, recettes.nom, recettes.type_id, recettes.portions_base, recettes.description,
           types_recette.nom AS type_nom
    FROM recettes
    JOIN types_recette ON recettes.type_id = types_recette.id
    WHERE recettes.id = ?
  `,
    [id]
  );

  if (resultatRecette.length === 0) {
    return res.status(404).json({ erreur: 'Recette introuvable' });
  }

  const colonnes = resultatRecette[0].columns;
  const valeurs = resultatRecette[0].values[0];
  const recette = Object.fromEntries(
    colonnes.map((col, i) => [col, valeurs[i]])
  );

  const resultatTags = db.exec(
    `
    SELECT tags.id, tags.nom
    FROM tags
    JOIN recettes_tags ON tags.id = recettes_tags.tag_id
    WHERE recettes_tags.recette_id = ?
  `,
    [id]
  );

  recette.tags =
    resultatTags.length === 0
      ? []
      : resultatTags[0].values.map((v) => ({ id: v[0], nom: v[1] }));

  res.json(recette);
});

app.post('/recettes', (req, res) => {
  const db = getDB();
  const { nom, type_id, portions_base, description, tags } = req.body;

  db.run(
    'INSERT INTO recettes (nom, type_id, portions_base, description) VALUES (?, ?, ?, ?)',
    [nom, type_id, portions_base, description]
  );

  const nouvelId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];

  if (Array.isArray(tags)) {
    tags.forEach((tagId) => {
      db.run('INSERT INTO recettes_tags (recette_id, tag_id) VALUES (?, ?)', [
        nouvelId,
        tagId,
      ]);
    });
  }

  sauvegarder();
  res.status(201).json({ message: 'Recette créée', id: nouvelId });
});

app.put('/recettes/:id', (req, res) => {
  const db = getDB();
  const id = req.params.id;

  const existante = db.exec('SELECT * FROM recettes WHERE id = ?', [id]);
  if (existante.length === 0) {
    return res.status(404).json({ erreur: 'Recette introuvable' });
  }

  const colonnes = existante[0].columns;
  const valeurs = existante[0].values[0];
  const recetteActuelle = Object.fromEntries(
    colonnes.map((col, i) => [col, valeurs[i]])
  );

  const nom = req.body.nom ?? recetteActuelle.nom;
  const type_id = req.body.type_id ?? recetteActuelle.type_id;
  const portions_base = req.body.portions_base ?? recetteActuelle.portions_base;
  const description = req.body.description ?? recetteActuelle.description;

  db.run(
    'UPDATE recettes SET nom = ?, type_id = ?, portions_base = ?, description = ? WHERE id = ?',
    [nom, type_id, portions_base, description, id]
  );

  if (Array.isArray(req.body.tags)) {
    db.run('DELETE FROM recettes_tags WHERE recette_id = ?', [id]);
    req.body.tags.forEach((tagId) => {
      db.run('INSERT INTO recettes_tags (recette_id, tag_id) VALUES (?, ?)', [
        id,
        tagId,
      ]);
    });
  }

  sauvegarder();
  res.json({ message: 'Recette modifiée' });
});

app.delete('/recettes/:id', (req, res) => {
  const db = getDB();
  const id = req.params.id;

  const etapesRes = db.exec('SELECT id FROM etapes WHERE recette_id = ?', [id]);
  if (etapesRes.length > 0) {
    etapesRes[0].values.forEach(([etapeId]) => {
      db.run('DELETE FROM etape_composants WHERE etape_id = ?', [etapeId]);
      db.run('DELETE FROM etapes_ressources WHERE etape_id = ?', [etapeId]);
      db.run(
        'DELETE FROM etapes_dependances WHERE etape_id = ? OR depend_de_etape_id = ?',
        [etapeId, etapeId]
      );
      db.run('DELETE FROM etapes WHERE id = ?', [etapeId]);
    });
  }

  // Nettoie aussi les usages de cette recette comme sous-recette ailleurs
  db.run('DELETE FROM etape_composants WHERE sous_recette_id = ?', [id]);
  db.run('DELETE FROM recettes_tags WHERE recette_id = ?', [id]);
  db.run('DELETE FROM recettes WHERE id = ?', [id]);
  sauvegarder();

  res.status(204).send();
});

// ---------- CYCLES, CALCULS (coût / temps récursifs) ----------

function contientRecette(
  db,
  recetteDepart,
  recetteCherchee,
  visitees = new Set()
) {
  if (Number(recetteDepart) === Number(recetteCherchee)) return true;
  if (visitees.has(Number(recetteDepart))) return false;
  visitees.add(Number(recetteDepart));

  const composants = db.exec(
    `
    SELECT etape_composants.sous_recette_id
    FROM etape_composants
    JOIN etapes ON etape_composants.etape_id = etapes.id
    WHERE etapes.recette_id = ? AND etape_composants.sous_recette_id IS NOT NULL
  `,
    [recetteDepart]
  );
  if (composants.length === 0) return false;

  return composants[0].values.some(([sousId]) =>
    contientRecette(db, sousId, recetteCherchee, visitees)
  );
}

function calculerRecette(db, recetteId, dejaVisitees = new Set()) {
  if (dejaVisitees.has(Number(recetteId))) {
    throw new Error(
      `Cycle détecté : la recette ${recetteId} se référence elle-même`
    );
  }
  dejaVisitees.add(Number(recetteId));

  const etapesRetenues = selectionnerAlternatives(
    chargerEtapesRecette(db, recetteId)
  );

  let cout = 0;
  let tempsActif = 0;
  let tempsInactif = 0;
  const sousRecettesAAjouter = [];

  etapesRetenues.forEach((etape) => {
    tempsActif += etape.duree_active_min;
    tempsInactif += etape.delai_attente_min;

    const lignes = chargerComposantsEtape(db, etape.id);
    const lignesRetenues = selectionnerAlternativesComposants(lignes, etape.id);

    lignesRetenues.forEach((l) => {
      if (l.ingredient_id) {
        const ingRes = db.exec(
          'SELECT prix_moyen FROM ingredients WHERE id = ?',
          [l.ingredient_id]
        );
        cout += l.quantite * ingRes[0].values[0][0];
      } else if (l.sous_recette_id) {
        sousRecettesAAjouter.push({
          id: l.sous_recette_id,
          quantite: l.quantite,
        });
      }
    });
  });

  sousRecettesAAjouter.forEach(({ id, quantite }) => {
    const sousCalcul = calculerRecette(db, id, new Set(dejaVisitees));
    const portionsRes = db.exec(
      'SELECT portions_base FROM recettes WHERE id = ?',
      [id]
    );
    const portionsBase = portionsRes[0].values[0][0] || 1;

    cout += (sousCalcul.cout / portionsBase) * quantite;
    tempsActif += sousCalcul.tempsActif;
    tempsInactif += sousCalcul.tempsInactif;
  });

  return { cout, tempsActif, tempsInactif };
}

app.get('/recettes/:id/calculs', (req, res) => {
  const db = getDB();
  try {
    const resultat = calculerRecette(db, req.params.id);
    res.json({
      cout_estime: Math.round(resultat.cout * 100) / 100,
      temps_actif_min: resultat.tempsActif,
      temps_inactif_min: resultat.tempsInactif,
      temps_total_min: resultat.tempsActif + resultat.tempsInactif,
    });
  } catch (erreur) {
    res.status(400).json({ erreur: erreur.message });
  }
});

// ---------- INGREDIENTS (catalogue) ----------

app.get('/ingredients', (req, res) => {
  const db = getDB();
  const resultat = db.exec(
    'SELECT id, nom, unite, prix_moyen FROM ingredients'
  );

  if (resultat.length === 0) return res.json([]);

  const colonnes = resultat[0].columns;
  const ingredients = resultat[0].values.map((valeurs) => {
    const ingredient = Object.fromEntries(
      colonnes.map((col, i) => [col, valeurs[i]])
    );

    const resultatLieux = db.exec(
      `
      SELECT lieux_achat.id, lieux_achat.nom
      FROM lieux_achat
      JOIN ingredients_lieux_achat ON lieux_achat.id = ingredients_lieux_achat.lieu_achat_id
      WHERE ingredients_lieux_achat.ingredient_id = ?
    `,
      [ingredient.id]
    );

    ingredient.lieux_achat =
      resultatLieux.length === 0
        ? []
        : resultatLieux[0].values.map((v) => ({ id: v[0], nom: v[1] }));

    return ingredient;
  });

  res.json(ingredients);
});

app.post('/ingredients', (req, res) => {
  const db = getDB();
  const { nom, unite, prix_moyen, lieux_achat_id } = req.body;

  db.run('INSERT INTO ingredients (nom, unite, prix_moyen) VALUES (?, ?, ?)', [
    nom,
    unite,
    prix_moyen,
  ]);
  const nouvelId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];

  if (Array.isArray(lieux_achat_id)) {
    lieux_achat_id.forEach((lieu_achat_id) => {
      db.run(
        'INSERT INTO ingredients_lieux_achat (ingredient_id, lieu_achat_id) VALUES (?, ?)',
        [nouvelId, lieu_achat_id]
      );
    });
  }

  sauvegarder();
  res.status(201).json({ message: 'Ingrédient créé', id: nouvelId });
});

app.put('/ingredients/:id', (req, res) => {
  const db = getDB();
  const id = req.params.id;

  const existant = db.exec('SELECT * FROM ingredients WHERE id = ?', [id]);
  if (existant.length === 0) {
    return res.status(404).json({ erreur: 'Ingrédient introuvable' });
  }

  const colonnes = existant[0].columns;
  const valeurs = existant[0].values[0];
  const ingredientActuel = Object.fromEntries(
    colonnes.map((col, i) => [col, valeurs[i]])
  );

  const nom = req.body.nom ?? ingredientActuel.nom;
  const unite = req.body.unite ?? ingredientActuel.unite;
  const prix_moyen = req.body.prix_moyen ?? ingredientActuel.prix_moyen;

  db.run(
    'UPDATE ingredients SET nom = ?, unite = ?, prix_moyen = ? WHERE id = ?',
    [nom, unite, prix_moyen, id]
  );

  if (Array.isArray(req.body.lieux_achat_id)) {
    db.run('DELETE FROM ingredients_lieux_achat WHERE ingredient_id = ?', [id]);
    req.body.lieux_achat_id.forEach((lieuId) => {
      db.run(
        'INSERT INTO ingredients_lieux_achat (ingredient_id, lieu_achat_id) VALUES (?, ?)',
        [id, lieuId]
      );
    });
  }

  sauvegarder();
  res.json({ message: 'Ingrédient modifié' });
});

app.delete('/ingredients/:id', (req, res) => {
  const db = getDB();
  const id = req.params.id;

  db.run('DELETE FROM ingredients_lieux_achat WHERE ingredient_id = ?', [id]);
  db.run('DELETE FROM ingredients WHERE id = ?', [id]);
  sauvegarder();

  res.status(204).send();
});

// ---------- INGREDIENTS D'UNE RECETTE (nouveau modèle) ----------

// Vue "recette" : addition des ingrédients de toutes les étapes (pas de récursion dans les sous-recettes)
app.get('/recettes/:id/ingredients-resume', (req, res) => {
  const db = getDB();
  const recetteId = req.params.id;

  const etapesRetenues = selectionnerAlternatives(
    chargerEtapesRecette(db, recetteId)
  );
  const cumul = {}; // clé = "ingredient-ID" ou "sous_recette-ID"

  etapesRetenues.forEach((etape) => {
    const lignes = chargerComposantsEtape(db, etape.id);
    const lignesRetenues = selectionnerAlternativesComposants(lignes, etape.id);

    lignesRetenues.forEach((l) => {
      const cle = l.ingredient_id
        ? `ingredient-${l.ingredient_id}`
        : `sous_recette-${l.sous_recette_id}`;
      if (!cumul[cle]) {
        cumul[cle] = {
          type: l.ingredient_id ? 'ingredient' : 'sous_recette',
          id: l.ingredient_id ?? l.sous_recette_id,
          nom: l.nom,
          quantite: 0,
        };
      }
      cumul[cle].quantite += l.quantite;
    });
  });

  res.json(Object.values(cumul));
});

// Vue "courses" : récursive, explose les sous-recettes jusqu'aux ingrédients de base, avec facteur de portions
function agregerIngredients(
  db,
  recetteId,
  facteurPortions,
  resultatMap = {},
  visitees = new Set()
) {
  const id = Number(recetteId);
  if (visitees.has(id)) return resultatMap;
  visitees.add(id);

  const etapesRetenues = selectionnerAlternatives(chargerEtapesRecette(db, id));

  etapesRetenues.forEach((etape) => {
    const lignes = chargerComposantsEtape(db, etape.id);
    const lignesRetenues = selectionnerAlternativesComposants(lignes, etape.id);

    lignesRetenues.forEach((l) => {
      if (l.ingredient_id) {
        const ingRes = db.exec('SELECT unite FROM ingredients WHERE id = ?', [
          l.ingredient_id,
        ]);
        const unite = ingRes[0].values[0][0];
        const quantiteAjustee = l.quantite * facteurPortions;

        if (!resultatMap[l.ingredient_id]) {
          resultatMap[l.ingredient_id] = { nom: l.nom, unite, quantite: 0 };
        }
        resultatMap[l.ingredient_id].quantite += quantiteAjustee;
      } else if (l.sous_recette_id) {
        const portionsRes = db.exec(
          'SELECT portions_base FROM recettes WHERE id = ?',
          [l.sous_recette_id]
        );
        const portionsBase = portionsRes[0].values[0][0] || 1;
        const facteurSousRecette =
          (l.quantite * facteurPortions) / portionsBase;
        agregerIngredients(
          db,
          l.sous_recette_id,
          facteurSousRecette,
          resultatMap,
          visitees
        );
      }
    });
  });

  return resultatMap;
}

app.get('/recettes/:id/ingredients-agreges', (req, res) => {
  const db = getDB();
  const id = req.params.id;
  const portionsSouhaitees = Number(req.query.portions) || null;

  const portionsBaseRes = db.exec(
    'SELECT portions_base FROM recettes WHERE id = ?',
    [id]
  );
  if (portionsBaseRes.length === 0)
    return res.status(404).json({ erreur: 'Recette introuvable' });
  const portionsBase = portionsBaseRes[0].values[0][0] || 1;

  const facteur = (portionsSouhaitees || portionsBase) / portionsBase;
  const resultatMap = agregerIngredients(db, id, facteur);

  const liste = Object.values(resultatMap).map((ing) => ({
    ...ing,
    quantite: Math.round(ing.quantite * 100) / 100,
  }));

  res.json(liste);
});

// ---------- INGREDIENTS D'UNE ETAPE (gestion) ----------

app.get('/etapes/:id/composants', (req, res) => {
  const db = getDB();
  res.json(chargerComposantsEtape(db, req.params.id));
});

app.post('/etapes/:id/composants', (req, res) => {
  const db = getDB();
  const etape_id = req.params.id;
  const { ingredient_id, sous_recette_id, quantite, groupe_alternatif } =
    req.body;

  if (!ingredient_id && !sous_recette_id) {
    return res
      .status(400)
      .json({
        erreur:
          'Il faut fournir soit un ingredient_id, soit un sous_recette_id',
      });
  }
  if (ingredient_id && sous_recette_id) {
    return res
      .status(400)
      .json({
        erreur:
          'Un composant ne peut pas être à la fois un ingrédient et une sous-recette',
      });
  }

  if (sous_recette_id) {
    const recetteParenteRes = db.exec(
      'SELECT recette_id FROM etapes WHERE id = ?',
      [etape_id]
    );
    if (recetteParenteRes.length > 0) {
      const recetteParenteId = recetteParenteRes[0].values[0][0];
      if (contientRecette(db, sous_recette_id, recetteParenteId)) {
        return res.status(400).json({
          erreur:
            'Cette sous-recette créerait une boucle : elle contient déjà, directement ou indirectement, la recette parente',
        });
      }
    }
  }

  db.run(
    'INSERT INTO etape_composants (etape_id, ingredient_id, sous_recette_id, quantite, groupe_alternatif) VALUES (?, ?, ?, ?, ?)',
    [
      etape_id,
      ingredient_id ?? null,
      sous_recette_id ?? null,
      quantite,
      groupe_alternatif ?? null,
    ]
  );

  const nouvelId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
  sauvegarder();
  res
    .status(201)
    .json({ message: 'Ingrédient ajouté à l’étape', id: nouvelId });
});

app.put('/composants/:id', (req, res) => {
  const db = getDB();
  const id = req.params.id;

  const existant = db.exec('SELECT * FROM etape_composants WHERE id = ?', [id]);
  if (existant.length === 0) {
    return res.status(404).json({ erreur: 'Composant introuvable' });
  }

  const colonnes = existant[0].columns;
  const valeurs = existant[0].values[0];
  const composantActuel = Object.fromEntries(
    colonnes.map((col, i) => [col, valeurs[i]])
  );

  const quantite = req.body.quantite ?? composantActuel.quantite;
  const groupe_alternatif =
    req.body.groupe_alternatif ?? composantActuel.groupe_alternatif;

  db.run(
    'UPDATE etape_composants SET quantite = ?, groupe_alternatif = ? WHERE id = ?',
    [quantite, groupe_alternatif, id]
  );

  sauvegarder();
  res.json({ message: 'Composant modifié' });
});

app.delete('/composants/:id', (req, res) => {
  const db = getDB();
  db.run('DELETE FROM etape_composants WHERE id = ?', [req.params.id]);
  sauvegarder();
  res.status(204).send();
});

// ---------- ETAPES ----------

app.get('/recettes/:id/etapes', (req, res) => {
  const db = getDB();
  const etapes = chargerEtapesRecette(db, req.params.id);

  const resultat = etapes.map((etape) => {
    const resultatDependances = db.exec(
      `
      SELECT etapes.id, etapes.description
      FROM etapes
      JOIN etapes_dependances ON etapes.id = etapes_dependances.depend_de_etape_id
      WHERE etapes_dependances.etape_id = ?
    `,
      [etape.id]
    );
    etape.dependances =
      resultatDependances.length === 0
        ? []
        : resultatDependances[0].values.map((v) => ({
            id: v[0],
            description: v[1],
          }));

    etape.composants = chargerComposantsEtape(db, etape.id);

    return etape;
  });

  res.json(resultat);
});

app.post('/recettes/:id/etapes', (req, res) => {
  const db = getDB();
  const recette_id = req.params.id;
  const {
    description,
    duree_active_min,
    delai_attente_min,
    groupe_alternatif,
    ressources_id,
    depend_de_etapes_id,
  } = req.body;

  db.run(
    'INSERT INTO etapes (recette_id, description, duree_active_min, delai_attente_min, groupe_alternatif) VALUES (?, ?, ?, ?, ?)',
    [
      recette_id,
      description,
      duree_active_min,
      delai_attente_min ?? 0,
      groupe_alternatif ?? null,
    ]
  );

  const nouvelId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];

  if (Array.isArray(ressources_id)) {
    ressources_id.forEach((ressourceId) => {
      db.run(
        'INSERT INTO etapes_ressources (etape_id, ressource_id) VALUES (?, ?)',
        [nouvelId, ressourceId]
      );
    });
  }

  if (Array.isArray(depend_de_etapes_id)) {
    depend_de_etapes_id.forEach((etapeId) => {
      db.run(
        'INSERT INTO etapes_dependances (etape_id, depend_de_etape_id) VALUES (?, ?)',
        [nouvelId, etapeId]
      );
    });
  }

  sauvegarder();
  res.status(201).json({ message: 'Étape créée', id: nouvelId });
});

app.put('/etapes/:id', (req, res) => {
  const db = getDB();
  const id = req.params.id;

  const existant = db.exec('SELECT * FROM etapes WHERE id = ?', [id]);
  if (existant.length === 0) {
    return res.status(404).json({ erreur: 'Étape introuvable' });
  }

  const colonnes = existant[0].columns;
  const valeurs = existant[0].values[0];
  const etapeActuelle = Object.fromEntries(
    colonnes.map((col, i) => [col, valeurs[i]])
  );

  const description = req.body.description ?? etapeActuelle.description;
  const duree_active_min =
    req.body.duree_active_min ?? etapeActuelle.duree_active_min;
  const delai_attente_min =
    req.body.delai_attente_min ?? etapeActuelle.delai_attente_min;
  const groupe_alternatif =
    req.body.groupe_alternatif ?? etapeActuelle.groupe_alternatif;

  db.run(
    'UPDATE etapes SET description = ?, duree_active_min = ?, delai_attente_min = ?, groupe_alternatif = ? WHERE id = ?',
    [description, duree_active_min, delai_attente_min, groupe_alternatif, id]
  );

  if (Array.isArray(req.body.ressources_id)) {
    db.run('DELETE FROM etapes_ressources WHERE etape_id = ?', [id]);
    req.body.ressources_id.forEach((ressourceId) => {
      db.run(
        'INSERT INTO etapes_ressources (etape_id, ressource_id) VALUES (?, ?)',
        [id, ressourceId]
      );
    });
  }

  if (Array.isArray(req.body.depend_de_etapes_id)) {
    db.run('DELETE FROM etapes_dependances WHERE etape_id = ?', [id]);
    req.body.depend_de_etapes_id.forEach((etapeId) => {
      db.run(
        'INSERT INTO etapes_dependances (etape_id, depend_de_etape_id) VALUES (?, ?)',
        [id, etapeId]
      );
    });
  }

  sauvegarder();
  res.json({ message: 'Étape modifiée' });
});

app.delete('/etapes/:id', (req, res) => {
  const db = getDB();
  const id = req.params.id;

  db.run('DELETE FROM etape_composants WHERE etape_id = ?', [id]);
  db.run('DELETE FROM etapes_ressources WHERE etape_id = ?', [id]);
  db.run(
    'DELETE FROM etapes_dependances WHERE etape_id = ? OR depend_de_etape_id = ?',
    [id, id]
  );
  db.run('DELETE FROM etapes WHERE id = ?', [id]);
  sauvegarder();

  res.status(204).send();
});

// ---------- RESSOURCES ----------

app.get('/ressources', (req, res) => {
  const db = getDB();
  const resultat = db.exec('SELECT * FROM ressources');
  if (resultat.length === 0) return res.json([]);
  const colonnes = resultat[0].columns;
  res.json(
    resultat[0].values.map((v) =>
      Object.fromEntries(colonnes.map((col, i) => [col, v[i]]))
    )
  );
});

app.post('/ressources', (req, res) => {
  const db = getDB();
  db.run('INSERT INTO ressources (nom) VALUES (?)', [req.body.nom]);
  const nouvelId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
  sauvegarder();
  res.status(201).json({ message: 'Ressource créée', id: nouvelId });
});

app.delete('/ressources/:id', (req, res) => {
  const db = getDB();
  db.run('DELETE FROM ressources WHERE id = ?', [req.params.id]);
  sauvegarder();
  res.status(204).send();
});

// ---------- TYPES_RECETTE ----------

app.get('/types-recette', (req, res) => {
  const db = getDB();
  const resultat = db.exec('SELECT * FROM types_recette');
  if (resultat.length === 0) return res.json([]);
  const colonnes = resultat[0].columns;
  res.json(
    resultat[0].values.map((v) =>
      Object.fromEntries(colonnes.map((col, i) => [col, v[i]]))
    )
  );
});

app.post('/types-recette', (req, res) => {
  const db = getDB();
  db.run('INSERT INTO types_recette (nom) VALUES (?)', [req.body.nom]);
  const nouvelId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
  sauvegarder();
  res.status(201).json({ message: 'Type créé', id: nouvelId });
});

app.delete('/types-recette/:id', (req, res) => {
  const db = getDB();
  db.run('DELETE FROM types_recette WHERE id = ?', [req.params.id]);
  sauvegarder();
  res.status(204).send();
});

// ---------- TAGS ----------

app.get('/tags', (req, res) => {
  const db = getDB();
  const resultat = db.exec('SELECT * FROM tags');
  if (resultat.length === 0) return res.json([]);
  const colonnes = resultat[0].columns;
  res.json(
    resultat[0].values.map((v) =>
      Object.fromEntries(colonnes.map((col, i) => [col, v[i]]))
    )
  );
});

app.post('/tags', (req, res) => {
  const db = getDB();
  db.run('INSERT INTO tags (nom) VALUES (?)', [req.body.nom]);
  const nouvelId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
  sauvegarder();
  res.status(201).json({ message: 'Tag créé', id: nouvelId });
});

app.delete('/tags/:id', (req, res) => {
  const db = getDB();
  db.run('DELETE FROM tags WHERE id = ?', [req.params.id]);
  sauvegarder();
  res.status(204).send();
});

// ---------- LIEUX_ACHAT ----------

app.get('/lieux-achat', (req, res) => {
  const db = getDB();
  const resultat = db.exec('SELECT * FROM lieux_achat');
  if (resultat.length === 0) return res.json([]);
  const colonnes = resultat[0].columns;
  res.json(
    resultat[0].values.map((v) =>
      Object.fromEntries(colonnes.map((col, i) => [col, v[i]]))
    )
  );
});

app.post('/lieux-achat', (req, res) => {
  const db = getDB();
  db.run('INSERT INTO lieux_achat (nom) VALUES (?)', [req.body.nom]);
  const nouvelId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
  sauvegarder();
  res.status(201).json({ message: 'Lieu créé', id: nouvelId });
});

app.delete('/lieux-achat/:id', (req, res) => {
  const db = getDB();
  db.run('DELETE FROM lieux_achat WHERE id = ?', [req.params.id]);
  sauvegarder();
  res.status(204).send();
});

// ---------- PROFILS D'EQUIPEMENT ----------

app.get('/profils', (req, res) => {
  const db = getDB();
  const resultat = db.exec('SELECT * FROM profils_equipement');
  if (resultat.length === 0) return res.json([]);
  const colonnes = resultat[0].columns;
  res.json(
    resultat[0].values.map((v) =>
      Object.fromEntries(colonnes.map((col, i) => [col, v[i]]))
    )
  );
});

app.get('/profils/:id', (req, res) => {
  const db = getDB();
  const id = req.params.id;

  const resultatProfil = db.exec(
    'SELECT * FROM profils_equipement WHERE id = ?',
    [id]
  );
  if (resultatProfil.length === 0)
    return res.status(404).json({ erreur: 'Profil introuvable' });

  const colonnes = resultatProfil[0].columns;
  const profil = Object.fromEntries(
    colonnes.map((col, i) => [col, resultatProfil[0].values[0][i]])
  );

  const resultatRessources = db.exec(
    `
    SELECT ressources.id, ressources.nom, profil_ressources.quantite_disponible
    FROM ressources
    JOIN profil_ressources ON ressources.id = profil_ressources.ressource_id
    WHERE profil_ressources.profil_id = ?
  `,
    [id]
  );

  profil.ressources =
    resultatRessources.length === 0
      ? []
      : resultatRessources[0].values.map((v) => ({
          id: v[0],
          nom: v[1],
          quantite_disponible: v[2],
        }));

  res.json(profil);
});

app.post('/profils/:id/ressources', (req, res) => {
  const db = getDB();
  const profil_id = req.params.id;
  const { ressource_id, quantite } = req.body;

  const existant = db.exec(
    'SELECT id, quantite_disponible FROM profil_ressources WHERE profil_id = ? AND ressource_id = ?',
    [profil_id, ressource_id]
  );

  if (existant.length > 0) {
    const quantiteActuelle = existant[0].values[0][1];
    const ligneId = existant[0].values[0][0];
    db.run(
      'UPDATE profil_ressources SET quantite_disponible = ? WHERE id = ?',
      [quantiteActuelle + (quantite ?? 1), ligneId]
    );
  } else {
    db.run(
      'INSERT INTO profil_ressources (profil_id, ressource_id, quantite_disponible) VALUES (?, ?, ?)',
      [profil_id, ressource_id, quantite ?? 1]
    );
  }

  sauvegarder();
  res.status(201).json({ message: 'Ressource ajoutée au profil' });
});

app.put('/profils/:profilId/ressources/:ressourceId', (req, res) => {
  const db = getDB();
  const { profilId, ressourceId } = req.params;
  const { quantite } = req.body;

  db.run(
    'UPDATE profil_ressources SET quantite_disponible = ? WHERE profil_id = ? AND ressource_id = ?',
    [quantite, profilId, ressourceId]
  );

  sauvegarder();
  res.json({ message: 'Quantité mise à jour' });
});

app.delete('/profils/:profilId/ressources/:ressourceId', (req, res) => {
  const db = getDB();
  const { profilId, ressourceId } = req.params;

  db.run(
    'DELETE FROM profil_ressources WHERE profil_id = ? AND ressource_id = ?',
    [profilId, ressourceId]
  );
  sauvegarder();

  res.status(204).send();
});

// ---------- PLANIFICATION ----------

function recupererRecettesLiees(
  db,
  recetteId,
  ensemble = new Set(),
  visitees = new Set()
) {
  const id = Number(recetteId);
  if (visitees.has(id)) return ensemble;
  visitees.add(id);
  ensemble.add(id);

  const composants = db.exec(
    `
    SELECT etape_composants.sous_recette_id
    FROM etape_composants
    JOIN etapes ON etape_composants.etape_id = etapes.id
    WHERE etapes.recette_id = ? AND etape_composants.sous_recette_id IS NOT NULL
  `,
    [id]
  );
  if (composants.length > 0) {
    composants[0].values.forEach(([sousId]) =>
      recupererRecettesLiees(db, sousId, ensemble, visitees)
    );
  }
  return ensemble;
}

function planifierRecette(db, recetteId, recetteNom, dateCibleMs) {
  const etapesRetenues = selectionnerAlternatives(
    chargerEtapesRecette(db, recetteId)
  );
  const etapesParId = Object.fromEntries(etapesRetenues.map((e) => [e.id, e]));
  const idsRetenus = new Set(etapesRetenues.map((e) => e.id));

  const successeurs = {};
  etapesRetenues.forEach((e) => {
    e.depend_de.forEach((depId) => {
      if (!idsRetenus.has(depId)) return;
      if (!successeurs[depId]) successeurs[depId] = [];
      successeurs[depId].push(e.id);
    });
  });

  const finCache = {};
  function calculerFin(etapeId) {
    if (finCache[etapeId] !== undefined) return finCache[etapeId];
    const mesSuccesseurs = successeurs[etapeId] || [];
    let fin;
    if (mesSuccesseurs.length === 0) {
      fin = dateCibleMs;
    } else {
      fin = Math.min(
        ...mesSuccesseurs.map((succId) => {
          const succ = etapesParId[succId];
          return (
            calculerFin(succId) -
            (succ.duree_active_min + succ.delai_attente_min) * 60000
          );
        })
      );
    }
    finCache[etapeId] = fin;
    return fin;
  }

  return etapesRetenues.map((e) => {
    const fin = calculerFin(e.id);
    const debut = fin - (e.duree_active_min + e.delai_attente_min) * 60000;
    return {
      recette_id: recetteId,
      recette_nom: recetteNom,
      etape_id: e.id,
      description: e.description,
      debut: new Date(debut).toISOString(),
      fin: new Date(fin).toISOString(),
      duree_active_min: e.duree_active_min,
      delai_attente_min: e.delai_attente_min,
      ressources: e.ressources,
    };
  });
}

app.get('/plannings', (req, res) => {
  const db = getDB();
  const resultat = db.exec(
    'SELECT id, date_cible FROM plannings ORDER BY id DESC'
  );
  if (resultat.length === 0) return res.json([]);

  const plannings = resultat[0].values.map(([id, date_cible]) => {
    const recettesRes = db.exec(
      `
      SELECT recettes.nom
      FROM plannings_recettes
      JOIN recettes ON plannings_recettes.recette_id = recettes.id
      WHERE plannings_recettes.planning_id = ?
    `,
      [id]
    );
    const noms =
      recettesRes.length === 0 ? [] : recettesRes[0].values.map((v) => v[0]);
    return { id, date_cible, recettes_noms: noms };
  });

  res.json(plannings);
});

app.get('/plannings/:id', (req, res) => {
  const db = getDB();
  const id = req.params.id;

  const planningRes = db.exec(
    'SELECT id, date_cible, profil_equipement_id FROM plannings WHERE id = ?',
    [id]
  );
  if (planningRes.length === 0)
    return res.status(404).json({ erreur: 'Planning introuvable' });

  const colonnes = planningRes[0].columns;
  const planning = Object.fromEntries(
    colonnes.map((col, i) => [col, planningRes[0].values[0][i]])
  );

  const recettesRes = db.exec(
    `
    SELECT plannings_recettes.recette_id, recettes.nom, plannings_recettes.portions_souhaitees
    FROM plannings_recettes
    JOIN recettes ON plannings_recettes.recette_id = recettes.id
    WHERE plannings_recettes.planning_id = ?
  `,
    [id]
  );
  planning.recettes =
    recettesRes.length === 0
      ? []
      : recettesRes[0].values.map((v) => ({
          recette_id: v[0],
          nom: v[1],
          portions_souhaitees: v[2],
        }));

  res.json(planning);
});

app.delete('/plannings/:id', (req, res) => {
  const db = getDB();
  const id = req.params.id;
  db.run('DELETE FROM plannings_recettes WHERE planning_id = ?', [id]);
  db.run('DELETE FROM plannings WHERE id = ?', [id]);
  sauvegarder();
  res.status(204).send();
});

app.post('/plannings', (req, res) => {
  const db = getDB();
  const { date_cible, profil_equipement_id, recettes } = req.body;

  db.run(
    'INSERT INTO plannings (date_cible, profil_equipement_id) VALUES (?, ?)',
    [date_cible, profil_equipement_id ?? null]
  );
  const planningId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];

  recettes.forEach(({ recette_id, portions_souhaitees }) => {
    db.run(
      'INSERT INTO plannings_recettes (planning_id, recette_id, portions_souhaitees) VALUES (?, ?, ?)',
      [planningId, recette_id, portions_souhaitees]
    );
  });

  sauvegarder();
  res.status(201).json({ message: 'Planning créé', id: planningId });
});

app.get('/plannings/:id/calendrier', (req, res) => {
  const db = getDB();
  const planningId = req.params.id;

  const planningRes = db.exec('SELECT date_cible FROM plannings WHERE id = ?', [
    planningId,
  ]);
  if (planningRes.length === 0)
    return res.status(404).json({ erreur: 'Planning introuvable' });
  const dateCibleMs = new Date(planningRes[0].values[0][0]).getTime();

  const recettesRes = db.exec(
    'SELECT recette_id FROM plannings_recettes WHERE planning_id = ?',
    [planningId]
  );
  if (recettesRes.length === 0) return res.json([]);

  const toutesRecettesIds = new Set();
  recettesRes[0].values.forEach(([id]) =>
    recupererRecettesLiees(db, id, toutesRecettesIds)
  );

  let calendrier = [];
  toutesRecettesIds.forEach((recetteId) => {
    const nomRes = db.exec('SELECT nom FROM recettes WHERE id = ?', [
      recetteId,
    ]);
    const nom = nomRes[0].values[0][0];
    calendrier = calendrier.concat(
      planifierRecette(db, recetteId, nom, dateCibleMs)
    );
  });

  calendrier.sort((a, b) => new Date(a.debut) - new Date(b.debut));

  res.json(calendrier);
});

// ---------- DEMARRAGE ----------

const PORT = process.env.PORT || 3000;

async function demarrer() {
  await initDB();
  app.listen(PORT, () => console.log(`Serveur lancé sur le port ${PORT}`));
}

demarrer();
