# Guida alla configurazione — MongoDB cartelle cliniche

## Requisiti

- **MongoDB 5.0 o superiore**: l'operatore `$dateDiff` è disponibile dalla 5.0
- Uno strumento per eseguire gli script. Le due opzioni più semplici sono:
  - **MongoDB for VS Code** (estensione di Visual Studio Code, con i "playground");
  - **MongoDB Compass**, con la shell integrata (MONGOSH).

Non servono altre librerie: gli script sono JavaScript che gira direttamente dentro MongoDB.

## 1. Avvia MongoDB

Se non hai un server, il modo più semplice è installare **MongoDB Community Server** in locale (dal sito ufficiale di MongoDB), oppure creare un cluster gratuito su **MongoDB Atlas**.

Con l'installazione locale, la connessione di default è:

```
mongodb://localhost:27017
```

## 2. Scarica il progetto

```bash
git clone https://github.com/FilloFerro05/mongodb-cartelle-cliniche.git
cd mongodb-cartelle-cliniche
```

In alternativa scarica lo ZIP da GitHub (**Code → Download ZIP**) e decomprimilo.

## 3. Esegui lo script principale

### Opzione A — MongoDB for VS Code (consigliata)

1. In VS Code installa l'estensione **MongoDB for VS Code**.
2. Dalla barra laterale della MongoDB, collegati al server con la stringa di connessione.
3. Apri `progetto_cartelle_cliniche.mongodb.js`. L'estensione `.mongodb.js` è quella che l'estensione di VS Code riconosce come playground (il file resta comunque JavaScript valido). Se il pulsante Play non compare, controlla in basso a destra che il linguaggio del file sia impostato su MongoDB.
4. Avvia il playground con il pulsante **Play** in alto a destra.

Lo script crea il database, la collection, inserisce i dati e calcola le durate. Un playground mostra il risultato dell'**ultima** istruzione: per vedere l'output di ogni singolo punto, seleziona il blocco che ti interessa (ad esempio il punto 4) ed eseguilo da solo.

### Opzione B — MongoDB Compass

1. Collegati al server con Compass.
2. Apri la shell integrata (**_MONGOSH**) in basso.
3. Incolla lo script a blocchi (un punto alla volta). Se la riga `use("cartelle_cliniche")` non viene accettata, scrivi semplicemente `use cartelle_cliniche`.

Se il database non esiste ancora, MongoDB lo crea quando viene creata la prima collection. Puoi anche crearlo in anticipo dall'interfaccia di Compass.

## 4. Controlla il risultato

Se tutto è andato bene:

| Controllo | Valore atteso |
|-----------|---------------|
| Pazienti nella collection `pazienti` | 5 |
| Ricoveri totali (2 per paziente) | 10 |
| Durata dei singoli ricoveri | da 1 a 12 giorni |
| Punto 4: ricoveri analizzati | 10 |
| Punto 4: durata media | **5,9 giorni** |

## 5. Rieseguire lo script

Lo script è pensato per essere rieseguito da capo: il `db.pazienti.drop()` iniziale elimina la collection (con dati e indici) se esiste già, e poi viene ricreata. **Attenzione:** questo cancella i dati della collection `pazienti`.

## 6. Gli script extra

Vanno eseguiti **dopo** lo script principale, perché usano la collection già popolata:

| File | Cosa fa |
|------|---------|
| `extra/test_validazione.mongodb.js` | prova a inserire documenti sbagliati e mostra che vengono rifiutati; ogni riga del risultato deve avere `ok: true` |
| `extra/degenza_media_per_paziente.mongodb.js` | calcola la degenza media di ciascun paziente |

## 7. Personalizzazione

- **Nuovi pazienti:** aggiungi documenti all'`insertMany` del punto 2, con un `codice_paziente` nuovo (formato `PAZ-0006`) e almeno 2 ricoveri.
- **Minimo di ricoveri:** cambia `minItems: 2` nel validatore (punto 1) se vuoi ammettere pazienti con un solo ricovero.
- **Unità della degenza:** in `$dateDiff` cambia `unit: "day"` (ad esempio `"hour"`).

## Problemi comuni

| Problema | Soluzione |
|----------|-----------|
| `Document failed validation` all'inserimento | Il documento non rispetta il validatore: controlla il formato di `codice_paziente`, che le date siano `ISODate(...)` e non stringhe, che i ricoveri siano almeno 2 e che la dimissione non preceda il ricovero |
| `E11000 duplicate key error` | Esiste già un paziente con lo stesso `codice_paziente` |
| `Unrecognized expression '$dateDiff'` | La versione di MongoDB è troppo vecchia: serve la 5.0 o superiore. Controlla con `db.version()` |
| `Collection already exists` (o simile) alla creazione | Esegui lo script dall'inizio, così il `drop()` elimina la collection prima di ricrearla |
| Nei risultati le date non sono in formato giorno/mese/anno | Il formato testuale compare solo nell'aggregazione del punto 3; le date salvate restano `ISODate` |
| `use("cartelle_cliniche")` non viene accettato nella shell | È la sintassi dei playground: nella shell scrivi `use cartelle_cliniche` |
