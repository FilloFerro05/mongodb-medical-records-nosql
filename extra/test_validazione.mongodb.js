// EXTRA - TEST DEL VALIDATORE E DELL'INDICE UNIVOCO
//
// Prova a inserire documenti sbagliati e verifica che MongoDB li rifiuti.
// Va eseguito DOPO progetto_cartelle_cliniche.mongodb.js (la collection deve esistere).
// I documenti di prova non restano nella collection: vengono eliminati alla fine.

use("cartelle_cliniche");


/* Crea un ricovero di prova con i campi obbligatori. data e dimissione
vengono passate dal chiamante: di solito vere BSON Date (create con d()),
ma in un test passiamo di proposito una stringa per provare l'errore.
*/
function ricovero(data, dimissione) {
    return {
        data: data,
        diagnosi: "Diagnosi di prova",
        anamnesi: "Anamnesi di prova",
        prognosi: "Prognosi di prova",
        data_dimissione: dimissione
    };
}

const d = (giorno) => ISODate(giorno + "T00:00:00Z");


/* Tenta l'inserimento di un documento e riporta se e' stato accettato
o rifiutato, con il motivo del rifiuto. */
function prova(descrizione, atteso, documento) {
    let esito;
    let dettaglio = "";
    try {
        db.pazienti.insertOne(documento);
        esito = "ACCETTATO";
    } catch (e) {
        esito = "RIFIUTATO";
        dettaglio = e.message;
    }
    return {
        test: descrizione,
        atteso: atteso,
        esito: esito,
        ok: esito === atteso,
        dettaglio: dettaglio
    };
}


const risultati = [

    prova(
        "Documento valido",
        "ACCETTATO",
        {
            codice_paziente: "PAZ-9001",
            nome: "Paziente Di Prova",
            ricoveri: [
                ricovero(d("2025-01-10"), d("2025-01-12")),
                ricovero(d("2025-02-10"), d("2025-02-10"))   // dimissione lo stesso giorno: consentita
            ]
        }
    ),

    prova(
        "Data di dimissione PRECEDENTE alla data di ricovero",
        "RIFIUTATO",
        {
            codice_paziente: "PAZ-9002",
            nome: "Paziente Di Prova",
            ricoveri: [
                ricovero(d("2025-03-10"), d("2025-03-05")),   // errore
                ricovero(d("2025-04-10"), d("2025-04-12"))
            ]
        }
    ),

    prova(
        "Data di ricovero scritta come stringa invece che come Date",
        "RIFIUTATO",
        {
            codice_paziente: "PAZ-9003",
            nome: "Paziente Di Prova",
            ricoveri: [
                ricovero("2025-05-10", d("2025-05-12")),      // errore: stringa
                ricovero(d("2025-06-10"), d("2025-06-12"))
            ]
        }
    ),

    prova(
        "Un solo ricovero (ne servono almeno 2)",
        "RIFIUTATO",
        {
            codice_paziente: "PAZ-9004",
            nome: "Paziente Di Prova",
            ricoveri: [
                ricovero(d("2025-07-10"), d("2025-07-12"))
            ]
        }
    ),

    prova(
        "Codice paziente in formato non valido",
        "RIFIUTATO",
        {
            codice_paziente: "12345",
            nome: "Paziente Di Prova",
            ricoveri: [
                ricovero(d("2025-08-10"), d("2025-08-12")),
                ricovero(d("2025-09-10"), d("2025-09-12"))
            ]
        }
    ),

    prova(
        "Codice paziente gia' esistente (indice univoco)",
        "RIFIUTATO",
        {
            codice_paziente: "PAZ-0001",                      // gia' presente nei dati di prova
            nome: "Mario Rossi",
            ricoveri: [
                ricovero(d("2025-10-10"), d("2025-10-12")),
                ricovero(d("2025-11-10"), d("2025-11-12"))
            ]
        }
    )
];


// Puliamo: eliminiamo l'eventuale documento di prova che e' stato accettato
db.pazienti.deleteMany({ codice_paziente: /^PAZ-9/ });


/* Risultato: un elemento per ogni prova. Se tutto funziona, "ok" e' true
in ogni riga. */
risultati;
