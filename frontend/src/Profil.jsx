import { API_URL } from './config'
import { useState, useEffect } from 'react';
import './Profil.css';

function Profil({ profilId }) {
  const [profil, setProfil] = useState(null);
  const [toutesRessources, setToutesRessources] = useState([]);

  const chargerProfil = () => {
    fetch(`${API_URL}/profils/${profilId}`)
      .then((reponse) => reponse.json())
      .then((donnees) => setProfil(donnees));
  };

  useEffect(() => {
    chargerProfil();

    fetch(`${API_URL}/ressources`)
      .then((reponse) => reponse.json())
      .then((donnees) => setToutesRessources(donnees));
  }, [profilId]);

  const modifierQuantite = async (ressourceId, nouvelleQuantite) => {
    if (nouvelleQuantite < 1) return;
    await fetch(
      `${API_URL}/profils/${profilId}/ressources/${ressourceId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantite: nouvelleQuantite }),
      }
    );
    chargerProfil();
  };

  const supprimerRessource = async (ressourceId) => {
    await fetch(
      `${API_URL}/profils/${profilId}/ressources/${ressourceId}`,
      { method: 'DELETE' }
    );
    chargerProfil();
  };

  const ajouterRessource = async (ressourceId) => {
    if (!ressourceId) return;
    await fetch(`${API_URL}/profils/${profilId}/ressources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ressource_id: Number(ressourceId), quantite: 1 }),
    });
    chargerProfil();
  };

  if (!profil) return <p>Chargement...</p>;

  const idsDejaAjoutes = profil.ressources.map((r) => r.id);
  const ressourcesDisponibles = toutesRessources.filter(
    (r) => !idsDejaAjoutes.includes(r.id)
  );

  return (
    <div className="profil">
      <h1>{profil.nom}</h1>
      <hr />

      <div className="entete-equipement">
        <h2>Équipement disponible</h2>
        <select value="" onChange={(e) => ajouterRessource(e.target.value)}>
          <option value="">+ Ajouter une ressource</option>
          {ressourcesDisponibles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nom}
            </option>
          ))}
        </select>
      </div>

      <div className="liste-equipement">
        {profil.ressources.map((ressource) => (
          <div key={ressource.id} className="ligne-ressource">
            <span>{ressource.nom}</span>
            <div className="controles-quantite">
              <button
                onClick={() =>
                  modifierQuantite(
                    ressource.id,
                    ressource.quantite_disponible - 1
                  )
                }
              >
                -
              </button>
              <span>{ressource.quantite_disponible}</span>
              <button
                onClick={() =>
                  modifierQuantite(
                    ressource.id,
                    ressource.quantite_disponible + 1
                  )
                }
              >
                +
              </button>
              <button
                className="bouton-supprimer"
                onClick={() => supprimerRessource(ressource.id)}
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Profil;
