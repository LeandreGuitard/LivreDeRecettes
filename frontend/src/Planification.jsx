import { useState, useEffect } from 'react';
import './Planification.css';

function formaterDateHeure(iso) {
  const d = new Date(iso);
  return d.toLocaleString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formaterDuree(minutes) {
  if (minutes < 60) return `${minutes}min`;
  const heures = Math.floor(minutes / 60);
  const reste = minutes % 60;
  return `${heures}h${reste > 0 ? reste : ''}`;
}

function versDatetimeLocal(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

const COULEURS = ['#2952cc', '#2f6b3f', '#b8482a', '#7a5ea8', '#c08a2e'];

function Planification() {
  const [dateCible, setDateCible] = useState('');
  const [recettesDisponibles, setRecettesDisponibles] = useState([]);
  const [recettesChoisies, setRecettesChoisies] = useState([]); // { recette_id, nom, portions_souhaitees }
  const [calendrier, setCalendrier] = useState(null);
  const [listeCourses, setListeCourses] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [planningsEnregistres, setPlanningsEnregistres] = useState([]);
  const [planningOuvertId, setPlanningOuvertId] = useState(null);

  const chargerPlanningsEnregistres = () => {
    fetch('http://localhost:3000/plannings')
      .then((r) => r.json())
      .then(setPlanningsEnregistres);
  };

  useEffect(() => {
    fetch('http://localhost:3000/recettes')
      .then((r) => r.json())
      .then(setRecettesDisponibles);

    chargerPlanningsEnregistres();
  }, []);

  const ajouterRecette = (id) => {
    if (!id) return;
    if (recettesChoisies.some((r) => r.recette_id === Number(id))) return;

    const recette = recettesDisponibles.find((r) => r.id === Number(id));
    setRecettesChoisies((precedent) => [
      ...precedent,
      {
        recette_id: recette.id,
        nom: recette.nom,
        portions_souhaitees: recette.portions_base || 2,
      },
    ]);
  };

  const retirerRecette = (id) => {
    setRecettesChoisies((precedent) =>
      precedent.filter((r) => r.recette_id !== id)
    );
  };

  const modifierPortions = (id, valeur) => {
    setRecettesChoisies((precedent) =>
      precedent.map((r) =>
        r.recette_id === id ? { ...r, portions_souhaitees: Number(valeur) } : r
      )
    );
  };

  // Récupère le calendrier calculé + agrège la liste de courses, pour un planning déjà existant
  const chargerCalendrierEtCourses = async (
    planningId,
    recettesPourCourses
  ) => {
    const reponseCalendrier = await fetch(
      `http://localhost:3000/plannings/${planningId}/calendrier`
    );
    const donnees = await reponseCalendrier.json();
    setCalendrier(donnees);

    const cumul = {}; // clé = "nom|unite"
    for (const r of recettesPourCourses) {
      const reponse = await fetch(
        `http://localhost:3000/recettes/${r.recette_id}/ingredients-agreges?portions=${r.portions_souhaitees}`
      );
      const ingredients = await reponse.json();

      ingredients.forEach((ing) => {
        const cle = `${ing.nom}|${ing.unite}`;
        if (!cumul[cle])
          cumul[cle] = { nom: ing.nom, unite: ing.unite, quantite: 0 };
        cumul[cle].quantite += ing.quantite;
      });
    }

    setListeCourses(
      Object.values(cumul)
        .map((ing) => ({
          ...ing,
          quantite: Math.round(ing.quantite * 100) / 100,
        }))
        .sort((a, b) => a.nom.localeCompare(b.nom))
    );
  };

  const genererPlanning = async () => {
    if (!dateCible || recettesChoisies.length === 0) return;
    setEnCours(true);
    setCalendrier(null);
    setListeCourses(null);
    setPlanningOuvertId(null);

    const reponseCreation = await fetch('http://localhost:3000/plannings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date_cible: new Date(dateCible).toISOString(),
        recettes: recettesChoisies.map((r) => ({
          recette_id: r.recette_id,
          portions_souhaitees: r.portions_souhaitees,
        })),
      }),
    });
    const { id: planningId } = await reponseCreation.json();

    await chargerCalendrierEtCourses(planningId, recettesChoisies);
    setPlanningOuvertId(planningId);
    chargerPlanningsEnregistres();

    setEnCours(false);
  };

  // Rouvre un planning déjà enregistré : recharge sa sélection et son calendrier
  const ouvrirPlanningExistant = async (planningId) => {
    setEnCours(true);
    setCalendrier(null);
    setListeCourses(null);

    const planning = await fetch(
      `http://localhost:3000/plannings/${planningId}`
    ).then((r) => r.json());

    setDateCible(versDatetimeLocal(planning.date_cible));
    setRecettesChoisies(planning.recettes.map((r) => ({ ...r })));
    setPlanningOuvertId(planningId);

    await chargerCalendrierEtCourses(planningId, planning.recettes);

    setEnCours(false);
  };

  const supprimerPlanning = async (planningId, e) => {
    e.stopPropagation();
    if (!window.confirm('Supprimer ce repas enregistré ?')) return;

    await fetch(`http://localhost:3000/plannings/${planningId}`, {
      method: 'DELETE',
    });
    if (planningOuvertId === planningId) {
      setCalendrier(null);
      setListeCourses(null);
      setPlanningOuvertId(null);
    }
    chargerPlanningsEnregistres();
  };

  const couleurParRecette = {};
  if (calendrier) {
    const idsUniques = [...new Set(calendrier.map((e) => e.recette_id))];
    idsUniques.forEach((id, i) => {
      couleurParRecette[id] = COULEURS[i % COULEURS.length];
    });
  }

  return (
    <div className="planification">
      <h1>Planifier un repas</h1>
      <hr />

      {planningsEnregistres.length > 0 && (
        <>
          <h2>Repas enregistrés</h2>
          <div className="liste-plannings-enregistres">
            {planningsEnregistres.map((p) => (
              <div
                key={p.id}
                className={`ligne-planning-enregistre ${
                  planningOuvertId === p.id ? 'actif' : ''
                }`}
                onClick={() => ouvrirPlanningExistant(p.id)}
              >
                <div>
                  <span className="date-planning-enregistre">
                    {formaterDateHeure(p.date_cible)}
                  </span>
                  <span className="recettes-planning-enregistre">
                    {p.recettes_noms.join(', ')}
                  </span>
                </div>
                <button
                  className="bouton-supprimer"
                  onClick={(e) => supprimerPlanning(p.id, e)}
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
          <hr />
        </>
      )}

      <label>Déguster le</label>
      <input
        type="datetime-local"
        value={dateCible}
        onChange={(e) => setDateCible(e.target.value)}
      />

      <div className="entete-section">
        <h2>Recettes du repas</h2>
        <select value="" onChange={(e) => ajouterRecette(e.target.value)}>
          <option value="">+ Ajouter une recette</option>
          {recettesDisponibles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nom}
            </option>
          ))}
        </select>
      </div>

      <div className="liste-recettes-choisies">
        {recettesChoisies.map((r) => (
          <div key={r.recette_id} className="ligne-recette-choisie">
            <span>{r.nom}</span>
            <div className="controles-recette-choisie">
              <label className="label-portions">Portions :</label>
              <input
                type="number"
                min="1"
                value={r.portions_souhaitees}
                onChange={(e) => modifierPortions(r.recette_id, e.target.value)}
              />
              <button onClick={() => retirerRecette(r.recette_id)}>✕</button>
            </div>
          </div>
        ))}
        {recettesChoisies.length === 0 && (
          <p className="message-vide">Aucune recette ajoutée pour l'instant</p>
        )}
      </div>

      <button
        className="bouton-principal"
        onClick={genererPlanning}
        disabled={enCours || !dateCible || recettesChoisies.length === 0}
      >
        {enCours ? 'Calcul en cours...' : 'Générer le calendrier'}
      </button>

      {calendrier && (
        <>
          <hr />
          <h2>Calendrier combiné</h2>

          {calendrier.length === 0 && (
            <p className="message-vide">
              Aucune étape trouvée pour ces recettes.
            </p>
          )}

          <div className="calendrier">
            {calendrier.map((etape) => (
              <div
                key={`${etape.recette_id}-${etape.etape_id}`}
                className="ligne-calendrier"
              >
                <span className="date-calendrier">
                  {formaterDateHeure(etape.debut)}
                </span>
                <span
                  className="badge-recette"
                  style={{
                    backgroundColor: couleurParRecette[etape.recette_id],
                  }}
                >
                  {etape.recette_nom}
                </span>
                <span className="description-calendrier">
                  {etape.description}
                </span>
                <span className="duree-calendrier">
                  Actif {formaterDuree(etape.duree_active_min)}
                  {etape.delai_attente_min > 0 &&
                    ` · Repos ${formaterDuree(etape.delai_attente_min)}`}
                  {' · Fin '}
                  {formaterDateHeure(etape.fin)}
                </span>
                {etape.ressources.length > 0 && (
                  <span className="ressources-calendrier">
                    🔧 {etape.ressources.map((r) => r.nom).join(', ')}
                  </span>
                )}
              </div>
            ))}
          </div>

          <hr />
          <h2>Liste de courses</h2>
          <p className="aide-planification">
            Quantités cumulées pour toutes les recettes du repas, y compris
            leurs sous-recettes.
          </p>

          {listeCourses && listeCourses.length > 0 ? (
            <div className="liste-courses">
              {listeCourses.map((ing) => (
                <div key={`${ing.nom}-${ing.unite}`} className="ligne-course">
                  <span>{ing.nom}</span>
                  <span className="quantite-course">
                    {ing.quantite} {ing.unite}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="message-vide">Aucun ingrédient trouvé.</p>
          )}
        </>
      )}
    </div>
  );
}

export default Planification;
