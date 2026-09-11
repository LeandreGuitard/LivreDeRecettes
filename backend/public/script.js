async function chargerToutesLesRecettes() {
  const reponse = await fetch('/recettes');
  const recettes = await reponse.json();

  const conteneur = document.getElementById('liste-recettes');
  conteneur.innerHTML = ''; // vide la liste avant de la reconstruire

  recettes.forEach((recette) => {
    const ligne = document.createElement('div');
    ligne.textContent = `${recette.nom} - ${recette.cout_estime} € `;

    const boutonSupprimer = document.createElement('button');
    boutonSupprimer.textContent = 'Supprimer';
    boutonSupprimer.addEventListener('click', async () => {
      await fetch(`/recettes/${recette.id}`, { method: 'DELETE' });
      chargerToutesLesRecettes(); // recharge la liste après suppression
    });

    ligne.appendChild(boutonSupprimer);
    conteneur.appendChild(ligne);
  });
}

chargerToutesLesRecettes(); // appel initial au chargement de la page

const formulaire = document.getElementById('form-recette');

formulaire.addEventListener('submit', async function (event) {
  event.preventDefault(); // empêche le rechargement de la page (comportement par défaut d'un formulaire)

  const nouvelleRecette = {
    nom: document.getElementById('input-nom').value,
    portions: Number(document.getElementById('input-portions').value),
    cout_estime: Number(document.getElementById('input-cout').value),
  };

  await fetch('/recettes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(nouvelleRecette),
  });

  formulaire.reset(); // vide les champs après envoi
  chargerToutesLesRecettes(); // on va écrire cette fonction juste après
});
