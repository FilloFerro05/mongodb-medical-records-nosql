// PROGETTO MONGODB PER CARTELLE CLINICHE
//
// Prototipo di database documentale per le cartelle cliniche dei reparti pilota:
// ogni paziente e' un unico documento che contiene i suoi ricoveri.
// Tutti i dati sono FITTIZI.
//
// Requisiti: MongoDB 5.0 o superiore ($dateDiff richiede la 5.0).
// Lo script puo' essere rieseguito da capo tutte le volte che serve
// (vedi il drop() del PUNTO 1).


// - PUNTO 1: CREAZIONE DEL DATABASE E DELLA COLLECTION

/* Selezioniamo il database "cartelle_cliniche" con use().
Se non esiste ancora, MongoDB lo crea davvero solo quando viene creata
la prima collection.
*/

use("cartelle_cliniche");


/* Per poter rieseguire lo script piu' volte, eliminiamo prima la collection
"pazienti" se esiste gia': createCollection() darebbe errore su una collection
gia' presente. Il drop elimina anche i dati e gli indici della collection
(va bene per un prototipo con dati fittizi; con dati reali non si farebbe).
Se la collection non esiste, drop() restituisce semplicemente false.
*/

db.pazienti.drop();


/* Ora creiamo la collection attraverso db.createCollection().
Aggiungiamo anche un validatore, che controlla ogni documento in inserimento
e in modifica. Il validatore combina due controlli con $and:

1) $jsonSchema controlla la STRUTTURA del documento:
   - il paziente ha un codice_paziente (stringa nel formato PAZ-0001), che lo
     identifica in modo univoco anche in caso di omonimi;
   - il nome e' una stringa non vuota;
   - ricoveri e' un array con almeno 2 elementi (minItems: 2);
   - ogni ricovero ha data, diagnosi, anamnesi, prognosi e data_dimissione,
     con le date di tipo BSON Date (cosi' le date non possono essere stringhe)
     e le altre informazioni di tipo stringa non vuota.

2) $expr controlla una REGOLA SUI VALORI che lo schema non puo' esprimere:
   in ogni ricovero la data di dimissione deve essere successiva o uguale
   alla data di ricovero. $map confronta le due date di ciascun ricovero e
   $allElementsTrue richiede che tutti i confronti siano veri.
   Se ricoveri non e' un array (errore gia' segnalato da $jsonSchema),
   $cond fa passare questo controllo per non sovrapporre due errori.
*/

db.createCollection("pazienti", {
    validator: {
        $and: [
            {
                $jsonSchema: {
                    bsonType: "object",
                    title: "Schema del documento paziente",

                    required: ["codice_paziente", "nome", "ricoveri"],

                    properties: {
                        codice_paziente: {
                            bsonType: "string",
                            pattern: "^PAZ-[0-9]{4}$",
                            description:
                                "Codice univoco del paziente, nel formato PAZ-0001"
                        },

                        nome: {
                            bsonType: "string",
                            minLength: 1,
                            description: "Il nome deve essere una stringa non vuota"
                        },

                        ricoveri: {
                            bsonType: "array",

                            /*
                            Ci vogliono almeno 2 ricoveri per paziente,
                            perciò inseriamo il minItems di 2
                            */
                            minItems: 2,

                            /*
                            Items descrive la struttura che deve avere ogni elemento dell'array ricoveri.
                            */
                            items: {
                                bsonType: "object",

                                required: [
                                    "data",
                                    "diagnosi",
                                    "anamnesi",
                                    "prognosi",
                                    "data_dimissione"
                                ],

                                properties: {
                                    data: {
                                        bsonType: "date",
                                        description:
                                            "La data di ricovero deve essere una BSON Date"
                                    },

                                    diagnosi: {
                                        bsonType: "string",
                                        minLength: 1,
                                        description:
                                            "La diagnosi deve essere una stringa"
                                    },

                                    anamnesi: {
                                        bsonType: "string",
                                        minLength: 1,
                                        description:
                                            "L'anamnesi deve essere una stringa"
                                    },

                                    prognosi: {
                                        bsonType: "string",
                                        minLength: 1,
                                        description:
                                            "La prognosi deve essere una stringa"
                                    },

                                    data_dimissione: {
                                        bsonType: "date",
                                        description:
                                            "La data di dimissione deve essere una BSON Date"
                                    }
                                }
                            }
                        }
                    }
                }
            },

            {
                $expr: {
                    $cond: {
                        if: { $isArray: "$ricoveri" },
                        then: {
                            $allElementsTrue: [
                                {
                                    $map: {
                                        input: "$ricoveri",
                                        as: "ricovero",
                                        in: {
                                            $gte: [
                                                "$$ricovero.data_dimissione",
                                                "$$ricovero.data"
                                            ]
                                        }
                                    }
                                }
                            ]
                        },
                        else: true
                    }
                }
            }
        ]
    },

    /*
    Con validationLevel: "strict" tutti gli inserimenti e tutti gli
    aggiornamenti devono rispettare il validatore.
    */
    validationLevel: "strict",

    /*
    Con validationAction: "error" blocca l'operazione se il documento non rispetta
    la struttura definita.
    */
    validationAction: "error"
});


