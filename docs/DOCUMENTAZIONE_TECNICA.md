# Documentazione tecnica — MongoDB per cartelle cliniche

## 1. Obiettivo

La Direzione Sistemi Informativi di un ospedale sta valutando come rappresentare le cartelle cliniche in un **database documentale**. Oggi i dati di ricovero vivono in tabelle rigide, che obbligano a creare schemi separati ogni volta che un reparto aggiunge un campo. Un paziente può avere più ricoveri, ciascuno con diagnosi, anamnesi, prognosi e date, e si vuole tenere tutto insieme in un unico documento.

La consegna chiede un **prototipo** che dimostri la fattibilità, con codice commentato e rieseguibile da chi verrà dopo:

1. **Creazione della struttura**: database `cartelle_cliniche`, collection `pazienti`; ogni documento ha un `nome` (stringa) e un array `ricoveri`, con ogni elemento composto da `data` (ISODate), `diagnosi`, `anamnesi`, `prognosi` (stringhe) e `data_dimissione` (ISODate);
2. **Dati di prova**: almeno 5 pazienti, ciascuno con almeno 2 ricoveri, con casistiche verosimili (durate diverse, ricoveri brevi e lunghi), tutti fittizi;
3. **Analisi delle degenze**: uno script che calcoli il tempo medio, in giorni, tra data di ricovero e data di dimissione, presentando il risultato in modo leggibile. La durata media di degenza è l'indicatore che la Direzione Sanitaria guarda per primo ragionando su posti letto e turnover.

## 2. Il modello dei dati

### Perché un documento per paziente con i ricoveri incorporati

I ricoveri vengono **incorporati** (embedded) nell'array `ricoveri` del documento del paziente, invece di stare in una collection separata collegata per riferimento:

| Motivo | Spiegazione |
|--------|-------------|
| **Appartengono alla stessa cartella clinica** | un ricovero non ha senso senza il paziente a cui appartiene |
| **Vengono letti insieme** | aprire la cartella di un paziente richiede una sola lettura, senza `JOIN` |
| **Cardinalità contenuta** | un paziente ha un numero limitato di ricoveri, quindi il documento non cresce senza controllo |
| **Flessibilità** | un reparto può aggiungere un campo a un ricovero senza rifare lo schema (vedi sotto) |

### Flessibilità e schema validato

Il validatore definisce i campi **obbligatori** e i loro tipi, ma non vieta campi aggiuntivi (non è impostato `additionalProperties: false`). Così il prototipo tiene insieme due esigenze: **garanzia di qualità** sui dati fondamentali e **libertà** per i reparti di aggiungere campi propri senza dover ridisegnare la modellazione.

### Date come `ISODate`

Le date sono salvate come **BSON Date** (`ISODate("2025-01-10T00:00:00Z")`) e non come stringhe. Il motivo è pratico: i calcoli sulle differenze temporali (`$dateDiff`) funzionano solo su date vere, e il validatore impedisce di salvarle per errore come testo. Nel formato `ISODate`, la `T` separa la data dall'orario e la `Z` indica il riferimento UTC.

### Il campo `codice_paziente`

