import { API_URL } from './config'
import { useState, useEffect } from 'react';
import { Trash2, Pencil, Plus, Minus, X, Download } from 'lucide-react';

function ListeSimple({ titre, endpoint }) {
  const [elements, setElements] = useState([]);
  const [nouveauNom, setNouveauNom] = useState('');

  const charger = () => {
    fetch(`${API_URL}/${endpoint}`)
      .then((reponse) => reponse.json())
      .then((donnees) => setElements(donnees));
  };

  useEffect(() => {
    charger();
  }, [endpoint]);

  const ajouter = async (e) => {
    e.preventDefault();
    if (!nouveauNom.trim()) return;

    await fetch(`${API_URL}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom: nouveauNom }),
    });
    setNouveauNom('');
    charger();
  };

  const supprimer = async (id) => {
    await fetch(`${API_URL}/${endpoint}/${id}`, {
      method: 'DELETE',
    });
    charger();
  };

  return (
    <div className="section-liste">
      <h2>{titre}</h2>

      <form onSubmit={ajouter} className="form-ajout">
        <input
          type="text"
          value={nouveauNom}
          onChange={(e) => setNouveauNom(e.target.value)}
          placeholder={`Nouveau ${titre.toLowerCase()}`}
        />
        <button type="submit">Ajouter</button>
      </form>

      <div className="liste-elements">
        {elements.map((el) => (
          <div key={el.id} className="ligne-element">
            <span>{el.nom}</span>
            <button
              className="bouton-supprimer"
              onClick={() => supprimer(el.id)}
            >
              <Trash2 size={14} strokeWidth={2} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ListeSimple;
