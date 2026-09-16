import { useState, useEffect } from 'react';
import { API_URL } from './config';
import { ChefHat, Plus, Search, Calendar, ChevronRight } from 'lucide-react';
import './Menu.css';

function Menu({
  onSelectionnerRecette,
  onOuvrirProfil,
  onOuvrirRecherche,
  onOuvrirFormRecette,
  onOuvrirPlanification,
  cleRafraichissement,
}) {
  const [recettes, setRecettes] = useState([]);
  const [sousRecettes, setSousRecettes] = useState({});
  const [ouverts, setOuverts] = useState({});
  const [typesOuverts, setTypesOuverts] = useState({});

  useEffect(() => {
    fetch(`${API_URL}/recettes`)
      .then((reponse) => reponse.json())
      .then(async (donnees) => {
        setRecettes(donnees);

        const map = {};
        for (const recette of donnees) {
          const reponseResume = await fetch(
            `${API_URL}/recettes/${recette.id}/ingredients-resume`
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

  const estTypeOuvert = (type) => typesOuverts[type] ?? true;

  const basculerTypeOuvert = (type) => {
    setTypesOuverts((precedent) => ({
      ...precedent,
      [type]: !estTypeOuvert(type),
    }));
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
        <ChefHat size={18} strokeWidth={1.75} />
        <span>Cuisine maison</span>
      </button>

      <hr />

      <button className="bouton-menu-action" onClick={onOuvrirFormRecette}>
        <Plus size={16} strokeWidth={2} />
        <span>Ajouter une recette</span>
      </button>
      <button className="bouton-menu-action" onClick={onOuvrirRecherche}>
        <Search size={16} strokeWidth={1.75} />
        <span>Rechercher</span>
      </button>
      <button className="bouton-menu-action" onClick={onOuvrirPlanification}>
        <Calendar size={16} strokeWidth={1.75} />
        <span>Planifier un repas</span>
      </button>

      <hr />

      <div className="liste-recettes">
        {Object.entries(recettesParType).map(([type, recettesDuType]) => {
          const ouvert = estTypeOuvert(type);

          return (
            <div key={type} className="groupe-type">
              <div
                className="entete-type"
                onClick={() => basculerTypeOuvert(type)}
              >
                <ChevronRight
                  size={14}
                  strokeWidth={2}
                  className={`chevron-icone ${ouvert ? 'ouvert' : ''}`}
                />
                <p className="titre-type">{type}</p>
              </div>

              {ouvert &&
                recettesDuType.map((recette) => {
                  const enfants = sousRecettes[recette.id] ?? [];
                  const aDesEnfants = enfants.length > 0;
                  const estOuvert = ouverts[recette.id];

                  return (
                    <div key={recette.id}>
                      <div className="ligne-recette">
                        {aDesEnfants ? (
                          <ChevronRight
                            size={14}
                            strokeWidth={2}
                            className={`chevron-icone chevron-recette ${
                              estOuvert ? 'ouvert' : ''
                            }`}
                            onClick={() => basculerOuvert(recette.id)}
                          />
                        ) : (
                          <span className="chevron-espace" />
                        )}

                        <div
                          className="item-recette"
                          onClick={() => onSelectionnerRecette(recette.id)}
                        >
                          {recette.nom}
                        </div>
                      </div>

                      {aDesEnfants &&
                        estOuvert &&
                        enfants.map((sousRecette) => (
                          <div
                            key={sousRecette.id}
                            className="item-recette item-sous-recette"
                            onClick={() =>
                              onSelectionnerRecette(sousRecette.id)
                            }
                          >
                            {sousRecette.nom}
                          </div>
                        ))}
                    </div>
                  );
                })}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export default Menu;
