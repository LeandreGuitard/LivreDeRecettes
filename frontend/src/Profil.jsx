import { useState, useEffect } from 'react'
import { API_URL } from './config'
import { Plus, Minus, Trash2, Pencil, Check, X } from 'lucide-react'
import './Profil.css'

function Profil({ profilId, onChangerProfil }) {
  const [profils, setProfils] = useState([])
  const [profil, setProfil] = useState(null)
  const [toutesRessources, setToutesRessources] = useState([])
  const [nouveauNomProfil, setNouveauNomProfil] = useState('')
  const [renommageId, setRenommageId] = useState(null)
  const [nomEnCoursEdition, setNomEnCoursEdition] = useState('')

  const chargerProfils = () => {
    fetch(`${API_URL}/profils`).then(r => r.json()).then(setProfils)
  }

  const chargerProfilActif = () => {
    if (!profilId) return
    fetch(`${API_URL}/profils/${profilId}`).then(r => r.json()).then(setProfil)
  }

  useEffect(() => {
    chargerProfils()
    fetch(`${API_URL}/ressources`).then(r => r.json()).then(setToutesRessources)
  }, [])

  useEffect(() => {
    chargerProfilActif()
  }, [profilId])

  const creerProfil = async (e) => {
    e.preventDefault()
    if (!nouveauNomProfil.trim()) return

    const reponse = await fetch(`${API_URL}/profils`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom: nouveauNomProfil }),
    })
    const { id } = await reponse.json()

    setNouveauNomProfil('')
    chargerProfils()
    onChangerProfil(id)
  }

  const demarrerRenommage = (p) => {
    setRenommageId(p.id)
    setNomEnCoursEdition(p.nom)
  }

  const validerRenommage = async () => {
    await fetch(`${API_URL}/profils/${renommageId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom: nomEnCoursEdition }),
    })
    const idRenomme = renommageId
    setRenommageId(null)
    chargerProfils()
    if (idRenomme === profilId) chargerProfilActif()
  }

  const supprimerProfil = async (id, e) => {
    e.stopPropagation()

    if (profils.length <= 1) {
      alert("Impossible de supprimer le dernier profil restant.")
      return
    }
    if (!window.confirm('Supprimer ce profil et son équipement associé ?')) return

    const profilDeRepli = profils.find(p => p.id !== id)

    await fetch(`${API_URL}/profils/${id}`, { method: 'DELETE' })
    chargerProfils()

    if (id === profilId && profilDeRepli) {
      onChangerProfil(profilDeRepli.id)
    }
  }

  const modifierQuantite = async (ressourceId, nouvelleQuantite) => {
    if (nouvelleQuantite < 1) return
    await fetch(`${API_URL}/profils/${profilId}/ressources/${ressourceId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantite: nouvelleQuantite }),
    })
    chargerProfilActif()
  }

  const supprimerRessource = async (ressourceId) => {
    await fetch(`${API_URL}/profils/${profilId}/ressources/${ressourceId}`, { method: 'DELETE' })
    chargerProfilActif()
  }

  const ajouterRessource = async (ressourceId) => {
    if (!ressourceId) return
    await fetch(`${API_URL}/profils/${profilId}/ressources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ressource_id: Number(ressourceId), quantite: 1 }),
    })
    chargerProfilActif()
  }

  if (!profil) return <p>Chargement...</p>

  const idsDejaAjoutes = profil.ressources.map(r => r.id)
  const ressourcesDisponibles = toutesRessources.filter(r => !idsDejaAjoutes.includes(r.id))

  return (
    <div className="profil">
      <h1>Profils d'équipement</h1>
      <p className="aide-profil">
        Un profil par cuisine (la tienne, celle de tes parents, un logement de vacances...).
        Change de profil pour voir et modifier l'équipement disponible à cet endroit précis.
      </p>
      <hr />

      <div className="liste-profils">
        {profils.map(p => (
          <div
            key={p.id}
            className={`chip-profil ${p.id === profilId ? 'actif' : ''}`}
            onClick={() => onChangerProfil(p.id)}
          >
            {renommageId === p.id ? (
              <>
                <input
                  type="text"
                  value={nomEnCoursEdition}
                  onChange={(e) => setNomEnCoursEdition(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                />
                <Check size={14} strokeWidth={2} onClick={(e) => { e.stopPropagation(); validerRenommage() }} />
                <X size={14} strokeWidth={2} onClick={(e) => { e.stopPropagation(); setRenommageId(null) }} />
              </>
            ) : (
              <>
                <span>{p.nom}</span>
                <Pencil size={13} strokeWidth={2} onClick={(e) => { e.stopPropagation(); demarrerRenommage(p) }} />
                <Trash2 size={13} strokeWidth={2} onClick={(e) => supprimerProfil(p.id, e)} />
              </>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={creerProfil} className="form-nouveau-profil">
        <input
          type="text"
          placeholder="Nom du nouveau profil (ex: Cuisine de mes parents)"
          value={nouveauNomProfil}
          onChange={(e) => setNouveauNomProfil(e.target.value)}
        />
        <button type="submit"><Plus size={14} strokeWidth={2} /> Créer</button>
      </form>

      <hr />

      <div className="entete-equipement">
        <h2>Équipement — {profil.nom}</h2>
        <select value="" onChange={(e) => ajouterRessource(e.target.value)}>
          <option value="">+ Ajouter une ressource</option>
          {ressourcesDisponibles.map(r => (
            <option key={r.id} value={r.id}>{r.nom}</option>
          ))}
        </select>
      </div>

      <div className="liste-equipement">
        {profil.ressources.map(ressource => (
          <div key={ressource.id} className="ligne-ressource">
            <span>{ressource.nom}</span>
            <div className="controles-quantite">
              <button onClick={() => modifierQuantite(ressource.id, ressource.quantite_disponible - 1)}>
                <Minus size={14} strokeWidth={2} />
              </button>
              <span>{ressource.quantite_disponible}</span>
              <button onClick={() => modifierQuantite(ressource.id, ressource.quantite_disponible + 1)}>
                <Plus size={14} strokeWidth={2} />
              </button>
              <button className="bouton-supprimer" onClick={() => supprimerRessource(ressource.id)}>
                <Trash2 size={14} strokeWidth={2} />
              </button>
            </div>
          </div>
        ))}
        {profil.ressources.length === 0 && (
          <p className="message-vide">Aucun équipement ajouté pour ce profil.</p>
        )}
      </div>
    </div>
  )
}

export default Profil