import { useState, useEffect } from 'react';
import './Recherche.css';

function Recherche({ onSelectionnerRecette }) {
  const [texte, setTexte] = useState('');
  const [typeId, setTypeId] = useState('');
  const [tagId, setTagId] = useState('');
  const [ingredientId, setIngredientId] = useState('');

  const [types, setTypes] = useState([]);
  const [tags, setTags] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [resultats, setResultats] = useState([]);

  useEffect(() => {
    fetch('http://localhost:3000/types-recette')
      .then((r) => r.json())
      .then(setTypes);
    fetch('http://localhost:3000/tags')
      .then((r) => r.json())
      .then(setTags);
    fetch('http://localhost:3000/ingredients')
      .then((r) => r.json())
      .then(setIngredients);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (texte) params.set('texte', texte);
    if (typeId) params.set('type_id', typeId);
    if (tagId) params.set('tag_id', tagId);
    if (ingredientId) params.set('ingredient_id', ingredientId);

    fetch(`http://localhost:3000/recherche/recettes?${params.toString()}`)
      .then((reponse) => reponse.json())
      .then((donnees) => setResultats(donnees));
  }, [texte, typeId, tagId, ingredientId]);

  return (
    <div className="recherche">
      <h1>Rechercher</h1>

      <input
        type="text"
        placeholder="Nom de la recette..."
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        className="barre-recherche"
      />

      <div className="filtres">
        <select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
          <option value="">Tous les types</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nom}
            </option>
          ))}
        </select>

        <select value={tagId} onChange={(e) => setTagId(e.target.value)}>
          <option value="">Tous les tags</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nom}
            </option>
          ))}
        </select>

        <select
          value={ingredientId}
          onChange={(e) => setIngredientId(e.target.value)}
        >
          <option value="">Tous les ingrédients</option>
          {ingredients.map((i) => (
            <option key={i.id} value={i.id}>
              {i.nom}
            </option>
          ))}
        </select>
      </div>

      <div className="resultats-recherche">
        {resultats.map((recette) => (
          <div
            key={recette.id}
            className="ligne-resultat"
            onClick={() => onSelectionnerRecette(recette.id)}
          >
            <span className="nom-resultat">{recette.nom}</span>
            <span className="badge badge-type">{recette.type_nom}</span>
          </div>
        ))}
        {resultats.length === 0 && (
          <p className="message-vide">Aucune recette trouvée</p>
        )}
      </div>
    </div>
  );
}

export default Recherche;
