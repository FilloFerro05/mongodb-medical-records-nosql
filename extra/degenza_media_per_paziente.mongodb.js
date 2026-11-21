// EXTRA - DEGENZA MEDIA PER PAZIENTE
//
// Esercizio di approfondimento: invece della media complessiva (PUNTO 4),
// calcola la durata media dei ricoveri di ciascun paziente.
// Va eseguito DOPO progetto_cartelle_cliniche.mongodb.js.

use("cartelle_cliniche");


/* Come nel PUNTO 4 usiamo $unwind e $dateDiff per ottenere i giorni di
ogni ricovero. La differenza e' nel $group: invece di un unico gruppo
(_id: null) raggruppiamo per codice_paziente, cosi' otteniamo una riga per
paziente. Raggruppiamo per codice e non per nome, perche' il codice e'
univoco anche in caso di omonimi.

- $first prende il nome del paziente (e' uguale in tutti i suoi ricoveri);
- $sum: 1 conta i ricoveri del paziente;
- $avg calcola la durata media.

Infine $project rinomina e arrotonda i campi, e $sort ordina dal paziente
con la degenza media piu' lunga (a parita', in ordine alfabetico).
*/

db.pazienti.aggregate([
    {
        $unwind: "$ricoveri"
    },

    {
        $project: {
            codice_paziente: 1,
            nome: 1,
            giorni_degenza: {
                $dateDiff: {
                    startDate: "$ricoveri.data",
                    endDate: "$ricoveri.data_dimissione",
                    unit: "day"
                }
            }
        }
    },

    {
        $group: {
            _id: "$codice_paziente",

            paziente: {
                $first: "$nome"
            },

            numero_ricoveri: {
                $sum: 1
            },

            degenza_media_giorni: {
                $avg: "$giorni_degenza"
            }
        }
    },

    {
        $project: {
            _id: 0,
            codice_paziente: "$_id",
            paziente: 1,
            numero_ricoveri: 1,
            degenza_media_giorni: {
                $round: [
                    "$degenza_media_giorni",
                    2
                ]
            }
        }
    },

    {
        $sort: {
            degenza_media_giorni: -1,
            paziente: 1
        }
    }
]);


/* Output atteso con i dati di prova:

{ codice_paziente: 'PAZ-0003', paziente: 'Giuseppe Verdi', numero_ricoveri: 2, degenza_media_giorni: 9.5 }
{ codice_paziente: 'PAZ-0001', paziente: 'Mario Rossi',    numero_ricoveri: 2, degenza_media_giorni: 6.5 }
{ codice_paziente: 'PAZ-0005', paziente: 'Paolo Conti',    numero_ricoveri: 2, degenza_media_giorni: 6.5 }
{ codice_paziente: 'PAZ-0004', paziente: 'Elena Romano',   numero_ricoveri: 2, degenza_media_giorni: 3.5 }
{ codice_paziente: 'PAZ-0002', paziente: 'Laura Bianchi',  numero_ricoveri: 2, degenza_media_giorni: 3.5 }

(Raggruppare per diagnosi darebbe poca informazione con questi dati: ogni
diagnosi compare in un solo ricovero, quindi la media coinciderebbe con la
durata del singolo ricovero.)
*/