Rispetto alla traccia (`nome` e `ricoveri`) è stato aggiunto un **codice paziente** (formato `PAZ-0001`), perché il solo nome **non identifica** una persona: due pazienti omonimi sarebbero indistinguibili, e una cartella clinica attribuita alla persona sbagliata è un problema serio. Il codice è garantito **univoco da un indice** e viene usato per raggruppare i dati (vedi l'esercizio extra). In un contesto reale si potrebbe usare anche il codice fiscale; qui, con dati fittizi, si usa un codice interno.

## 3. Creazione della collection e validatore

`db.createCollection("pazienti", { validator, validationLevel, validationAction })`.

Il validatore combina due controlli con `$and`:

### 3.1 `$jsonSchema` — la struttura

| Campo | Regola |
|-------|--------|
| `codice_paziente` | obbligatorio, stringa, formato `^PAZ-[0-9]{4}$` |
| `nome` | obbligatorio, stringa non vuota |
| `ricoveri` | obbligatorio, **array con almeno 2 elementi** (`minItems: 2`) |
| `ricoveri[].data` | obbligatorio, **BSON Date** |
| `ricoveri[].diagnosi`, `anamnesi`, `prognosi` | obbligatorie, stringhe non vuote |
| `ricoveri[].data_dimissione` | obbligatoria, **BSON Date** |

L'opzione `items` descrive la struttura che deve avere **ogni** elemento dell'array.

### 3.2 `$expr` — la regola sui valori

Lo schema controlla i **tipi**, ma non può confrontare due campi tra loro. Per verificare che **la data di dimissione sia successiva o uguale alla data di ricovero** serve `$expr`, che permette di usare le espressioni dell'aggregation framework dentro il validatore:

```js
{
    $expr: {
        $cond: {
            if: { $isArray: "$ricoveri" },
            then: {
                $allElementsTrue: [
                    { $map: {
                        input: "$ricoveri",
                        as: "ricovero",
                        in: { $gte: ["$$ricovero.data_dimissione", "$$ricovero.data"] }
                    } }
                ]
            },
            else: true
        }
    }
}
```

- `$map` confronta le due date di **ciascun** ricovero e produce un array di `true`/`false`;
- `$allElementsTrue` richiede che **tutti** i confronti siano veri;
- `$cond` con `$isArray` evita un doppio errore se `ricoveri` non è nemmeno un array (caso già segnalato da `$jsonSchema`);
- il confronto è `>=`: una **dimissione lo stesso giorno** del ricovero è ammessa (degenza di 0 giorni).

### 3.3 Livello e azione

| Opzione | Valore | Effetto |
|---------|--------|---------|
| `validationLevel` | `"strict"` | tutti gli inserimenti **e** gli aggiornamenti devono rispettare il validatore |
| `validationAction` | `"error"` | l'operazione viene **bloccata** se il documento non è valido |

### 3.4 Indice univoco

```js
db.pazienti.createIndex({ codice_paziente: 1 }, { unique: true });
```

Il validatore controlla la forma del singolo documento, ma non può sapere se un valore compare già in un altro documento. Un secondo paziente con lo stesso `codice_paziente` viene quindi rifiutato dall'indice.

### 3.5 Rieseguibilità

Lo script inizia con `db.pazienti.drop()`: `createCollection` darebbe errore se la collection esistesse già, quindi eliminandola prima lo script si può rieseguire da capo quante volte si vuole. Se la collection non esiste, `drop()` restituisce semplicemente `false`. Il `drop` elimina anche dati e indici: è corretto per un prototipo con dati fittizi, **non** per dati reali.

## 4. I dati di prova

5 pazienti, ciascuno con **esattamente 2 ricoveri**, per **10 ricoveri** in totale. Le durate sono state differenziate (da 1 a 12 giorni) per rendere il prototipo più realistico: ricoveri brevi (emicrania, gastroenterite) e lunghi (scompenso cardiaco).

| Codice | Paziente | Ricovero 1 | Ricovero 2 |
|--------|----------|------------|------------|
| PAZ-0001 | Mario Rossi | Polmonite batterica | Frattura composta del radio |
| PAZ-0002 | Laura Bianchi | Gastroenterite acuta | Colecistite |
| PAZ-0003 | Giuseppe Verdi | Bronchite acuta | Scompenso cardiaco lieve |
| PAZ-0004 | Elena Romano | Emicrania acuta | Infezione delle vie urinarie |
| PAZ-0005 | Paolo Conti | Appendicite acuta | Riabilitazione post-traumatica |

Le date sono create con `ISODate()` e non come stringhe. Una `find()` con proiezione (`_id: 0`) mostra tutti i pazienti con i relativi ricoveri in modo leggibile.

## 5. Punto 3 — Durata di ogni ricovero

Pipeline di aggregazione in quattro stadi:

| Stadio | Cosa fa |
|--------|---------|
| `$unwind: "$ricoveri"` | separa gli elementi dell'array: da un documento per paziente a **un documento per ricovero** |
| `$project` | seleziona i campi da mostrare e calcola `giorni_degenza` con `$dateDiff` (`startDate` = ricovero, `endDate` = dimissione, `unit: "day"`) |
| `$sort` | ordina per nome del paziente e poi per data di ricovero |
| `$project` (seconda) | formatta le date come giorno/mese/anno con `$dateToString`, **solo per la visualizzazione**: i dati salvati restano BSON Date |

La seconda `$project` rende l'output leggibile senza alterare i dati salvati: il formato testuale esiste soltanto nel risultato dell'aggregazione.

Risultato (ordinato per paziente e data):

| Paziente | Diagnosi | Ricovero | Dimissione | Giorni |
|----------|----------|----------|------------|--------|
| Elena Romano | Emicrania acuta | 12/04/2025 | 13/04/2025 | 1 |
| Elena Romano | Infezione delle vie urinarie | 03/08/2025 | 09/08/2025 | 6 |
| Giuseppe Verdi | Bronchite acuta | 01/03/2025 | 08/03/2025 | 7 |
| Giuseppe Verdi | Scompenso cardiaco lieve | 10/11/2025 | 22/11/2025 | 12 |
| Laura Bianchi | Gastroenterite acuta | 05/02/2025 | 07/02/2025 | 2 |
| Laura Bianchi | Colecistite | 15/07/2025 | 20/07/2025 | 5 |
| Mario Rossi | Polmonite batterica | 10/01/2025 | 13/01/2025 | 3 |
| Mario Rossi | Frattura composta del radio | 01/09/2025 | 11/09/2025 | 10 |
| Paolo Conti | Appendicite acuta | 20/05/2025 | 24/05/2025 | 4 |
| Paolo Conti | Riabilitazione post-traumatica | 01/12/2025 | 10/12/2025 | 9 |

## 6. Punto 4 — Durata media di degenza

| Stadio | Cosa fa |
|--------|---------|
| `$unwind` | un documento per ricovero |
| `$project` | calcola `giorni_degenza` con `$dateDiff` |
| `$group` con `_id: null` | raggruppa **tutti** i ricoveri in un solo gruppo: `$sum: 1` conta i ricoveri, `$avg` calcola la durata media |
| `$project` | toglie `_id`, **arrotonda a 2 decimali** con `$round`, aggiunge con `$literal` l'indicatore e l'unità di misura |

Risultato:

```js
{
    ricoveri_analizzati: 10,
    indicatore: 'Durata media della degenza',
    durata_media_giorni: 5.9,
    unita_misura: 'giorni'
}
```

Controllo a mano: 3 + 10 + 2 + 5 + 7 + 12 + 1 + 6 + 4 + 9 = **59 giorni** su **10 ricoveri** → 59 ÷ 10 = **5,9 giorni**.

## 7. Extra

### 7.1 `extra/test_validazione.mongodb.js`

Prova che il validatore e l'indice funzionino davvero, tentando di inserire documenti sbagliati. Restituisce un elemento per prova, con l'esito (`ACCETTATO`/`RIFIUTATO`) e se coincide con quello atteso:

| Prova | Esito atteso |
|-------|--------------|
| Documento valido (con una dimissione lo stesso giorno del ricovero) | accettato |
| Data di dimissione **precedente** al ricovero | rifiutato |
| Data scritta come **stringa** | rifiutato |
| **Un solo** ricovero | rifiutato |
| Codice paziente in **formato non valido** | rifiutato |
| Codice paziente **già esistente** | rifiutato (indice univoco) |

I documenti di prova non restano nella collection.

### 7.2 `extra/degenza_media_per_paziente.mongodb.js`

Esercizio di approfondimento: invece della media complessiva, calcola la degenza media **per paziente** raggruppando con `$group` per `codice_paziente`.

| Paziente | Ricoveri | Degenza media |
|----------|----------|---------------|
| Giuseppe Verdi | 2 | 9,5 giorni |
| Mario Rossi | 2 | 6,5 giorni |
| Paolo Conti | 2 | 6,5 giorni |
| Elena Romano | 2 | 3,5 giorni |
| Laura Bianchi | 2 | 3,5 giorni |

Raggruppare per **diagnosi** darebbe poco con questi dati: ogni diagnosi compare in un solo ricovero, quindi la media coinciderebbe con la durata del singolo ricovero.

## 8. Tecniche utilizzate

| Tecnica | Dove |
|---------|------|
| `createCollection` con validatore `$jsonSchema` | punto 1 |
| `$expr` nel validatore (`$map`, `$allElementsTrue`, `$cond`, `$isArray`) | punto 1 |
| `validationLevel: "strict"`, `validationAction: "error"` | punto 1 |
| Indice univoco | punto 1 |
| `insertMany`, `ISODate` | punto 2 |
| `find` con proiezione | punto 2 |
| Aggregation pipeline: `$unwind`, `$project`, `$sort` | punti 3-4 |
| `$dateDiff`, `$dateToString` | punti 3-4 |
| `$group` con `$sum`, `$avg` | punto 4 |
| `$round`, `$literal` | punto 4 |

## 9. Limiti noti

- **Dati fittizi e molto pochi** (5 pazienti, 10 ricoveri): dimostrano la fattibilità, ma la media di 5,9 giorni non ha alcun valore clinico.
- **`minItems: 2` è una scelta del prototipo.** Impone almeno 2 ricoveri per paziente, ma in un sistema reale un paziente al primo ricovero ne avrebbe uno solo e verrebbe rifiutato. Andrebbe rimosso o abbassato.
- **`$dateDiff` conta i giorni di calendario in UTC.** Con date a mezzanotte UTC, come nei dati di prova, il risultato coincide con i giorni di degenza; con orari diversi la differenza conta i cambi di giorno attraversati (un ricovero dalle 23:00 alle 01:00 del giorno dopo darebbe 1). Una dimissione lo stesso giorno dà 0.
- **Nessun controllo di sovrapposizione.** Il validatore non verifica che i ricoveri dello stesso paziente non si sovrappongano nel tempo, né che siano in ordine cronologico.
- **Documenti che crescono.** Con i ricoveri incorporati, il documento di un paziente cresce a ogni ricovero. Per un numero limitato di ricoveri va benissimo; con un numero molto elevato (e il limite di 16 MB per documento) sarebbe preferibile una collection separata.
- **`drop()` iniziale.** Cancella i dati: va bene per un prototipo, non per dati reali.
- **Sicurezza e privacy.** Con dati sanitari reali servirebbero controllo degli accessi, cifratura e conformità al GDPR; il prototipo non li affronta.
- **Nessun campo `reparto`.** Non si può calcolare la degenza media per reparto, che sarebbe l'informazione più utile per la gestione dei posti letto.

## 10. Sviluppi futuri

- Aggiungere il campo **`reparto`** a ogni ricovero, per calcolare la degenza media **per reparto**, **per diagnosi** o per periodo (mese, trimestre), con `$group`.
- **Altri indicatori** per la Direzione Sanitaria: mediana e massimo della degenza, tasso di riammissione (secondo ricovero entro N giorni), turnover dei posti letto.
- **Validazione più ricca**: controllo di sovrapposizione dei ricoveri, elenco chiuso di valori per alcuni campi, stati del ricovero.
- **Indici** sui campi più interrogati (ad esempio `ricoveri.data`) quando i dati crescono.
- **Salvare i risultati** delle aggregazioni in una collection con `$merge`, per alimentare una dashboard.
- **Sicurezza**: ruoli e permessi, cifratura dei campi sensibili, registro degli accessi.
- Valutare di **separare i ricoveri** in una collection a parte se il numero per paziente diventasse molto alto.