/* Il validatore controlla la forma dei documenti, ma non puo' impedire che
due pazienti abbiano lo stesso codice. Per questo creiamo un indice UNIVOCO
su codice_paziente: MongoDB rifiuta un secondo paziente con lo stesso codice.
Il codice distingue i pazienti anche quando hanno lo stesso nome (omonimi).
In un contesto reale si potrebbe usare anche il codice fiscale; qui, con dati
fittizi, usiamo un codice interno.
*/

db.pazienti.createIndex(
    { codice_paziente: 1 },
    { unique: true }
);



// - PUNTO 2: POPOLAMENTO DELLA COLLECTION

/* Inseriamo 5 pazienti fittizi.
Ogni paziente contiene esattamente 2 ricoveri, quindi il database conterrà 10 ricoveri totali.
Ho differenziato appositamente le durate dei ricoveri (da 1 a 12 giorni),
per rendere il prototipo più realistico.
Usiamo ISODate() per creare vere date MongoDB e non stringhe.
La T divide la data dal suo orario, la Z prende come riferimento l'orario UTC.
*/


db.pazienti.insertMany([
    {
        codice_paziente: "PAZ-0001",
        nome: "Mario Rossi",

        ricoveri: [
            {
                data: ISODate("2025-01-10T00:00:00Z"),

                diagnosi: "Polmonite batterica",

                anamnesi:
                    "Febbre persistente, tosse e difficolta' respiratoria",

                prognosi:
                    "Favorevole dopo terapia antibiotica e monitoraggio",

                data_dimissione: ISODate("2025-01-13T00:00:00Z")
            },
            {
                data: ISODate("2025-09-01T00:00:00Z"),

                diagnosi: "Frattura composta del radio",

                anamnesi:
                    "Trauma accidentale all'arto superiore",

                prognosi:
                    "Recupero previsto con immobilizzazione e fisioterapia",

                data_dimissione: ISODate("2025-09-11T00:00:00Z")
            }
        ]
    },

    {
        codice_paziente: "PAZ-0002",
        nome: "Laura Bianchi",

        ricoveri: [
            {
                data: ISODate("2025-02-05T00:00:00Z"),

                diagnosi: "Gastroenterite acuta",

                anamnesi:
                    "Nausea, disidratazione e dolore addominale",

                prognosi:
                    "Rapida ripresa dopo reidratazione e osservazione",

                data_dimissione: ISODate("2025-02-07T00:00:00Z")
            },
            {
                data: ISODate("2025-07-15T00:00:00Z"),

                diagnosi: "Colecistite",

                anamnesi:
                    "Dolore addominale ricorrente e nausea",

                prognosi:
                    "Decorso regolare dopo trattamento chirurgico",

                data_dimissione: ISODate("2025-07-20T00:00:00Z")
            }
        ]
    },

    {
        codice_paziente: "PAZ-0003",
        nome: "Giuseppe Verdi",

        ricoveri: [
            {
                data: ISODate("2025-03-01T00:00:00Z"),

                diagnosi: "Bronchite acuta",

                anamnesi:
                    "Tosse intensa e affaticamento respiratorio",

                prognosi:
                    "Miglioramento progressivo con terapia farmacologica",

                data_dimissione: ISODate("2025-03-08T00:00:00Z")
            },
            {
                data: ISODate("2025-11-10T00:00:00Z"),

                diagnosi: "Scompenso cardiaco lieve",

                anamnesi:
                    "Dispnea da sforzo e gonfiore agli arti inferiori",

                prognosi:
                    "Stabilizzazione clinica con terapia e controlli",

                data_dimissione: ISODate("2025-11-22T00:00:00Z")
            }
        ]
    },

    {
        codice_paziente: "PAZ-0004",
        nome: "Elena Romano",

        ricoveri: [
            {
                data: ISODate("2025-04-12T00:00:00Z"),

                diagnosi: "Emicrania acuta",

                anamnesi:
                    "Cefalea intensa con nausea e fotofobia",

                prognosi:
                    "Dimissione dopo regressione della sintomatologia",

                data_dimissione: ISODate("2025-04-13T00:00:00Z")
            },
            {
                data: ISODate("2025-08-03T00:00:00Z"),

                diagnosi: "Infezione delle vie urinarie",

                anamnesi:
                    "Febbre, dolore lombare e disturbi urinari",

                prognosi:
                    "Favorevole dopo terapia antibiotica mirata",

                data_dimissione: ISODate("2025-08-09T00:00:00Z")
            }
        ]
    },

    {
        codice_paziente: "PAZ-0005",
        nome: "Paolo Conti",

        ricoveri: [
            {
                data: ISODate("2025-05-20T00:00:00Z"),

                diagnosi: "Appendicite acuta",

                anamnesi:
                    "Dolore addominale localizzato e febbre",

                prognosi:
                    "Decorso post-operatorio senza complicazioni",

                data_dimissione: ISODate("2025-05-24T00:00:00Z")
            },
            {
                data: ISODate("2025-12-01T00:00:00Z"),

                diagnosi: "Riabilitazione post-traumatica",

                anamnesi:
                    "Riduzione della mobilita' dopo trauma alla gamba",

                prognosi:
                    "Recupero graduale della funzionalita' motoria",

                data_dimissione: ISODate("2025-12-10T00:00:00Z")
            }
        ]
    }
]);


