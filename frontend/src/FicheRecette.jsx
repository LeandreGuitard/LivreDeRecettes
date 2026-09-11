import { useState, useEffect } from 'react';
import './FicheRecette.css';
import { exporterRecette } from './exportXlsx';

function calculerResumeRessources(etapes) {
  const groupes = {};
  const ordre = [];

  etapes.forEach((etape) => {
    const cle = etape.groupe_alternatif ?? `seule-${etape.id}`;
    if (!groupes[cle]) {
      groupes[cle] = new Set();
      ordre.push(cle);
    }
    etape.ressources.forEach((r) => groupes[cle].add(r.nom));
  });

  return ordre
    .map((cle) => Array.from(groupes[cle]))
    .filter((noms) => noms.length > 0)
    .map((noms) => noms.join(' ou '));
}

function formaterDuree(minutes) {
  if (minutes < 60) return `${minutes}min`;
  const jours = Math.floor(minutes / 1440);
  const heuresRestantes = Math.floor((minutes % 1440) / 60);
  const minutesRestantes = minutes % 60;
  if (jours > 0) return `${jours}j ${heuresRestantes}h`;
  if (heuresRestantes > 0)
    return `${heuresRestantes}h${minutesRestantes > 0 ? minutesRestantes : ''}`;
  return `${minutesRestantes}min`;
}

function FicheRecette({ id, onModifier, onSupprimer }) {
  const [recette, setRecette] = useState(null);
  const [etapes, setEtapes] = useState([]);
  const [resumeIngredients, setResumeIngredients] = useState([]);
  const [calculs, setCalculs] = useState(null);
  const [menuRessource, setMenuRessource] = useState(null);
  const [confirmation, setConfirmation] = useState(null);

  useEffect(() => {
    if (!id) return;

    fetch(`http://localhost:3000/recettes/${id}`)
      .then((reponse) => reponse.json())
      .then((donnees) => setRecette(donnees));

    fetch(`http://localhost:3000/recettes/${id}/etapes`)
      .then((reponse) => reponse.json())
      .then((donnees) => setEtapes(donnees));

    fetch(`http://localhost:3000/recettes/${id}/calculs`)
      .then((reponse) => reponse.json())
      .then((donnees) => setCalculs(donnees));
  }, [id]);

  useEffect(() => {
    if (!menuRessource) return;

    const menu = document.querySelector('.menu-contextuel');
    if (!menu) return;

    const { innerWidth, innerHeight } = window;
    const rect = menu.getBoundingClientRect();

    let x = menuRessource.x;
    let y = menuRessource.y;

    if (rect.right > innerWidth) x = innerWidth - rect.width - 8;
    if (rect.bottom > innerHeight) y = innerHeight - rect.height - 8;

    if (x !== menuRessource.x || y !== menuRessource.y) {
      setMenuRessource((precedent) => ({ ...precedent, x, y }));
    }
  }, [menuRessource]);

  const ajouterAuProfil = async (ressourceId, ressourceNom) => {
    await fetch('http://localhost:3000/profils/1/ressources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ressource_id: ressourceId, quantite: 1 }),
    });
    setMenuRessource(null);
    setConfirmation(`✅ "${ressourceNom}" ajouté au profil`);

    setTimeout(() => setConfirmation(null), 1500);
  };

  if (!id)
    return <p className="message-vide">Sélectionne une recette dans le menu</p>;
  if (!recette) return <p className="message-vide">Chargement...</p>;

  const resumeRessources = calculerResumeRessources(etapes);

  return (
    <div className="fiche-recette">
      <div className="entete-fiche">
        <h1>{recette.nom}</h1>
        <div className="actions-fiche">
          <button
            onClick={() =>
              exporterRecette(recette, resumeIngredients, etapes, calculs)
            }
          >
            📊 Exporter
          </button>
          <button onClick={onModifier}>✏️ Modifier</button>
          <button
            className="bouton-danger"
            onClick={() => onSupprimer(recette.id)}
          >
            🗑️ Supprimer
          </button>
        </div>
      </div>{' '}
      <hr />
      <div className="photo-placeholder">📷</div>
      {calculs && (
        <div className="grille-metadonnees">
          <div>
            <p className="label-meta">Coût estimé</p>
            <p className="valeur-meta">{calculs.cout_estime} €</p>
          </div>
          <div>
            <p className="label-meta">Temps total</p>
            <p className="valeur-meta">
              {formaterDuree(calculs.temps_total_min)}
            </p>
          </div>
          <div>
            <p className="label-meta">Temps actif</p>
            <p className="valeur-meta">
              {formaterDuree(calculs.temps_actif_min)}
            </p>
          </div>
          <div>
            <p className="label-meta">Temps inactif</p>
            <p className="valeur-meta">
              {formaterDuree(calculs.temps_inactif_min)}
            </p>
          </div>
        </div>
      )}
      <p className="description">{recette.description}</p>
      <div className="tags">
        <span className="badge badge-type">{recette.type_nom}</span>
        {recette.tags.map((tag) => (
          <span key={tag.id} className="badge badge-tag">
            {tag.nom}
          </span>
        ))}
      </div>
      {resumeRessources.length > 0 && (
        <div className="tags">
          {resumeRessources.map((texte, i) => (
            <span key={i} className="badge badge-ressource">
              🔧 {texte}
            </span>
          ))}
        </div>
      )}
      <hr />
      <h2>Ingrédients</h2>
      <ul className="liste-ingredients">
        {resumeIngredients.map((item) => (
          <li key={`${item.type}-${item.id}`}>
            <span>{item.nom}</span>
            <span className="quantite">{item.quantite}</span>
          </li>
        ))}
      </ul>
      <h2>Étapes</h2>
      <ol className="liste-etapes">
        {etapes.map((etape) => (
          <li key={etape.id}>
            <p>{etape.description}</p>
            <p className="meta-etape">
              {etape.composants && etape.composants.length > 0 && (
                <ul className="ingredients-etape">
                  {etape.composants.map((c) => (
                    <li key={c.id}>
                      {c.nom} — {c.quantite}
                    </li>
                  ))}
                </ul>
              )}
              Actif {etape.duree_active_min}min
              {etape.delai_attente_min > 0 &&
                ` · Repos ${etape.delai_attente_min}min`}
            </p>

            {etape.ressources.length > 0 && (
              <div className="badges-ressources">
                {etape.ressources.map((ressource) => (
                  // ⬅️ BLOC 3 (modifié) : le badge devient cliquable, remplace l'ancienne version
                  <span
                    key={ressource.id}
                    className="badge badge-ressource badge-cliquable"
                    onClick={(e) =>
                      setMenuRessource({
                        id: ressource.id,
                        nom: ressource.nom,
                        x: e.clientX,
                        y: e.clientY,
                      })
                    }
                  >
                    🔧 {ressource.nom}
                  </span>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
      {/* ⬅️ BLOC 4 : le menu contextuel, juste avant la fermeture du div principal */}
      {menuRessource && (
        <>
          <div
            className="overlay-menu"
            onClick={() => setMenuRessource(null)}
          />
          <div
            className="menu-contextuel"
            style={{ top: menuRessource.y, left: menuRessource.x }}
          >
            <button
              onClick={() =>
                ajouterAuProfil(menuRessource.id, menuRessource.nom)
              }
            >
              Ajouter "{menuRessource.nom}" au profil actuel
            </button>
          </div>
        </>
      )}
      {confirmation && <div className="toast-confirmation">{confirmation}</div>}
    </div>
  );
}

export default FicheRecette;
