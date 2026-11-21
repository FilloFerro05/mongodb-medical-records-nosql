# 🏥 MongoDB — Prototipo per cartelle cliniche

Prototipo di **database documentale con MongoDB** per rappresentare le cartelle cliniche dei reparti pilota di un ospedale: ogni paziente è **un unico documento** che contiene tutti i suoi ricoveri. Il progetto comprende la creazione della struttura con **validazione dello schema**, il popolamento con dati fittizi e il calcolo, con **pipeline di aggregazione**, della **durata media di degenza**.

Progetto realizzato come lavoro di portfolio nell'ambito di un corso di Database / NoSQL.

> ⚠️ Tutti i dati sono **fittizi**: nessun dato reale di pazienti.

## Il problema

I dati di ricovero vivono in tabelle rigide che obbligano a creare schemi separati ogni volta che un reparto aggiunge un campo. Un paziente può avere più ricoveri, ciascuno con diagnosi, anamnesi, prognosi e date, e si vuole tenere tutto insieme in un unico documento. MongoDB offre la flessibilità necessaria su dati strutturati e semi-strutturati, senza rifare la modellazione a ogni variazione.

Il prototipo deve dimostrare la fattibilità, con tre attività:

| Attività | Dove |
|----------|------|
| **Creazione della struttura**: database `cartelle_cliniche`, collection `pazienti` | Punto 1 |
| **Dati di prova**: almeno 5 pazienti con almeno 2 ricoveri ciascuno, durate diverse | Punto 2 |
| **Analisi delle degenze**: tempo medio in giorni tra ricovero e dimissione | Punti 3 e 4 |

## Il modello dei dati

Un documento per paziente, con i ricoveri **incorporati** in un array:

```js
{
  codice_paziente: "PAZ-0001",
  nome: "Mario Rossi",
  ricoveri: [
    {
      data: ISODate("2025-01-10T00:00:00Z"),
      diagnosi: "Polmonite batterica",
      anamnesi: "Febbre persistente, tosse e difficolta' respiratoria",
      prognosi: "Favorevole dopo terapia antibiotica e monitoraggio",
      data_dimissione: ISODate("2025-01-13T00:00:00Z")
    },
    { /* secondo ricovero */ }
  ]
}
```

I ricoveri stanno dentro il documento del paziente perché appartengono alla stessa cartella clinica e vengono analizzati insieme. Le date sono vere **BSON Date** (`ISODate`) e non stringhe, per poter calcolare le differenze temporali.

## Cosa fa lo script

| Punto | Contenuto |
|-------|-----------|
| **1** | `drop()` della collection (per poterla ricreare), `createCollection` con **validatore**, indice **univoco** su `codice_paziente` |
| **2** | Inserimento di 5 pazienti e 10 ricoveri, e controllo con `find()` |
| **3** | **Durata in giorni di ogni ricovero** (`$unwind`, `$project`, `$dateDiff`, `$sort`) |
| **4** | **Durata media di degenza** (`$group` con `$sum` e `$avg`) |
| **5** | Nota finale con le scelte fatte |

### Il validatore

Il validatore, con `validationLevel: "strict"` e `validationAction: "error"`, rifiuta i documenti che non lo rispettano. Controlla:

- ✅ `codice_paziente` stringa nel formato `PAZ-0001` · `nome` stringa non vuota
- ✅ `ricoveri` è un **array** con **almeno 2 elementi** (`minItems: 2`)
- ✅ ogni ricovero ha `data`, `diagnosi`, `anamnesi`, `prognosi`, `data_dimissione`
- ✅ le date sono **BSON Date**, non stringhe
- ✅ la **data di dimissione non precede la data di ricovero** (controllo con `$expr`)

Un **indice univoco** su `codice_paziente` impedisce di inserire due pazienti con lo stesso codice, e distingue gli omonimi.

## Risultato

Sui dati di prova (10 ricoveri):

```js
{
    ricoveri_analizzati: 10,
    indicatore: 'Durata media della degenza',
    durata_media_giorni: 5.9,
    unita_misura: 'giorni'
}
```

I 10 ricoveri durano da **1 a 12 giorni**, per un totale di **59 giorni**: 59 ÷ 10 = **5,9 giorni** di degenza media. Il dettaglio per ricovero è nella [documentazione tecnica](docs/DOCUMENTAZIONE_TECNICA.md).

## Tecniche MongoDB utilizzate

`createCollection` · validazione con **`$jsonSchema`** · **`$expr`** nel validatore · `validationLevel` / `validationAction` · **indice univoco** · `insertMany` · `find` con proiezione · **aggregation pipeline**: `$unwind`, `$project`, `$dateDiff`, `$dateToString`, `$sort`, `$group`, `$sum`, `$avg`, `$round`, `$literal`

## Struttura del repository

```
mongodb-cartelle-cliniche/
├── progetto_cartelle_cliniche.mongodb.js        # script principale (punti 1-5)
├── extra/
│   ├── test_validazione.mongodb.js              # prova che il validatore rifiuta i dati sbagliati
│   └── degenza_media_per_paziente.mongodb.js    # esercizio: degenza media per paziente
├── docs/
│   ├── DOCUMENTAZIONE_TECNICA.md
│   └── GUIDA_CONFIGURAZIONE.md
├── .gitignore
└── README.md
```

## Come usarlo

Serve **MongoDB 5.0 o superiore** (`$dateDiff` è disponibile dalla 5.0) e un modo per eseguire gli script: l'estensione **MongoDB for VS Code** (playground) o la shell di **MongoDB Compass**.

1. Collegati al tuo server MongoDB (ad esempio `mongodb://localhost:27017`).
2. Apri `progetto_cartelle_cliniche.mongodb.js` ed eseguilo: crea il database, la collection, inserisce i dati e calcola le durate.
3. Facoltativo: esegui i file in `extra/`.

Lo script è **rieseguibile da capo**: il `drop()` iniziale elimina la collection se esiste già. Istruzioni complete in [`docs/GUIDA_CONFIGURAZIONE.md`](docs/GUIDA_CONFIGURAZIONE.md).

## Documentazione

- 📄 [`docs/DOCUMENTAZIONE_TECNICA.md`](docs/DOCUMENTAZIONE_TECNICA.md) — modello dei dati, validatore, pipeline, risultati, limiti e sviluppi futuri
- 📄 [`docs/GUIDA_CONFIGURAZIONE.md`](docs/GUIDA_CONFIGURAZIONE.md) — installazione, esecuzione e problemi comuni

## Limiti noti

- **Dati fittizi e dimensioni minime** (5 pazienti, 10 ricoveri): serve a dimostrare la fattibilità, non a trarre conclusioni cliniche.
- **Il validatore impone almeno 2 ricoveri per paziente** (`minItems: 2`): è una scelta del prototipo; in un sistema reale un paziente appena arrivato ha un solo ricovero e andrebbe tolto o abbassato il minimo.
- **Il `drop()` iniziale cancella i dati** della collection: va bene per un prototipo, non per dati reali.
- **Nessuna sicurezza dei dati sanitari**: con dati reali servirebbero controllo degli accessi, cifratura e conformità al GDPR.
- **Nessun campo `reparto`**: la degenza media è calcolata sull'intera collection, non per reparto.