/* I pazienti sono stati creati nella collection, perciò ora controlliamo che sia tutto ok.
La query mostra tutti i pazienti e i relativi ricoveri (escludiamo l'id interno di MongoDB
per rendere il documento più leggibile)
*/


db.pazienti.find(
    {},
    {
        _id: 0,
        codice_paziente: 1,
        nome: 1,
        ricoveri: 1
    }
);



// - PUNTO 3: CALCOLO DELLA DURATA DI OGNI SINGOLO RICOVERO

/* Ora calcoliamo la durata in giorni di ciascun ricovero.
Ogni paziente contiene un array di ricoveri, perciò utilizzeremo
$unwind che separa temporaneamente gli elementi dell'array, creando un elemento
della pipeline per ogni ricovero.

Utilizziamo $project che seleziona i campi che devono essere visualizzati.

Successivamente usiamo $dateDiff che calcola la differenza tra:
- startDate: data del ricovero;
- endDate: data della dimissione.
Il risultato viene restituito in giorni.

Usiamo $dateToString soltanto per mostrare le date nel formato giorno/mese/anno.
Le date salvate nella collection restano comunque valori BSON Date.

Infine con $sort ordiniamo il risultato prima per nome del paziente e poi per data di ricovero.
*/


db.pazienti.aggregate([
    {
        $unwind: "$ricoveri"
    },

    {
        $project: {
            _id: 0,

            paziente: "$nome",

            diagnosi: "$ricoveri.diagnosi",

            data_ricovero_originale: "$ricoveri.data",

            data_dimissione_originale: "$ricoveri.data_dimissione",

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
        $sort: {
            paziente: 1,
            data_ricovero_originale: 1
        }
    },

    {
        $project: {
            paziente: 1,

            diagnosi: 1,

            data_ricovero: {
                $dateToString: {
                    format: "%d/%m/%Y",
                    date: "$data_ricovero_originale"
                }
            },

            data_dimissione: {
                $dateToString: {
                    format: "%d/%m/%Y",
                    date: "$data_dimissione_originale"
                }
            },

            giorni_degenza: 1
        }
    }
]);



// - PUNTO 4: CALCOLO DEL TEMPO MEDIO DI DEGENZA

/* Calcoliamo la durata media, espressa in giorni, di tutti i ricoveri presenti
nella collection.

Usiamo $unwind come prima per dividere i ricoveri nell'array.
Stessa cosa per $project e $dateDiff.
Il risultato verrà memorizzato nel campo temporaneo giorni_degenza.

Successivamente utilizziamo la $group per raggruppare tutti i ricoveri in un unico gruppo (_id: null),
dove all'interno calcoliamo il numero totale dei ricoveri tramite $sum e la durata media tramite $avg;

Infine riutilizziamo la $project per eliminare il campo _id, arrotondare la media a 2 cifre decimali,
e specificare che l'unità di misura è espressa in giorni.
*/


db.pazienti.aggregate([
    {
        $unwind: "$ricoveri"
    },

    {
        $project: {
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
            _id: null,

            ricoveri_analizzati: {
                $sum: 1
            },

            durata_media_giorni: {
                $avg: "$giorni_degenza"
            }
        }
    },

    {
        $project: {
            _id: 0,

            indicatore: {
                $literal: "Durata media della degenza"
            },

            ricoveri_analizzati: 1,

            durata_media_giorni: {
                $round: [
                    "$durata_media_giorni",
                    2
                ]
            },
            unita_misura: {
                $literal: "giorni"
            }
        }
    }
]);


/* Questo è l'output del risultato:

{
    ricoveri_analizzati: 10,
    indicatore: 'Durata media della degenza',
    durata_media_giorni: 5.9,
    unita_misura: 'giorni'
}
*/



// - PUNTO 5: NOTA FINALE

/* Il documento, nella struttura iniziale, incorpora l'array "ricoveri" nel documento del paziente,
poiché i ricoveri appartengono alla stessa cartella clinica e vengono analizzati insieme.
Le date non vengono valorizzate come stringhe ma come ISODate, per rendere più facili
i calcoli sulle differenze temporali.

Rispetto alla traccia (nome e ricoveri) ho aggiunto un campo codice_paziente, con indice
univoco, perché il solo nome non basta a distinguere due pazienti omonimi.
Il validatore, oltre ai tipi dei campi e al minimo di 2 ricoveri, controlla anche che la
data di dimissione non preceda la data di ricovero (con $expr).

Nel codice ho utilizzato:
$unwind, molto utile per ottenere un elemento per ogni ricovero;
$dateDiff per calcolare la durata dei ricoveri in giorni;
$group con $avg per ricavare la degenza media complessiva.

L'analisi di 10 ricoveri restituisce una durata media di 5,9 giorni, data dai
59 giorni totali di degenza di tutti i ricoveri, divisi per i 10 ricoveri.
Ho utilizzato $project per rendere l'output più chiaro e leggibile.

Il progetto restituisce l'output richiesto ed è rieseguibile da capo grazie al
db.pazienti.drop() iniziale, che elimina la collection se esiste già.
*/
