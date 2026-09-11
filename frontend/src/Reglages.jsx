import ListeSimple from './ListeSimple';
import './Reglages.css';
import GestionIngredients from './GestionIngredients';

function Reglages() {
  return (
    <div className="reglages">
      <h1>Réglages</h1>
      <hr />

      <div className="grille-reglages">
        <ListeSimple titre="Types de recette" endpoint="types-recette" />
        <ListeSimple titre="Tags" endpoint="tags" />
        <ListeSimple titre="Lieux d'achat" endpoint="lieux-achat" />
        <ListeSimple titre="Ressources" endpoint="ressources" />
      </div>

      <hr />
      <GestionIngredients />
    </div>
  );
}

export default Reglages;
