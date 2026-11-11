/* Original world, task definitions and cosmetic catalogue. Shared by client and server. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.StarshipData=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){return {
  "map": {
    "w": 82,
    "h": 66,
    "rooms": [
      {
        "id": "cargo_n",
        "name": "CARGA NORTE",
        "kind": "storage",
        "x": 7,
        "y": 9,
        "w": 15,
        "h": 10,
        "color": "#8a704c",
        "poly": [
          [
            0,
            0
          ],
          [
            1,
            0
          ],
          [
            1,
            1
          ],
          [
            0,
            1
          ]
        ],
        "doors": [
          {
            "side": "bottom",
            "offset": 0.5,
            "width": 2.35
          }
        ]
      },
      {
        "id": "comms_n",
        "name": "COMUNICACIONES",
        "kind": "comms",
        "x": 27,
        "y": 9,
        "w": 15,
        "h": 10,
        "color": "#765d9b",
        "poly": [
          [
            0,
            0
          ],
          [
            1,
            0
          ],
          [
            1,
            1
          ],
          [
            0,
            1
          ]
        ],
        "doors": [
          {
            "side": "bottom",
            "offset": 0.5,
            "width": 2.35
          }
        ]
      },
      {
        "id": "admin",
        "name": "ADMINISTRACIÓN",
        "kind": "admin",
        "x": 7,
        "y": 23,
        "w": 15,
        "h": 10,
        "color": "#438d70",
        "poly": [
          [
            0,
            0
          ],
          [
            1,
            0
          ],
          [
            1,
            1
          ],
          [
            0,
            1
          ]
        ],
        "doors": [
          {
            "side": "top",
            "offset": 0.5,
            "width": 2.35
          },
          {
            "side": "bottom",
            "offset": 0.5,
            "width": 2.35
          }
        ]
      },
      {
        "id": "electrical",
        "name": "ELECTRICIDAD",
        "kind": "electrical",
        "x": 27,
        "y": 23,
        "w": 12,
        "h": 10,
        "color": "#a77a3f",
        "poly": [
          [
            0,
            0
          ],
          [
            1,
            0
          ],
          [
            1,
            1
          ],
          [
            0,
            1
          ]
        ],
        "doors": [
          {
            "side": "top",
            "offset": 0.5,
            "width": 2.35
          },
          {
            "side": "bottom",
            "offset": 0.5,
            "width": 2.35
          }
        ]
      },
      {
        "id": "cafeteria",
        "name": "CAFETERÍA",
        "kind": "cafe",
        "x": 45,
        "y": 22.5,
        "w": 32,
        "h": 25,
        "color": "#497f91",
        "poly": [
          [
            0,
            0
          ],
          [
            1,
            0
          ],
          [
            1,
            1
          ],
          [
            0,
            1
          ]
        ],
        "doors": [
          {
            "side": "top",
            "offset": 0.5,
            "width": 2.35
          },
          {
            "side": "left",
            "offset": 0.5,
            "width": 2.35
          },
          {
            "side": "bottom",
            "offset": 0.5,
            "width": 2.35
          }
        ]
      },
      {
        "id": "reactor",
        "name": "REACTOR",
        "kind": "reactor",
        "x": 7,
        "y": 37,
        "w": 15,
        "h": 10,
        "color": "#76539a",
        "poly": [
          [
            0,
            0
          ],
          [
            1,
            0
          ],
          [
            1,
            1
          ],
          [
            0,
            1
          ]
        ],
        "doors": [
          {
            "side": "top",
            "offset": 0.5,
            "width": 2.35
          },
          {
            "side": "bottom",
            "offset": 0.5,
            "width": 2.35
          }
        ]
      },
      {
        "id": "medbay",
        "name": "ENFERMERÍA",
        "kind": "medbay",
        "x": 27,
        "y": 37,
        "w": 12,
        "h": 10,
        "color": "#398b86",
        "poly": [
          [
            0,
            0
          ],
          [
            1,
            0
          ],
          [
            1,
            1
          ],
          [
            0,
            1
          ]
        ],
        "doors": [
          {
            "side": "top",
            "offset": 0.5,
            "width": 2.35
          },
          {
            "side": "bottom",
            "offset": 0.5,
            "width": 2.35
          }
        ]
      },
      {
        "id": "oxygen",
        "name": "OXÍGENO",
        "kind": "o2",
        "x": 45,
        "y": 9,
        "w": 14,
        "h": 10,
        "color": "#31947d",
        "poly": [
          [
            0,
            0
          ],
          [
            1,
            0
          ],
          [
            1,
            1
          ],
          [
            0,
            1
          ]
        ],
        "doors": [
          {
            "side": "bottom",
            "offset": 0.5,
            "width": 2.35
          },
          {
            "side": "right",
            "offset": 0.5,
            "width": 2.35
          }
        ]
      },
      {
        "id": "security",
        "name": "SEGURIDAD",
        "kind": "security",
        "x": 63,
        "y": 9,
        "w": 14,
        "h": 10,
        "color": "#347e88",
        "poly": [
          [
            0,
            0
          ],
          [
            1,
            0
          ],
          [
            1,
            1
          ],
          [
            0,
            1
          ]
        ],
        "doors": [
          {
            "side": "bottom",
            "offset": 0.5,
            "width": 2.35
          }
        ]
      },
      {
        "id": "navigation",
        "name": "NAVEGACIÓN",
        "kind": "nav",
        "x": 7,
        "y": 52,
        "w": 15,
        "h": 10,
        "color": "#346891",
        "poly": [
          [
            0,
            0
          ],
          [
            1,
            0
          ],
          [
            1,
            1
          ],
          [
            0,
            1
          ]
        ],
        "doors": [
          {
            "side": "top",
            "offset": 0.5,
            "width": 2.35
          }
        ]
      },
      {
        "id": "shields",
        "name": "ESCUDOS",
        "kind": "shields",
        "x": 27,
        "y": 52,
        "w": 12,
        "h": 10,
        "color": "#397e8a",
        "poly": [
          [
            0,
            0
          ],
          [
            1,
            0
          ],
          [
            1,
            1
          ],
          [
            0,
            1
          ]
        ],
        "doors": [
          {
            "side": "top",
            "offset": 0.5,
            "width": 2.35
          }
        ]
      },
      {
        "id": "laboratory",
        "name": "LABORATORIO",
        "kind": "medbay",
        "x": 45,
        "y": 52,
        "w": 14,
        "h": 10,
        "color": "#3d8a76",
        "poly": [
          [
            0,
            0
          ],
          [
            1,
            0
          ],
          [
            1,
            1
          ],
          [
            0,
            1
          ]
        ],
        "doors": [
          {
            "side": "top",
            "offset": 0.5,
            "width": 2.35
          }
        ]
      },
      {
        "id": "engine_s",
        "name": "PROPULSIÓN",
        "kind": "engine",
        "x": 63,
        "y": 52,
        "w": 14,
        "h": 10,
        "color": "#925435",
        "poly": [
          [
            0,
            0
          ],
          [
            1,
            0
          ],
          [
            1,
            1
          ],
          [
            0,
            1
          ]
        ],
        "doors": [
          {
            "side": "top",
            "offset": 0.5,
            "width": 2.35
          }
        ]
      }
    ],
    "corridors": [
      {
        "id": "upper_link",
        "main": true,
        "width": 4.8,
        "points": [
          [
            7,
            21
          ],
          [
            70,
            21
          ]
        ]
      },
      {
        "id": "middle_link",
        "main": true,
        "width": 4.8,
        "points": [
          [
            7,
            35
          ],
          [
            45,
            35
          ]
        ]
      },
      {
        "id": "lower_link",
        "main": true,
        "width": 5,
        "points": [
          [
            14.5,
            49.5
          ],
          [
            70,
            49.5
          ]
        ]
      }
    ],
    "obstacles": [
      {
        "id": "cargo_n_fixture_0",
        "room": "cargo_n",
        "kind": "rect",
        "x": 8.05,
        "y": 10,
        "w": 1.35,
        "h": 1.55
      },
      {
        "id": "cargo_n_fixture_1",
        "room": "cargo_n",
        "kind": "rect",
        "x": 8.05,
        "y": 12.25,
        "w": 1.35,
        "h": 1.55
      },
      {
        "id": "cargo_n_fixture_2",
        "room": "cargo_n",
        "kind": "rect",
        "x": 8.05,
        "y": 14.5,
        "w": 1.35,
        "h": 1.55
      },
      {
        "id": "cargo_n_fixture_3",
        "room": "cargo_n",
        "kind": "rect",
        "x": 20.75,
        "y": 12.3,
        "w": 0.65,
        "h": 3.4
      },
      {
        "id": "comms_n_fixture_4",
        "room": "comms_n",
        "kind": "rect",
        "x": 28.05,
        "y": 10,
        "w": 1.15,
        "h": 8
      },
      {
        "id": "admin_fixture_5",
        "room": "admin",
        "kind": "rect",
        "x": 8.05,
        "y": 24,
        "w": 0.85,
        "h": 1.5
      },
      {
        "id": "admin_fixture_6",
        "room": "admin",
        "kind": "rect",
        "x": 8.05,
        "y": 26.25,
        "w": 0.85,
        "h": 1.5
      },
      {
        "id": "admin_fixture_7",
        "room": "admin",
        "kind": "rect",
        "x": 8.05,
        "y": 28.5,
        "w": 0.85,
        "h": 1.5
      },
      {
        "id": "admin_fixture_8",
        "room": "admin",
        "kind": "rect",
        "x": 20.9,
        "y": 26.4,
        "w": 0.55,
        "h": 2.2
      },
      {
        "id": "electrical_fixture_9",
        "room": "electrical",
        "kind": "rect",
        "x": 28.05,
        "y": 24,
        "w": 1.05,
        "h": 1.35
      },
      {
        "id": "electrical_fixture_10",
        "room": "electrical",
        "kind": "rect",
        "x": 28.05,
        "y": 26.15,
        "w": 1.05,
        "h": 1.35
      },
      {
        "id": "electrical_fixture_11",
        "room": "electrical",
        "kind": "rect",
        "x": 28.05,
        "y": 28.3,
        "w": 1.05,
        "h": 1.35
      },
      {
        "id": "electrical_fixture_12",
        "room": "electrical",
        "kind": "rect",
        "x": 37.9,
        "y": 26.4,
        "w": 0.55,
        "h": 3.2
      },
      {
        "id": "medbay_fixture_13",
        "room": "medbay",
        "kind": "rect",
        "x": 27.85,
        "y": 38.25,
        "w": 1.15,
        "h": 3.1
      },
      {
        "id": "medbay_fixture_14",
        "room": "medbay",
        "kind": "rect",
        "x": 37,
        "y": 38.25,
        "w": 1.15,
        "h": 3.1
      },
      {
        "id": "security_fixture_15",
        "room": "security",
        "kind": "rect",
        "x": 64,
        "y": 11,
        "w": 1.65,
        "h": 1.05
      },
      {
        "id": "security_fixture_16",
        "room": "security",
        "kind": "rect",
        "x": 66,
        "y": 11,
        "w": 1.65,
        "h": 1.05
      },
      {
        "id": "security_fixture_17",
        "room": "security",
        "kind": "rect",
        "x": 68,
        "y": 11,
        "w": 1.65,
        "h": 1.05
      },
      {
        "id": "security_fixture_18",
        "room": "security",
        "kind": "rect",
        "x": 68,
        "y": 17.5,
        "w": 4,
        "h": 0.5
      },
      {
        "id": "navigation_fixture_19",
        "room": "navigation",
        "kind": "rect",
        "x": 8,
        "y": 54,
        "w": 13,
        "h": 1.1
      },
      {
        "id": "shields_fixture_20",
        "room": "shields",
        "kind": "rect",
        "x": 28,
        "y": 54,
        "w": 10,
        "h": 1
      },
      {
        "id": "laboratory_fixture_21",
        "room": "laboratory",
        "kind": "rect",
        "x": 45.85,
        "y": 53.25,
        "w": 1.15,
        "h": 3.1
      },
      {
        "id": "laboratory_fixture_22",
        "room": "laboratory",
        "kind": "rect",
        "x": 57,
        "y": 53.25,
        "w": 1.15,
        "h": 3.1
      },
      {
        "id": "engine_s_fixture_23",
        "room": "engine_s",
        "kind": "rect",
        "x": 67.8,
        "y": 55.75,
        "w": 1.1,
        "h": 2.5
      },
      {
        "id": "engine_s_fixture_24",
        "room": "engine_s",
        "kind": "rect",
        "x": 69.45,
        "y": 55.75,
        "w": 1.1,
        "h": 2.5
      },
      {
        "id": "engine_s_fixture_25",
        "room": "engine_s",
        "kind": "rect",
        "x": 71.10000000000001,
        "y": 55.75,
        "w": 1.1,
        "h": 2.5
      }
    ],
    "tasks": [
      {
        "id": "t_card_n",
        "name": "Pasar tarjeta de carga",
        "room": "CARGA NORTE",
        "x": 14,
        "y": 12,
        "type": "card",
        "category": "common",
        "visual": false
      },
      {
        "id": "t_wires_n",
        "name": "Reparar cableado",
        "room": "COMUNICACIONES",
        "x": 34,
        "y": 12,
        "type": "wires",
        "category": "common",
        "visual": false
      },
      {
        "id": "t_admin",
        "name": "Descifrar acceso de mando",
        "room": "ADMINISTRACIÓN",
        "x": 14,
        "y": 28,
        "type": "cipher",
        "category": "short",
        "visual": false
      },
      {
        "id": "t_power",
        "name": "Distribuir energía",
        "room": "ELECTRICIDAD",
        "x": 33,
        "y": 28,
        "type": "wires",
        "category": "short",
        "visual": false
      },
      {
        "id": "t_reactor",
        "name": "Alinear núcleo",
        "room": "REACTOR",
        "x": 14,
        "y": 42,
        "type": "sequence",
        "category": "short",
        "visual": false
      },
      {
        "id": "t_scan",
        "name": "Escáner biométrico",
        "room": "ENFERMERÍA",
        "x": 33,
        "y": 42,
        "type": "scan",
        "category": "long",
        "visual": true
      },
      {
        "id": "t_pulse_o2",
        "name": "Regular pulso de oxígeno",
        "room": "OXÍGENO",
        "x": 52,
        "y": 14,
        "type": "pulse",
        "category": "short",
        "visual": false
      },
      {
        "id": "t_cargo_sort",
        "name": "Clasificar carga estelar",
        "room": "CARGA NORTE",
        "x": 11,
        "y": 16,
        "type": "sort",
        "category": "short",
        "visual": false
      },
      {
        "id": "t_frequency",
        "name": "Sintonizar frecuencia orbital",
        "room": "COMUNICACIONES",
        "x": 38,
        "y": 16,
        "type": "frequency",
        "category": "short",
        "visual": false
      },
      {
        "id": "t_reactor_cells",
        "name": "Estabilizar celdas del núcleo",
        "room": "REACTOR",
        "x": 18,
        "y": 44,
        "type": "cells",
        "category": "short",
        "visual": false
      },
      {
        "id": "t_nav",
        "name": "Trazar ruta orbital",
        "room": "NAVEGACIÓN",
        "x": 14,
        "y": 57,
        "type": "route",
        "category": "long",
        "visual": false
      },
      {
        "id": "t_shield",
        "name": "Calibrar escudos",
        "room": "ESCUDOS",
        "x": 33,
        "y": 57,
        "type": "cells",
        "category": "short",
        "visual": false
      },
      {
        "id": "t_sample",
        "name": "Analizar muestras",
        "room": "LABORATORIO",
        "x": 52,
        "y": 57,
        "type": "filter",
        "category": "long",
        "visual": false
      },
      {
        "id": "t_engine",
        "name": "Cargar combustible",
        "room": "PROPULSIÓN",
        "x": 70,
        "y": 57,
        "type": "fuel",
        "category": "long",
        "visual": false
      }
    ],
    "repairs": [
      {
        "id": "electrical_wires",
        "name": "REPARAR DISTRIBUCIÓN ELÉCTRICA",
        "room": "ELECTRICIDAD",
        "x": 33,
        "y": 28,
        "type": "wires"
      },
      {
        "id": "reactor_start",
        "name": "REINICIAR REACTOR",
        "room": "REACTOR",
        "x": 14,
        "y": 44,
        "type": "sequence"
      },
      {
        "id": "comms_fix",
        "name": "RESTABLECER COMUNICACIONES",
        "room": "COMUNICACIONES",
        "x": 34,
        "y": 12,
        "type": "wires"
      },
      {
        "id": "admin_card",
        "name": "DESBLOQUEAR PUERTAS",
        "room": "ADMINISTRACIÓN",
        "x": 14,
        "y": 28,
        "type": "card"
      },
      {
        "id": "o2_admin",
        "name": "CÓDIGO O₂ · ADMINISTRACIÓN",
        "room": "ADMINISTRACIÓN",
        "x": 18,
        "y": 30,
        "type": "code",
        "station": "admin"
      },
      {
        "id": "o2_room",
        "name": "CÓDIGO O₂ · SALA DE OXÍGENO",
        "room": "OXÍGENO",
        "x": 52,
        "y": 14,
        "type": "code",
        "station": "oxygen"
      },
      {
        "id": "reactor_aux",
        "name": "CONTENCIÓN AUXILIAR",
        "room": "REACTOR",
        "x": 18,
        "y": 40,
        "type": "sequence"
      }
    ],
    "vents": [
      {
        "id": "v1",
        "name": "CARGA NORTE",
        "room": "CARGA NORTE",
        "zone": "west",
        "x": 18.2,
        "y": 16,
        "links": [
          "v5",
          "v6"
        ]
      },
      {
        "id": "v6",
        "name": "ADMINISTRACIÓN",
        "room": "ADMINISTRACIÓN",
        "zone": "west",
        "x": 18.2,
        "y": 29.4,
        "links": [
          "v1",
          "v5"
        ]
      },
      {
        "id": "v5",
        "name": "REACTOR",
        "room": "REACTOR",
        "zone": "west",
        "x": 18.2,
        "y": 44,
        "links": [
          "v1",
          "v6"
        ]
      },
      {
        "id": "v7",
        "name": "OXÍGENO",
        "room": "OXÍGENO",
        "zone": "east",
        "x": 53.2,
        "y": 17,
        "links": [
          "v8",
          "v9",
          "v14"
        ]
      },
      {
        "id": "v8",
        "name": "CAFETERÍA NORTE",
        "room": "CAFETERÍA",
        "zone": "east",
        "x": 64.5,
        "y": 26.5,
        "links": [
          "v7",
          "v9"
        ]
      },
      {
        "id": "v9",
        "name": "CAFETERÍA",
        "room": "CAFETERÍA",
        "zone": "east",
        "x": 74.2,
        "y": 35,
        "links": [
          "v7",
          "v8",
          "v14"
        ]
      },
      {
        "id": "v10",
        "name": "NAVEGACIÓN",
        "room": "NAVEGACIÓN",
        "x": 18,
        "y": 60,
        "zone": "south",
        "links": [
          "v11",
          "v12",
          "v13"
        ]
      },
      {
        "id": "v11",
        "name": "ESCUDOS",
        "room": "ESCUDOS",
        "x": 36,
        "y": 60,
        "zone": "south",
        "links": [
          "v10",
          "v12",
          "v13"
        ]
      },
      {
        "id": "v12",
        "name": "LABORATORIO",
        "room": "LABORATORIO",
        "x": 55,
        "y": 60,
        "zone": "south",
        "links": [
          "v10",
          "v11",
          "v13"
        ]
      },
      {
        "id": "v13",
        "name": "PROPULSIÓN",
        "room": "PROPULSIÓN",
        "x": 73,
        "y": 60,
        "zone": "south",
        "links": [
          "v10",
          "v11",
          "v12"
        ]
      },
      {
        "id": "v14",
        "name": "SEGURIDAD",
        "room": "SEGURIDAD",
        "x": 73,
        "y": 16,
        "zone": "east",
        "links": [
          "v7",
          "v9"
        ]
      }
    ]
  },
  "items": [
    {
      "id": "crown",
      "name": "Corona estelar",
      "icon": "👑",
      "price": 650,
      "desc": "Tiara de mando de oro orbital, incrustaciones rojas y filigrana luminosa.",
      "skin": "crown",
      "category": "arriba",
      "kind": "accessory"
    },
    {
      "id": "antenna",
      "name": "Antena alienígena",
      "icon": "📡",
      "price": 500,
      "desc": "Antena exploradora cromada con pulsos de comunicación y terminal luminosa.",
      "skin": "antenna",
      "category": "arriba",
      "kind": "accessory"
    },
    {
      "id": "halo",
      "name": "Aureola",
      "icon": "😇",
      "price": 850,
      "desc": "Anillo holográfico suspendido con resplandor de plasma dorado.",
      "skin": "halo",
      "category": "arriba",
      "kind": "accessory"
    },
    {
      "id": "horns",
      "name": "Cuernos",
      "icon": "😈",
      "price": 700,
      "desc": "Cuernos biomecánicos con filos pulidos y vetas incandescentes.",
      "skin": "horns",
      "category": "arriba",
      "kind": "accessory"
    },
    {
      "id": "flower",
      "name": "Flor orbital",
      "icon": "🌸",
      "price": 450,
      "desc": "Flor de otro mundo con pétalos tallados y nervaduras de nácar.",
      "skin": "flower",
      "category": "arriba",
      "kind": "accessory"
    },
    {
      "id": "robot",
      "name": "Mini dron",
      "icon": "🤖",
      "price": 1400,
      "desc": "Minidron orbital con lente cian, aletas y blindaje metálico.",
      "skin": "robot",
      "category": "arriba",
      "kind": "accessory"
    },
    {
      "id": "star",
      "name": "Estrella",
      "icon": "⭐",
      "price": 400,
      "desc": "Insignia estelar de colección con doble relieve de oro.",
      "skin": "star",
      "category": "arriba",
      "kind": "accessory"
    },
    {
      "id": "cap",
      "name": "Gorra piloto",
      "icon": "🧢",
      "price": 600,
      "desc": "Gorra de aviador con visera reforzada y emblema de la flota.",
      "skin": "cap",
      "category": "arriba",
      "kind": "accessory"
    },
    {
      "id": "skin_neon",
      "name": "Neón tóxico",
      "icon": "☢️",
      "price": 1900,
      "desc": "Traje de contención de reactor con válvulas, tubos, juntas herméticas y símbolo tóxico.",
      "category": "skin",
      "kind": "full",
      "outfit": "hazmat",
      "suit": "#a5df37",
      "trim": "#eaff8a"
    },
    {
      "id": "skin_void",
      "name": "Vacío abisal",
      "icon": "🌌",
      "price": 2200,
      "desc": "Operativo abisal de sigilo: capucha, faldón, placas de sombra y banda ceremonial.",
      "category": "skin",
      "kind": "full",
      "outfit": "ninja",
      "suit": "#493b91",
      "trim": "#b8a7ff"
    },
    {
      "id": "skin_lava",
      "name": "Núcleo ígneo",
      "icon": "🌋",
      "price": 2100,
      "desc": "Armadura imperial volcánica con hombreras forjadas, grietas ígneas y emblema de llama.",
      "category": "skin",
      "kind": "full",
      "outfit": "samurai",
      "suit": "#c94b27",
      "trim": "#ffcf68"
    },
    {
      "id": "skin_ice",
      "name": "Glaciar",
      "icon": "❄️",
      "price": 1800,
      "desc": "Exotraje polar de élite con capucha aislada, placas cristalinas y botas glaciares.",
      "category": "skin",
      "kind": "full",
      "outfit": "arctic",
      "suit": "#83d8ed",
      "trim": "#e6ffff"
    },
    {
      "id": "top_commander",
      "name": "Chaqueta comandante",
      "icon": "🧥",
      "price": 900,
      "desc": "Uniforme de alto mando con charreteras doradas, galones y condecoraciones.",
      "category": "torso",
      "kind": "top",
      "trim": "#e3b64c"
    },
    {
      "id": "top_hazard",
      "name": "Chaleco peligro",
      "icon": "⚠️",
      "price": 750,
      "desc": "Chaleco de operaciones de riesgo con reflectores y señalización de emergencia.",
      "category": "torso",
      "kind": "top",
      "trim": "#f3b72f"
    },
    {
      "id": "top_space",
      "name": "Armadura orbital",
      "icon": "🛡️",
      "price": 1200,
      "desc": "Armadura de reconocimiento orbital con núcleo luminoso y costillas técnicas.",
      "category": "torso",
      "kind": "top",
      "trim": "#62d9e9"
    },
    {
      "id": "top_punk",
      "name": "Chaqueta rebelde",
      "icon": "🧷",
      "price": 950,
      "desc": "Chaqueta rebelde de fibra negra con solapas fucsias y costuras visibles.",
      "category": "torso",
      "kind": "top",
      "trim": "#f15ba8"
    },
    {
      "id": "bottom_boots",
      "name": "Botas magnéticas",
      "icon": "🥾",
      "price": 650,
      "desc": "Botas de anclaje magnético con carcasas articuladas y luces laterales.",
      "category": "abajo",
      "kind": "bottom",
      "trim": "#70c6d9"
    },
    {
      "id": "bottom_gold",
      "name": "Grebas doradas",
      "icon": "🦿",
      "price": 1000,
      "desc": "Grebas de capitán bañadas en oro con grabados geométricos.",
      "category": "abajo",
      "kind": "bottom",
      "trim": "#f4c65e"
    },
    {
      "id": "bottom_neon",
      "name": "Pantalón luminiscente",
      "icon": "🟢",
      "price": 800,
      "desc": "Pantalón de fibra bioeléctrica con circuitos luminosos verdes.",
      "category": "abajo",
      "kind": "bottom",
      "trim": "#9aff55"
    },
    {
      "id": "bottom_void",
      "name": "Pantalón abisal",
      "icon": "🌑",
      "price": 850,
      "desc": "Protección abisal para las piernas con ranuras violetas y placas de sigilo.",
      "category": "abajo",
      "kind": "bottom",
      "trim": "#9a87f5"
    },
    {
      "id": "skin_solar",
      "name": "Ingeniero solar",
      "icon": "☀️",
      "price": 1850,
      "desc": "Exotraje de mantenimiento con placas de cobre y señales de navegación ámbar.",
      "category": "skin",
      "kind": "full",
      "outfit": "hazmat",
      "suit": "#c7833e",
      "trim": "#ffe7a0"
    },
    {
      "id": "skin_aurora",
      "name": "Guardia aurora",
      "icon": "🌠",
      "price": 2350,
      "desc": "Uniforme polar violeta con protecciones de hielo y reflejos verde menta.",
      "category": "skin",
      "kind": "full",
      "outfit": "arctic",
      "suit": "#756ec4",
      "trim": "#a8f8de"
    },
    {
      "id": "skin_warden",
      "name": "Centinela orbital",
      "icon": "🛰️",
      "price": 2450,
      "desc": "Armadura azul de guardia con placas de mando y emblemas de la flota.",
      "category": "skin",
      "kind": "full",
      "outfit": "samurai",
      "suit": "#397ea3",
      "trim": "#a1ecff"
    },
    {
      "id": "skin_eclipse",
      "name": "Explorador eclipse",
      "icon": "🌘",
      "price": 2250,
      "desc": "Traje de exploración grafito con capucha de fibra óptica y bordes coral.",
      "category": "skin",
      "kind": "full",
      "outfit": "ninja",
      "suit": "#45465f",
      "trim": "#ff9eab"
    }
  ]
};});
