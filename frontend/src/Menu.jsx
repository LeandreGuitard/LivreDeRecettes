import { useState, useEffect } from 'react';
import './Menu.css';

function Menu({
  onSelectionnerRecette,
  onOuvrirProfil,
  onOuvrirRecherche,
  onOuvrirFormRecette,
  cleRafraichissement,
  onOuvrirPlanification,
}) {
  const [recettes, setRecettes] = useState([]);
  const [sousRecettes, setSousRecettes] = useState({});
  const [ouverts, setOuverts] = useState({}); // { recetteId: true/false }

  useEffect(() => {
    fetch('http://localhost:3000/recettes')
      .then((reponse) => reponse.json())
      .then(async (donnees) => {
        setRecettes(donnees);

        const map = {};
        for (const recette of donnees) {
          const reponseResume = await fetch(
            `http://localhost:3000/recettes/${recette.id}/ingredients-resume`
          );
          const resume = await reponseResume.json();
          const enfants = resume
            .filter((item) => item.type === 'sous_recette')
            .map((item) => ({ id: item.id, nom: item.nom }));

          if (enfants.length > 0) map[recette.id] = enfants;
        }
        setSousRecettes(map);
      });
  }, [cleRafraichissement]);

  const basculerOuvert = (id) => {
    setOuverts((precedent) => ({ ...precedent, [id]: !precedent[id] }));
  };

  const recettesParType = {};
  recettes.forEach((recette) => {
    if (!recettesParType[recette.type_nom])
      recettesParType[recette.type_nom] = [];
    recettesParType[recette.type_nom].push(recette);
  });

  return (
    <aside className="menu">
      <button className="bouton-profil" onClick={onOuvrirProfil}>
        👤 Cuisine maison
      </button>
      <hr />
      <button onClick={onOuvrirFormRecette}>+ Ajouter une recette</button>
      <button onClick={onOuvrirRecherche}>🔍 Rechercher</button>
      <button onClick={onOuvrirPlanification}>📅 Planifier un repas</button>
      <hr />

      <div className="liste-recettes">
        {Object.entries(recettesParType).map(([type, recettesDuType]) => (
          <div key={type} className="groupe-type">
            <p className="titre-type">{type}</p>

            {recettesDuType.map((recette) => {
              const enfants = sousRecettes[recette.id] ?? [];
              const aDesEnfants = enfants.length > 0;
              const estOuvert = ouverts[recette.id];

              return (
                <div key={recette.id}>
                  <div
                    className="item-recette"
                    onClick={() => onSelectionnerRecette(recette.id)}
                  >
                    {aDesEnfants && (
                      <span
                        className="chevron"
                        onClick={(e) => {
                          e.stopPropagation();
                          basculerOuvert(recette.id);
                        }}
                      >
                        {estOuvert ? '▾' : '▸'}
                      </span>
                    )}
                    {recette.nom}
                  </div>

                  {aDesEnfants &&
                    estOuvert &&
                    enfants.map((sousRecette) => (
                      <div
                        key={sousRecette.id}
                        className="item-recette item-sous-recette"
                        onClick={() => onSelectionnerRecette(sousRecette.id)}
                      >
                        {sousRecette.nom}
                      </div>
                    ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </aside>
  );
}

export default Menu;
