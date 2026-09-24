import { API_URL } from './config';
import { useState, useEffect } from 'react'
import Menu from './Menu';
import FicheRecette from './FicheRecette';
import Profil from './Profil';
import Reglages from './Reglages';
import Recherche from './Recherche';
import FormRecette from './FormRecette';
import Planification from './Planification';

import './App.css';

function App() {
  const [vue, setVue] = useState('recette');
  const [recetteSelectionneeId, setRecetteSelectionneeId] = useState(null);
  const [cleRafraichissement, setCleRafraichissement] = useState(0);

  const selectionnerRecette = (id) => {
    setRecetteSelectionneeId(id);
    setVue('recette');
  };

  const recetteCreee = (id) => {
    setCleRafraichissement((precedent) => precedent + 1);
    selectionnerRecette(id);
  };

  const enregistrementReussi = (id) => {
    setCleRafraichissement((precedent) => precedent + 1);
    selectionnerRecette(id);
  };

  const supprimerRecette = async (id) => {
    if (!window.confirm('Supprimer définitivement cette recette ?')) return;
    await fetch(`${API_URL}/recettes/${id}`, { method: 'DELETE' });
    setCleRafraichissement((precedent) => precedent + 1);
    setRecetteSelectionneeId(null);
    setVue('recette');
  };

  const [profilActifId, setProfilActifId] = useState(() => {
    const sauvegarde = localStorage.getItem('profilActifId')
    return sauvegarde ? Number(sauvegarde) : 1
  })
  const [profils, setProfils] = useState([])
  
  useEffect(() => {
    localStorage.setItem('profilActifId', profilActifId)
  }, [profilActifId])
  
  useEffect(() => {
    fetch(`${API_URL}/profils`).then(r => r.json()).then(setProfils)
  }, [vue])
  
  const nomProfilActif = profils.find(p => p.id === profilActifId)?.nom || 'Profil'

  return (
    <div className="app">
      <Menu
        onSelectionnerRecette={selectionnerRecette}
        onOuvrirProfil={() => setVue('profil')}
        onOuvrirRecherche={() => setVue('recherche')}
        onOuvrirFormRecette={() => setVue('nouvelle-recette')}
        onOuvrirPlanification={() => setVue('planification')}
        cleRafraichissement={cleRafraichissement}
        nomProfilActif={nomProfilActif}
/>

      <main className="contenu-principal">
        <button className="bouton-reglages" onClick={() => setVue('reglages')}>
          ⚙️
        </button>

        {vue === 'recette' && (
          <FicheRecette
            id={recetteSelectionneeId}
            onModifier={() => setVue('editer-recette')}
            onSupprimer={supprimerRecette}
          />
        )}
        {vue === 'profil' && <Profil profilId={profilActifId} onChangerProfil={setProfilActifId} />}
        {vue === 'reglages' && <Reglages />}
        {vue === 'recherche' && (
          <Recherche onSelectionnerRecette={selectionnerRecette} />
        )}
        {vue === 'nouvelle-recette' && (
          <FormRecette onEnregistree={enregistrementReussi} />
        )}
        {vue === 'editer-recette' && (
          <FormRecette
            recetteId={recetteSelectionneeId}
            onEnregistree={enregistrementReussi}
          />
        )}
        {vue === 'planification' && <Planification />}
      </main>
    </div>
  );
}

export default App;
