import { API_URL } from './config'
import { useState, useEffect, useRef } from 'react';
import './FormRecette.css';
import { Trash2, Pencil, Plus, Minus, X, Download } from 'lucide-react';

function FormRecette({ recetteId = null, onEnregistree }) {
  const [nom, setNom] = useState('');
  const [typeId, setTypeId] = useState('');
  const [portionsBase, setPortionsBase] = useState(2);
  const [description, setDescription] = useState('');
  const [tagsSelectionnes, setTagsSelectionnes] = useState([]);

  const [etapes, setEtapes] = useState([]);

  const [types, setTypes] = useState([]);
  const [tags, setTags] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [recettesExistantes, setRecettesExistantes] = useState([]);
  const [ressources, setRessources] = useState([]);

  const [enCours, setEnCours] = useState(false);

  const compteurIdRef = useRef(1);

  useEffect(() => {
    fetch(`${API_URL}/types-recette`)
      .then((r) => r.json())
      .then(setTypes);
    fetch(`${API_URL}/tags`)
      .then((r) => r.json())
      .then(setTags);
    fetch(`${API_URL}/ingredients`)
      .then((r) => r.json())
      .then(setIngredients);
    fetch(`${API_URL}/recettes`)
      .then((r) => r.json())
      .then(setRecettesExistantes);
    fetch(`${API_URL}/ressources`)
      .then((r) => r.json())
      .then(setRessources);
  }, []);

  useEffect(() => {
    if (!recetteId) return;

    async function chargerPourEdition() {
      const recette = await fetch(
        `${API_URL}/recettes/${recetteId}`
      ).then((r) => r.json());
      setNom(recette.nom);
      setTypeId(String(recette.type_id));
      setPortionsBase(recette.portions_base);
      setDescription(recette.description || '');
      setTagsSelectionnes(recette.tags.map((t) => t.id));

      const etapesApi = await fetch(
        `${API_URL}/recettes/${recetteId}/etapes`
      ).then((r) => r.json());

      const mapReelVersLocal = {};
      const etapesAvecLocalId = etapesApi.map((e) => {
        const localId = compteurIdRef.current;
        compteurIdRef.current += 1;
        mapReelVersLocal[e.id] = localId;
        return { e, localId };
      });

      setEtapes(
        etapesAvecLocalId.map(({ e, localId }) => ({
          localId,
          description: e.description,
          duree_active_min: e.duree_active_min,
          delai_attente_min: e.delai_attente_min,
          groupe_alternatif: e.groupe_alternatif ?? '',
          ressources_id: e.ressources.map((r) => r.id),
          depend_de_local_ids: e.dependances
            .map((d) => mapReelVersLocal[d.id])
            .filter(Boolean),
          rechercheRessource: '',
          composants: e.composants.map((c) => ({
            type: c.type,
            refId:
              c.type === 'ingredient' ? c.ingredient_id : c.sous_recette_id,
            quantite: c.quantite,
            groupe_alternatif: c.groupe_alternatif ?? '',
          })),
        }))
      );
    }

    chargerPourEdition();
  }, [recetteId]);

  const basculerTag = (tagId) => {
    setTagsSelectionnes((precedent) =>
      precedent.includes(tagId)
        ? precedent.filter((id) => id !== tagId)
        : [...precedent, tagId]
    );
  };

  // ---------- Gestion des étapes ----------
  const ajouterEtape = () => {
    const localId = compteurIdRef.current;
    compteurIdRef.current += 1;

    setEtapes((precedent) => [
      ...precedent,
      {
        localId,
        description: '',
        duree_active_min: '',
        delai_attente_min: 0,
        groupe_alternatif: '',
        ressources_id: [],
        depend_de_local_ids: [],
        rechercheRessource: '',
        composants: [],
      },
    ]);
  };

  const modifierEtape = (index, champ, valeur) => {
    setEtapes((precedent) =>
      precedent.map((e, i) => (i === index ? { ...e, [champ]: valeur } : e))
    );
  };

  const basculerRessourceEtape = (index, ressourceId) => {
    setEtapes((precedent) =>
      precedent.map((e, i) => {
        if (i !== index) return e;
        const dejaLa = e.ressources_id.includes(ressourceId);
        return {
          ...e,
          ressources_id: dejaLa
            ? e.ressources_id.filter((id) => id !== ressourceId)
            : [...e.ressources_id, ressourceId],
          rechercheRessource: '',
        };
      })
    );
  };

  const basculerDependance = (index, localIdCible) => {
    setEtapes((precedent) =>
      precedent.map((e, i) => {
        if (i !== index) return e;
        const dejaLa = e.depend_de_local_ids.includes(localIdCible);
        return {
          ...e,
          depend_de_local_ids: dejaLa
            ? e.depend_de_local_ids.filter((id) => id !== localIdCible)
            : [...e.depend_de_local_ids, localIdCible],
        };
      })
    );
  };

  const supprimerEtape = (index) => {
    setEtapes((precedent) => precedent.filter((_, i) => i !== index));
  };

  // ---------- Gestion des ingrédients d'une étape (imbriqué) ----------
  const ajouterComposantEtape = (etapeIndex) => {
    setEtapes((precedent) =>
      precedent.map((e, i) =>
        i === etapeIndex
          ? {
              ...e,
              composants: [
                ...e.composants,
                {
                  type: 'ingredient',
                  refId: '',
                  quantite: '',
                  groupe_alternatif: '',
                },
              ],
            }
          : e
      )
    );
  };

  const modifierComposantEtape = (
    etapeIndex,
    composantIndex,
    champ,
    valeur
  ) => {
    setEtapes((precedent) =>
      precedent.map((e, i) => {
        if (i !== etapeIndex) return e;
        return {
          ...e,
          composants: e.composants.map((c, ci) =>
            ci === composantIndex ? { ...c, [champ]: valeur } : c
          ),
        };
      })
    );
  };

  const supprimerComposantEtape = (etapeIndex, composantIndex) => {
    setEtapes((precedent) =>
      precedent.map((e, i) =>
        i === etapeIndex
          ? {
              ...e,
              composants: e.composants.filter((_, ci) => ci !== composantIndex),
            }
          : e
      )
    );
  };

  // ---------- Soumission ----------
  const soumettre = async (e) => {
    e.preventDefault();
    if (!nom || !typeId) return;
    setEnCours(true);

    let idRecette = recetteId;

    if (recetteId) {
      await fetch(`${API_URL}/recettes/${recetteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom,
          type_id: Number(typeId),
          portions_base: Number(portionsBase),
          description,
          tags: tagsSelectionnes,
        }),
      });

      // Supprime les anciennes étapes : leurs ingrédients partent automatiquement avec (nettoyage backend)
      const etapesActuelles = await fetch(
        `${API_URL}/recettes/${recetteId}/etapes`
      ).then((r) => r.json());
      for (const e2 of etapesActuelles) {
        await fetch(`${API_URL}/etapes/${e2.id}`, {
          method: 'DELETE',
        });
      }
    } else {
      const reponseRecette = await fetch(`${API_URL}/recettes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom,
          type_id: Number(typeId),
          portions_base: Number(portionsBase),
          description,
          tags: tagsSelectionnes,
        }),
      });
      const donnees = await reponseRecette.json();
      idRecette = donnees.id;
    }

    const mapLocalVersReel = {};

    for (const etape of etapes) {
      if (!etape.description || !etape.duree_active_min) continue;

      const reponseEtape = await fetch(
        `${API_URL}/recettes/${idRecette}/etapes`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: etape.description,
            duree_active_min: Number(etape.duree_active_min),
            delai_attente_min: Number(etape.delai_attente_min) || 0,
            groupe_alternatif: etape.groupe_alternatif
              ? Number(etape.groupe_alternatif)
              : null,
            ressources_id: etape.ressources_id,
          }),
        }
      );
      const { id: vraiId } = await reponseEtape.json();
      mapLocalVersReel[etape.localId] = vraiId;

      // Ingrédients de cette étape
      for (const composant of etape.composants) {
        if (!composant.refId || !composant.quantite) continue;
        await fetch(`${API_URL}/etapes/${vraiId}/composants`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ingredient_id:
              composant.type === 'ingredient' ? Number(composant.refId) : null,
            sous_recette_id:
              composant.type === 'sous_recette'
                ? Number(composant.refId)
                : null,
            quantite: Number(composant.quantite),
            groupe_alternatif: composant.groupe_alternatif
              ? Number(composant.groupe_alternatif)
              : null,
          }),
        });
      }
    }

    for (const etape of etapes) {
      if (etape.depend_de_local_ids.length === 0) continue;
      const vraiId = mapLocalVersReel[etape.localId];
      if (!vraiId) continue;

      const depend_de_etapes_id = etape.depend_de_local_ids
        .map((localId) => mapLocalVersReel[localId])
        .filter(Boolean);

      if (depend_de_etapes_id.length === 0) continue;

      await fetch(`${API_URL}/etapes/${vraiId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ depend_de_etapes_id }),
      });
    }

    setEnCours(false);
    onEnregistree(idRecette);
  };

  return (
    <form onSubmit={soumettre} className="form-recette">
      <h1>{recetteId ? 'Modifier la recette' : 'Nouvelle recette'}</h1>

      <label>Nom</label>
      <input
        type="text"
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        required
      />

      <label>Type</label>
      <select
        value={typeId}
        onChange={(e) => setTypeId(e.target.value)}
        required
      >
        <option value="">Choisir un type</option>
        {types.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nom}
          </option>
        ))}
      </select>

      <label>Portions de base</label>
      <input
        type="number"
        min="1"
        value={portionsBase}
        onChange={(e) => setPortionsBase(e.target.value)}
      />

      <label>Description</label>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <label>Tags</label>
      <div className="choix-tags">
        {tags.map((tag) => (
          <button
            type="button"
            key={tag.id}
            className={`badge-choix ${
              tagsSelectionnes.includes(tag.id) ? 'actif' : ''
            }`}
            onClick={() => basculerTag(tag.id)}
          >
            {tag.nom}
          </button>
        ))}
      </div>

      <hr />
      <div className="entete-section">
        <h2>Étapes</h2>
        <button type="button" onClick={ajouterEtape}>
          + Ajouter
        </button>
      </div>
      <p className="aide">
        Chaque étape peut avoir ses propres ingrédients (avec quantité). Le même
        ingrédient peut apparaître sur plusieurs étapes : les quantités seront
        additionnées automatiquement dans le récapitulatif de la recette.
      </p>

      {etapes.map((etape, index) => {
        const ressourcesFiltrees = ressources.filter(
          (r) =>
            r.nom
              .toLowerCase()
              .includes(etape.rechercheRessource.toLowerCase()) &&
            !etape.ressources_id.includes(r.id)
        );
        const autresEtapes = etapes.filter((e) => e.localId !== etape.localId);

        return (
          <div key={etape.localId} className="bloc-etape">
            <textarea
              placeholder="Description de l'étape (détaille les gestes, les repères visuels, etc.)"
              value={etape.description}
              onChange={(e) =>
                modifierEtape(index, 'description', e.target.value)
              }
            />

            <div className="ligne-etape">
              <input
                type="number"
                placeholder="Temps actif (min)"
                value={etape.duree_active_min}
                onChange={(e) =>
                  modifierEtape(index, 'duree_active_min', e.target.value)
                }
              />
              <input
                type="number"
                placeholder="Temps de repos (min)"
                value={etape.delai_attente_min}
                onChange={(e) =>
                  modifierEtape(index, 'delai_attente_min', e.target.value)
                }
              />
              <input
                type="number"
                placeholder="Groupe alt."
                className="champ-groupe"
                value={etape.groupe_alternatif}
                onChange={(e) =>
                  modifierEtape(index, 'groupe_alternatif', e.target.value)
                }
              />
              <button type="button" onClick={() => supprimerEtape(index)}>
                <Trash2 size={14} strokeWidth={2} />
              </button>
            </div>

            {/* ---------- Ingrédients de cette étape ---------- */}
            <div className="bloc-composants-etape">
              <div className="entete-section entete-mini">
                <p className="aide">Ingrédients de cette étape</p>
                <button
                  type="button"
                  onClick={() => ajouterComposantEtape(index)}
                >
                  <Plus size={14} /> Ajouter
                </button>
              </div>

              {etape.composants.map((composant, ci) => (
                <div key={ci} className="ligne-composant">
                  <select
                    value={composant.type}
                    onChange={(e) =>
                      modifierComposantEtape(index, ci, 'type', e.target.value)
                    }
                  >
                    <option value="ingredient">Ingrédient</option>
                    <option value="sous_recette">Sous-recette</option>
                  </select>

                  <select
                    value={composant.refId}
                    onChange={(e) =>
                      modifierComposantEtape(index, ci, 'refId', e.target.value)
                    }
                  >
                    <option value="">Choisir...</option>
                    {(composant.type === 'ingredient'
                      ? ingredients
                      : recettesExistantes
                    )
                      .filter(
                        (item) => !recetteId || item.id !== Number(recetteId)
                      )
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nom}
                        </option>
                      ))}
                  </select>

                  <input
                    type="number"
                    placeholder="Quantité"
                    value={composant.quantite}
                    onChange={(e) =>
                      modifierComposantEtape(
                        index,
                        ci,
                        'quantite',
                        e.target.value
                      )
                    }
                  />

                  <input
                    type="number"
                    placeholder="Groupe alt."
                    className="champ-groupe"
                    value={composant.groupe_alternatif}
                    onChange={(e) =>
                      modifierComposantEtape(
                        index,
                        ci,
                        'groupe_alternatif',
                        e.target.value
                      )
                    }
                  />

                  <button
                    type="button"
                    onClick={() => supprimerComposantEtape(index, ci)}
                  >
                    <Trash2 size={14} strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>

            {/* ---------- Ressources : recherche + badges sélectionnés ---------- */}
            <div className="bloc-ressources">
              {etape.ressources_id.length > 0 && (
                <div className="choix-tags">
                  {etape.ressources_id.map((rId) => {
                    const ressource = ressources.find((r) => r.id === rId);
                    if (!ressource) return null;
                    return (
                      <button
                        type="button"
                        key={rId}
                        className="badge-choix actif"
                        onClick={() => basculerRessourceEtape(index, rId)}
                      >
                        {ressource.nom} ✕
                      </button>
                    );
                  })}
                </div>
              )}

              <input
                type="text"
                placeholder="Rechercher une ressource..."
                value={etape.rechercheRessource}
                onChange={(e) =>
                  modifierEtape(index, 'rechercheRessource', e.target.value)
                }
              />

              {etape.rechercheRessource && (
                <div className="suggestions-ressources">
                  {ressourcesFiltrees.length === 0 && (
                    <p className="aide">Aucun résultat</p>
                  )}
                  {ressourcesFiltrees.map((r) => (
                    <div
                      key={r.id}
                      className="ligne-suggestion"
                      onClick={() => basculerRessourceEtape(index, r.id)}
                    >
                      {r.nom}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ---------- Dépendances vers d'autres étapes du formulaire ---------- */}
            {autresEtapes.length > 0 && (
              <div className="bloc-dependances">
                <p className="aide">Dépend de :</p>
                {autresEtapes.map((autre) => (
                  <label key={autre.localId} className="ligne-checkbox">
                    <input
                      type="checkbox"
                      checked={etape.depend_de_local_ids.includes(
                        autre.localId
                      )}
                      onChange={() => basculerDependance(index, autre.localId)}
                    />
                    {autre.description || 'Étape sans nom'}
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <hr />
      <button type="submit" className="bouton-principal" disabled={enCours}>
        {enCours
          ? 'Enregistrement...'
          : recetteId
          ? 'Enregistrer les modifications'
          : 'Créer la recette'}
      </button>
    </form>
  );
}

export default FormRecette;
