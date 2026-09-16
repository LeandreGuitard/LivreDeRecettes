const initSqlJs = require('sql.js');
const fs = require('fs');

let db;

async function initDB() {
  const SQL = await initSqlJs();

  if (fs.existsSync('recettes.db')) {
    const fileBuffer = fs.readFileSync('recettes.db');
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS types_recette (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS recettes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      type_id INTEGER,
      portions_base INTEGER,
      description TEXT,
      photo_url TEXT,
      FOREIGN KEY (type_id) REFERENCES types_recette(id)
    );

    CREATE TABLE IF NOT EXISTS recettes_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recette_id INTEGER,
      tag_id INTEGER,
      FOREIGN KEY (recette_id) REFERENCES recettes(id),
      FOREIGN KEY (tag_id) REFERENCES tags(id)
    );

    CREATE TABLE IF NOT EXISTS lieux_achat (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL UNIQUE,
      unite TEXT NOT NULL,
      prix_moyen REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ingredients_lieux_achat (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ingredient_id INTEGER NOT NULL,
      lieu_achat_id INTEGER NOT NULL,
      FOREIGN KEY (ingredient_id) REFERENCES ingredients(id),
      FOREIGN KEY (lieu_achat_id) REFERENCES lieux_achat(id)
    );

    CREATE TABLE IF NOT EXISTS ressources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS etapes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recette_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      duree_active_min INTEGER NOT NULL,
      delai_attente_min INTEGER NOT NULL DEFAULT 0,
      groupe_alternatif INTEGER,
      FOREIGN KEY (recette_id) REFERENCES recettes(id)
    );

    CREATE TABLE IF NOT EXISTS etapes_ressources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      etape_id INTEGER NOT NULL,
      ressource_id INTEGER NOT NULL,
      FOREIGN KEY (etape_id) REFERENCES etapes(id),
      FOREIGN KEY (ressource_id) REFERENCES ressources(id)
    );

    CREATE TABLE IF NOT EXISTS etapes_dependances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      etape_id INTEGER NOT NULL,
      depend_de_etape_id INTEGER NOT NULL,
      FOREIGN KEY (etape_id) REFERENCES etapes(id),
      FOREIGN KEY (depend_de_etape_id) REFERENCES etapes(id)
    );

    -- Remplace l'ancienne table composants_recette : les ingrédients/sous-recettes
    -- appartiennent maintenant à une étape précise, plus à la recette entière.
    CREATE TABLE IF NOT EXISTS etape_composants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      etape_id INTEGER NOT NULL,
      ingredient_id INTEGER,
      sous_recette_id INTEGER,
      quantite REAL NOT NULL,
      groupe_alternatif INTEGER,
      FOREIGN KEY (etape_id) REFERENCES etapes(id),
      FOREIGN KEY (ingredient_id) REFERENCES ingredients(id),
      FOREIGN KEY (sous_recette_id) REFERENCES recettes(id),
      CHECK (
        (ingredient_id IS NOT NULL AND sous_recette_id IS NULL)
        OR
        (ingredient_id IS NULL AND sous_recette_id IS NOT NULL)
      )
    );

    CREATE TABLE IF NOT EXISTS profils_equipement (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      est_par_defaut INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS profil_ressources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profil_id INTEGER NOT NULL,
      ressource_id INTEGER NOT NULL,
      quantite_disponible INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (profil_id) REFERENCES profils_equipement(id),
      FOREIGN KEY (ressource_id) REFERENCES ressources(id)
    );

    CREATE TABLE IF NOT EXISTS plannings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date_cible TEXT NOT NULL,
      profil_equipement_id INTEGER,
      FOREIGN KEY (profil_equipement_id) REFERENCES profils_equipement(id)
    );

    CREATE TABLE IF NOT EXISTS plannings_recettes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      planning_id INTEGER NOT NULL,
      recette_id INTEGER NOT NULL,
      portions_souhaitees INTEGER NOT NULL,
      FOREIGN KEY (planning_id) REFERENCES plannings(id),
      FOREIGN KEY (recette_id) REFERENCES recettes(id)
    );
  `);

  const typesDejaPresent = db.exec(
    'SELECT COUNT(*) as total FROM types_recette'
  )[0];
  if (!typesDejaPresent || typesDejaPresent.values[0][0] === 0) {
    db.run(
      "INSERT INTO types_recette (nom) VALUES ('Entrée'), ('Plat'), ('Dessert')"
    );
    db.run(
      "INSERT INTO tags (nom) VALUES ('Épicé'), ('Sans gluten'), ('Végétarien')"
    );

    db.run(
      'INSERT INTO recettes (nom, type_id, portions_base, description) VALUES (?, ?, ?, ?)',
      [
        'Ramen tonkotsu',
        2,
        2,
        'Un bouillon mijoté 12h, accompagné de chashu mariné.',
      ]
    );
    db.run(
      'INSERT INTO recettes (nom, type_id, portions_base, description) VALUES (?, ?, ?, ?)',
      ['Chashu', 2, 4, 'Poitrine de porc marinée et braisée.']
    );

    db.run('INSERT INTO recettes_tags (recette_id, tag_id) VALUES (1, 1)');
  }

  const lieuxDejaPresent = db.exec(
    'SELECT COUNT(*) as total FROM lieux_achat'
  )[0];
  if (!lieuxDejaPresent || lieuxDejaPresent.values[0][0] === 0) {
    db.run(
      "INSERT INTO lieux_achat (nom) VALUES ('Supermarché'), ('Épicerie asiatique'), ('Boucherie')"
    );

    db.run(
      'INSERT INTO ingredients (nom, unite, prix_moyen) VALUES (?, ?, ?)',
      ['Nouilles fraîches', 'g', 0.012]
    );
    db.run(
      'INSERT INTO ingredients_lieux_achat (ingredient_id, lieu_achat_id) VALUES (1, 2)'
    );

    db.run(
      'INSERT INTO ingredients (nom, unite, prix_moyen) VALUES (?, ?, ?)',
      ['Poitrine de porc', 'g', 0.015]
    );
    db.run(
      'INSERT INTO ingredients_lieux_achat (ingredient_id, lieu_achat_id) VALUES (2, 3)'
    );

    db.run(
      'INSERT INTO ingredients (nom, unite, prix_moyen) VALUES (?, ?, ?)',
      ['Sauce soja', 'ml', 0.008]
    );
    db.run(
      'INSERT INTO ingredients_lieux_achat (ingredient_id, lieu_achat_id) VALUES (3, 1), (3, 2)'
    );
  }

  // --- ressources ---
  const ressourcesDejaPresent = db.exec(
    'SELECT COUNT(*) as total FROM ressources'
  )[0];
  if (!ressourcesDejaPresent || ressourcesDejaPresent.values[0][0] === 0) {
    db.run(
      "INSERT INTO ressources (nom) VALUES ('Casserole'), ('Hachoir électrique'), ('Couteau'), ('Plaque de cuisson')"
    );
  }

  // --- étapes, avec leurs ingrédients désormais attachés directement à elles ---
  const etapesDejaPresent = db.exec('SELECT COUNT(*) as total FROM etapes')[0];
  if (!etapesDejaPresent || etapesDejaPresent.values[0][0] === 0) {
    // Ramen (recette 1)
    db.run(
      'INSERT INTO etapes (recette_id, description, duree_active_min, delai_attente_min) VALUES (?, ?, ?, ?)',
      [1, 'Faire cuire les nouilles', 5, 0]
    ); // id 1
    db.run(
      'INSERT INTO etapes (recette_id, description, duree_active_min, delai_attente_min, groupe_alternatif) VALUES (?, ?, ?, ?, ?)',
      [1, "Hacher l'oignon au hachoir électrique", 2, 0, 1]
    ); // id 2
    db.run(
      'INSERT INTO etapes (recette_id, description, duree_active_min, delai_attente_min, groupe_alternatif) VALUES (?, ?, ?, ?, ?)',
      [1, "Hacher l'oignon au couteau", 8, 0, 1]
    ); // id 3
    db.run(
      'INSERT INTO etapes (recette_id, description, duree_active_min, delai_attente_min) VALUES (?, ?, ?, ?)',
      [1, 'Assembler le bol', 3, 0]
    ); // id 4

    // Chashu (recette 2)
    db.run(
      'INSERT INTO etapes (recette_id, description, duree_active_min, delai_attente_min) VALUES (?, ?, ?, ?)',
      [2, 'Faire mariner la poitrine de porc', 15, 2880]
    ); // id 5
    db.run(
      'INSERT INTO etapes (recette_id, description, duree_active_min, delai_attente_min) VALUES (?, ?, ?, ?)',
      [2, 'Braiser le chashu', 180, 0]
    ); // id 6

    db.run(
      'INSERT INTO etapes_ressources (etape_id, ressource_id) VALUES (2, 2)'
    ); // hachoir électrique
    db.run(
      'INSERT INTO etapes_ressources (etape_id, ressource_id) VALUES (3, 3)'
    ); // couteau
    db.run(
      'INSERT INTO etapes_ressources (etape_id, ressource_id) VALUES (6, 1)'
    ); // casserole

    db.run(
      'INSERT INTO etapes_dependances (etape_id, depend_de_etape_id) VALUES (4, 1)'
    );
    db.run(
      'INSERT INTO etapes_dependances (etape_id, depend_de_etape_id) VALUES (4, 2)'
    );
    db.run(
      'INSERT INTO etapes_dependances (etape_id, depend_de_etape_id) VALUES (4, 3)'
    );
    db.run(
      'INSERT INTO etapes_dependances (etape_id, depend_de_etape_id) VALUES (6, 5)'
    );

    // Ingrédients attachés aux étapes concernées
    db.run(
      'INSERT INTO etape_composants (etape_id, ingredient_id, quantite) VALUES (?, ?, ?)',
      [1, 1, 200]
    ); // nouilles -> cuisson
    db.run(
      'INSERT INTO etape_composants (etape_id, sous_recette_id, quantite) VALUES (?, ?, ?)',
      [4, 2, 1]
    ); // chashu -> assemblage
    db.run(
      'INSERT INTO etape_composants (etape_id, ingredient_id, quantite) VALUES (?, ?, ?)',
      [5, 2, 300]
    ); // porc -> marinade
    db.run(
      'INSERT INTO etape_composants (etape_id, ingredient_id, quantite) VALUES (?, ?, ?)',
      [5, 3, 100]
    ); // sauce soja -> marinade
  }

  const profilsDejaPresent = db.exec(
    'SELECT COUNT(*) as total FROM profils_equipement'
  )[0];
  if (!profilsDejaPresent || profilsDejaPresent.values[0][0] === 0) {
    db.run(
      'INSERT INTO profils_equipement (nom, est_par_defaut) VALUES (?, ?)',
      ['Cuisine maison', 1]
    );
  }

  sauvegarder();

  return db;
}

function sauvegarder() {
  const data = db.export();
  fs.writeFileSync('recettes.db', Buffer.from(data));
}

module.exports = { initDB, sauvegarder, getDB: () => db };
