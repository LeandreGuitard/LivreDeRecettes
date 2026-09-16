import { API_URL } from './config'
import { useState, useEffect } from 'react';
import { Trash2, Pencil, Plus, Minus, X, Download } from 'lucide-react';

function GestionIngredients() {
  const [ingredients, setIngredients] = useState([]);
  const [lieuxAchat, setLieuxAchat] = useState([]);

  const [editingId, setEditingId] = useState(null); // null = mode création
  const [nom, setNom] = useState('');
  const [unite, setUnite] = useState('');
  const [prixMoyen, setPrixMoyen] = useState('');
  const [lieuxSelectionnes, setLieuxSelectionnes] = useState([]);

  const charger = () => {
    fetch('http://localhost:3000/ingredients')
      .then((r) => r.json())
      .then(setIngredients);
  };

  useEffect(() => {
    charger();
    fetch('http://localhost:3000/lieux-achat')
      .then((r) => r.json())
      .then(setLieuxAchat);
  }, []);

  const reinitialiserFormulaire = () => {
    setEditingId(null);
    setNom('');
    setUnite('');
    setPrixMoyen('');
    setLieuxSelectionnes([]);
  };

  const chargerPourEdition = (ingredient) => {
    setEditingId(ingredient.id);
    setNom(ingredient.nom);
    setUnite(ingredient.unite);
    setPrixMoyen(ingredient.prix_moyen);
    setLieuxSelectionnes(ingredient.lieux_achat.map((l) => l.id));
  };

  const basculerLieu = (lieuId) => {
    setLieuxSelectionnes((precedent) =>
      precedent.includes(lieuId)
        ? precedent.filter((id) => id !== lieuId)
        : [...precedent, lieuId]
    );
  };

  const soumettre = async (e) => {
    e.preventDefault();
    if (!nom || !unite || !prixMoyen) return;

    const corps = {
      nom,
      unite,
      prix_moyen: Number(prixMoyen),
      lieux_achat_id: lieuxSelectionnes,
    };

    if (editingId) {
      await fetch(`http://localhost:3000/ingredients/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corps),
      });
    } else {
      await fetch('http://localhost:3000/ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corps),
      });
    }

    reinitialiserFormulaire();
    charger();
  };

  const supprimer = async (id) => {
    if (!window.confirm('Supprimer cet ingrédient ?')) return;
    await fetch(`http://localhost:3000/ingredients/${id}`, {
      method: 'DELETE',
    });
    charger();
  };

  return (
    <div className="section-liste section-ingredients">
      <h2>Ingrédients</h2>

      <form onSubmit={soumettre} className="form-ingredient">
        <input
          type="text"
          placeholder="Nom"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
        />
        <input
          type="text"
          placeholder="Unité (g, ml, pièce...)"
          value={unite}
          onChange={(e) => setUnite(e.target.value)}
        />
        <input
          type="number"
          step="0.001"
          placeholder="Prix moyen / unité (€)"
          value={prixMoyen}
          onChange={(e) => setPrixMoyen(e.target.value)}
        />

        <div className="choix-tags">
          {lieuxAchat.map((lieu) => (
            <button
              type="button"
              key={lieu.id}
              className={`badge-choix ${
                lieuxSelectionnes.includes(lieu.id) ? 'actif' : ''
              }`}
              onClick={() => basculerLieu(lieu.id)}
            >
              {lieu.nom}
            </button>
          ))}
        </div>

        <div className="actions-form-ingredient">
          <button type="submit">{editingId ? 'Enregistrer' : 'Ajouter'}</button>
          {editingId && (
            <button type="button" onClick={reinitialiserFormulaire}>
              Annuler
            </button>
          )}
        </div>
      </form>

      <div className="liste-ingredients-gestion">
        {ingredients.map((ingredient) => (
          <div key={ingredient.id} className="ligne-ingredient-gestion">
            <div className="info-ingredient">
              <span className="nom-ingredient">{ingredient.nom}</span>
              <span className="detail-ingredient">
                {ingredient.prix_moyen} €/{ingredient.unite}
                {ingredient.lieux_achat.length > 0 &&
                  ` · ${ingredient.lieux_achat.map((l) => l.nom).join(', ')}`}
              </span>
            </div>
            <div className="actions-ingredient">
              <button onClick={() => chargerPourEdition(ingredient)}>
                <Pencil size={14} strokeWidth={2} />
              </button>
              <button
                className="bouton-supprimer"
                onClick={() => supprimer(ingredient.id)}
              >
                <Trash2 size={14} strokeWidth={2} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default GestionIngredients;
