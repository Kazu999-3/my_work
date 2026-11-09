// Lolalytics 過去30日統計（patch=30, 1,136万試合）実測メタデータ
export interface ChampionLaneStats {
  pr: number;
  wr: number;
  games: number;
  isOffmeta: boolean;
}

export interface LaneMetaData {
  standard: string[];
  offmeta: string[];
  details: Record<string, ChampionLaneStats>;
}

export const LOLALYTICS_LANE_META: {
  updated_at: string;
  source: string;
  lanes: Record<'TOP' | 'JG' | 'MID' | 'ADC' | 'SUP', LaneMetaData>;
} = {
  "updated_at": "2026-11-09T14:33:24.522Z",
  "source": "Lolalytics (Past 30 Days, patch=30, tier=emerald_plus, queue=ranked, region=all)",
  "lanes": {
    "TOP": {
      "standard": [
        "Yone",
        "Darius",
        "Malphite",
        "Aatrox",
        "Garen",
        "Sett",
        "Jax",
        "Renekton",
        "Jayce",
        "Mordekaiser",
        "Gangplank",
        "Irelia",
        "Fiora",
        "Camille",
        "Teemo",
        "Volibear",
        "Ornn",
        "Pantheon",
        "Ambessa",
        "Nasus",
        "KSante",
        "Shen",
        "Yasuo",
        "Gnar",
        "Sion",
        "DrMundo",
        "Akali",
        "Tryndamere",
        "Chogath",
        "Zaahen",
        "Olaf",
        "Yorick",
        "Illaoi",
        "Gwen",
        "Gragas",
        "Kayle",
        "Urgot",
        "Riven",
        "Singed",
        "Kennen",
        "TahmKench",
        "Kled",
        "Trundle",
        "Rumble",
        "Warwick",
        "Vladimir",
        "Vayne",
        "Heimerdinger",
        "Sylas",
        "MonkeyKing",
        "Poppy",
        "Quinn",
        "Zed",
        "Anivia",
        "Varus",
        "Aurora",
        "Swain",
        "Malzahar",
        "MasterYi",
        "Udyr",
        "Lissandra",
        "Ryze",
        "Zac"
      ],
      "offmeta": [
        "Cassiopeia",
        "Maokai",
        "Corki",
        "Galio",
        "Ahri",
        "Kalista",
        "Kayn",
        "Viktor",
        "Brand",
        "Naafiri",
        "Fiddlesticks",
        "Ekko",
        "Smolder",
        "Rengar",
        "TwistedFate",
        "Locke",
        "Sejuani",
        "Briar",
        "Qiyana",
        "Karma",
        "Shyvana",
        "Zilean",
        "XinZhao",
        "Tristana",
        "Diana",
        "Azir",
        "Akshan",
        "Zoe",
        "AurelionSol",
        "KogMaw",
        "Kassadin",
        "Veigar",
        "Leblanc",
        "Katarina",
        "Fizz",
        "Skarner",
        "Velkoz",
        "Hwei",
        "Karthus",
        "Elise",
        "Annie",
        "RekSai",
        "Draven",
        "Ivern",
        "Neeko",
        "Vex",
        "Nidalee",
        "Rammus"
      ],
      "details": {
        "Ahri": {
          "pr": 0.31,
          "wr": 54.11,
          "games": 18087,
          "isOffmeta": true
        },
        "Fiora": {
          "pr": 4.47,
          "wr": 52.26,
          "games": 258416,
          "isOffmeta": false
        },
        "Zed": {
          "pr": 0.74,
          "wr": 53.37,
          "games": 42509,
          "isOffmeta": false
        },
        "Irelia": {
          "pr": 4.55,
          "wr": 51.97,
          "games": 262614,
          "isOffmeta": false
        },
        "Gangplank": {
          "pr": 5.11,
          "wr": 52.56,
          "games": 294937,
          "isOffmeta": false
        },
        "Yone": {
          "pr": 8.2,
          "wr": 51.18,
          "games": 473617,
          "isOffmeta": false
        },
        "Hwei": {
          "pr": 0.12,
          "wr": 54.19,
          "games": 6845,
          "isOffmeta": true
        },
        "Chogath": {
          "pr": 3.04,
          "wr": 52.19,
          "games": 175517,
          "isOffmeta": false
        },
        "Lissandra": {
          "pr": 0.54,
          "wr": 53.09,
          "games": 31020,
          "isOffmeta": false
        },
        "Zac": {
          "pr": 0.51,
          "wr": 53.27,
          "games": 29239,
          "isOffmeta": false
        },
        "Camille": {
          "pr": 4.3,
          "wr": 52.2,
          "games": 248275,
          "isOffmeta": false
        },
        "Gwen": {
          "pr": 2.47,
          "wr": 52.29,
          "games": 142432,
          "isOffmeta": false
        },
        "Olaf": {
          "pr": 2.85,
          "wr": 52.11,
          "games": 164818,
          "isOffmeta": false
        },
        "Kayle": {
          "pr": 2.35,
          "wr": 53.42,
          "games": 135843,
          "isOffmeta": false
        },
        "Tryndamere": {
          "pr": 3.06,
          "wr": 52.32,
          "games": 176592,
          "isOffmeta": false
        },
        "Darius": {
          "pr": 7.19,
          "wr": 52.4,
          "games": 415228,
          "isOffmeta": false
        },
        "Sett": {
          "pr": 6.21,
          "wr": 52.45,
          "games": 358970,
          "isOffmeta": false
        },
        "Zaahen": {
          "pr": 2.9,
          "wr": 52.05,
          "games": 167605,
          "isOffmeta": false
        },
        "Galio": {
          "pr": 0.37,
          "wr": 52.01,
          "games": 21519,
          "isOffmeta": true
        },
        "Sion": {
          "pr": 3.51,
          "wr": 52.28,
          "games": 202958,
          "isOffmeta": false
        },
        "Anivia": {
          "pr": 0.72,
          "wr": 52.96,
          "games": 41479,
          "isOffmeta": false
        },
        "Kassadin": {
          "pr": 0.17,
          "wr": 54.19,
          "games": 9947,
          "isOffmeta": true
        },
        "Riven": {
          "pr": 2.3,
          "wr": 51.32,
          "games": 132911,
          "isOffmeta": false
        },
        "Shen": {
          "pr": 3.64,
          "wr": 52.86,
          "games": 210251,
          "isOffmeta": false
        },
        "Zoe": {
          "pr": 0.18,
          "wr": 53.91,
          "games": 10523,
          "isOffmeta": true
        },
        "Velkoz": {
          "pr": 0.14,
          "wr": 53.84,
          "games": 7810,
          "isOffmeta": true
        },
        "Qiyana": {
          "pr": 0.24,
          "wr": 51.37,
          "games": 13594,
          "isOffmeta": true
        },
        "Fiddlesticks": {
          "pr": 0.28,
          "wr": 52.73,
          "games": 16244,
          "isOffmeta": true
        },
        "Zilean": {
          "pr": 0.21,
          "wr": 56.06,
          "games": 12211,
          "isOffmeta": true
        },
        "Singed": {
          "pr": 2.17,
          "wr": 53.49,
          "games": 125341,
          "isOffmeta": false
        },
        "MonkeyKing": {
          "pr": 0.93,
          "wr": 52.31,
          "games": 53866,
          "isOffmeta": false
        },
        "Poppy": {
          "pr": 0.9,
          "wr": 52.89,
          "games": 52267,
          "isOffmeta": false
        },
        "AurelionSol": {
          "pr": 0.18,
          "wr": 53.59,
          "games": 10271,
          "isOffmeta": true
        },
        "Ekko": {
          "pr": 0.28,
          "wr": 51.81,
          "games": 16248,
          "isOffmeta": true
        },
        "Aatrox": {
          "pr": 6.37,
          "wr": 51.61,
          "games": 367941,
          "isOffmeta": false
        },
        "Ornn": {
          "pr": 3.93,
          "wr": 53.17,
          "games": 226827,
          "isOffmeta": false
        },
        "Sylas": {
          "pr": 1.19,
          "wr": 51.25,
          "games": 68621,
          "isOffmeta": false
        },
        "Jax": {
          "pr": 5.94,
          "wr": 51.08,
          "games": 343098,
          "isOffmeta": false
        },
        "Malphite": {
          "pr": 7.14,
          "wr": 53.36,
          "games": 412437,
          "isOffmeta": false
        },
        "Nasus": {
          "pr": 3.83,
          "wr": 52.55,
          "games": 221355,
          "isOffmeta": false
        },
        "Gragas": {
          "pr": 2.47,
          "wr": 51.48,
          "games": 142911,
          "isOffmeta": false
        },
        "Pantheon": {
          "pr": 3.92,
          "wr": 51.82,
          "games": 226433,
          "isOffmeta": false
        },
        "Mordekaiser": {
          "pr": 5.58,
          "wr": 52.56,
          "games": 322105,
          "isOffmeta": false
        },
        "Kennen": {
          "pr": 1.86,
          "wr": 51.38,
          "games": 107681,
          "isOffmeta": false
        },
        "Garen": {
          "pr": 6.22,
          "wr": 52.94,
          "games": 359609,
          "isOffmeta": false
        },
        "Yasuo": {
          "pr": 3.6,
          "wr": 51.17,
          "games": 208178,
          "isOffmeta": false
        },
        "Kled": {
          "pr": 1.69,
          "wr": 52.86,
          "games": 97394,
          "isOffmeta": false
        },
        "Aurora": {
          "pr": 0.58,
          "wr": 51.78,
          "games": 33667,
          "isOffmeta": false
        },
        "Annie": {
          "pr": 0.11,
          "wr": 54.62,
          "games": 6168,
          "isOffmeta": true
        },
        "Urgot": {
          "pr": 2.35,
          "wr": 52.49,
          "games": 136053,
          "isOffmeta": false
        },
        "Leblanc": {
          "pr": 0.16,
          "wr": 51.74,
          "games": 9142,
          "isOffmeta": true
        },
        "Teemo": {
          "pr": 4.06,
          "wr": 53.28,
          "games": 234404,
          "isOffmeta": false
        },
        "Karthus": {
          "pr": 0.12,
          "wr": 50.57,
          "games": 6723,
          "isOffmeta": true
        },
        "Swain": {
          "pr": 0.58,
          "wr": 51.93,
          "games": 33713,
          "isOffmeta": false
        },
        "Renekton": {
          "pr": 5.77,
          "wr": 51.46,
          "games": 333450,
          "isOffmeta": false
        },
        "Akali": {
          "pr": 3.16,
          "wr": 50.75,
          "games": 182601,
          "isOffmeta": false
        },
        "Rengar": {
          "pr": 0.27,
          "wr": 50.82,
          "games": 15743,
          "isOffmeta": true
        },
        "Viktor": {
          "pr": 0.3,
          "wr": 51.19,
          "games": 17380,
          "isOffmeta": true
        },
        "Quinn": {
          "pr": 0.83,
          "wr": 54,
          "games": 47719,
          "isOffmeta": false
        },
        "Akshan": {
          "pr": 0.19,
          "wr": 52.03,
          "games": 11223,
          "isOffmeta": true
        },
        "RekSai": {
          "pr": 0.11,
          "wr": 52.45,
          "games": 6542,
          "isOffmeta": true
        },
        "Kalista": {
          "pr": 0.31,
          "wr": 50.39,
          "games": 17657,
          "isOffmeta": true
        },
        "Vladimir": {
          "pr": 1.33,
          "wr": 51.09,
          "games": 76637,
          "isOffmeta": false
        },
        "Warwick": {
          "pr": 1.41,
          "wr": 53.18,
          "games": 81702,
          "isOffmeta": false
        },
        "DrMundo": {
          "pr": 3.35,
          "wr": 51.81,
          "games": 193550,
          "isOffmeta": false
        },
        "Katarina": {
          "pr": 0.16,
          "wr": 50.44,
          "games": 9287,
          "isOffmeta": true
        },
        "Cassiopeia": {
          "pr": 0.44,
          "wr": 51.3,
          "games": 25153,
          "isOffmeta": true
        },
        "Heimerdinger": {
          "pr": 1.21,
          "wr": 52.32,
          "games": 70054,
          "isOffmeta": false
        },
        "Malzahar": {
          "pr": 0.56,
          "wr": 51.85,
          "games": 32365,
          "isOffmeta": false
        },
        "TahmKench": {
          "pr": 1.84,
          "wr": 52.26,
          "games": 106198,
          "isOffmeta": false
        },
        "Azir": {
          "pr": 0.2,
          "wr": 53.45,
          "games": 11307,
          "isOffmeta": true
        },
        "Illaoi": {
          "pr": 2.56,
          "wr": 52.55,
          "games": 147758,
          "isOffmeta": false
        },
        "Vex": {
          "pr": 0.08,
          "wr": 52.63,
          "games": 4374,
          "isOffmeta": true
        },
        "TwistedFate": {
          "pr": 0.27,
          "wr": 50.17,
          "games": 15688,
          "isOffmeta": true
        },
        "XinZhao": {
          "pr": 0.21,
          "wr": 50.12,
          "games": 11859,
          "isOffmeta": true
        },
        "Veigar": {
          "pr": 0.17,
          "wr": 52.08,
          "games": 9740,
          "isOffmeta": true
        },
        "Elise": {
          "pr": 0.12,
          "wr": 51.22,
          "games": 7159,
          "isOffmeta": true
        },
        "Brand": {
          "pr": 0.29,
          "wr": 52.21,
          "games": 16629,
          "isOffmeta": true
        },
        "KogMaw": {
          "pr": 0.18,
          "wr": 51.71,
          "games": 10587,
          "isOffmeta": true
        },
        "Volibear": {
          "pr": 4.02,
          "wr": 50.84,
          "games": 232187,
          "isOffmeta": false
        },
        "Jayce": {
          "pr": 5.61,
          "wr": 48.94,
          "games": 324061,
          "isOffmeta": false
        },
        "Gnar": {
          "pr": 3.57,
          "wr": 50.34,
          "games": 206075,
          "isOffmeta": false
        },
        "Naafiri": {
          "pr": 0.29,
          "wr": 51.83,
          "games": 16611,
          "isOffmeta": true
        },
        "MasterYi": {
          "pr": 0.56,
          "wr": 50.08,
          "games": 32533,
          "isOffmeta": false
        },
        "Ryze": {
          "pr": 0.54,
          "wr": 50.31,
          "games": 31430,
          "isOffmeta": false
        },
        "Maokai": {
          "pr": 0.44,
          "wr": 51.19,
          "games": 25588,
          "isOffmeta": true
        },
        "Yorick": {
          "pr": 2.76,
          "wr": 51.06,
          "games": 159471,
          "isOffmeta": false
        },
        "Briar": {
          "pr": 0.25,
          "wr": 51.39,
          "games": 14217,
          "isOffmeta": true
        },
        "Neeko": {
          "pr": 0.09,
          "wr": 50.95,
          "games": 5476,
          "isOffmeta": true
        },
        "Ambessa": {
          "pr": 3.88,
          "wr": 49.39,
          "games": 224210,
          "isOffmeta": false
        },
        "Locke": {
          "pr": 0.26,
          "wr": 48.64,
          "games": 14765,
          "isOffmeta": true
        },
        "KSante": {
          "pr": 3.75,
          "wr": 47.71,
          "games": 216369,
          "isOffmeta": false
        },
        "Tristana": {
          "pr": 0.21,
          "wr": 46.96,
          "games": 11858,
          "isOffmeta": true
        },
        "Trundle": {
          "pr": 1.67,
          "wr": 50.71,
          "games": 96451,
          "isOffmeta": false
        },
        "Nidalee": {
          "pr": 0.08,
          "wr": 45.59,
          "games": 4534,
          "isOffmeta": true
        },
        "Fizz": {
          "pr": 0.16,
          "wr": 50.63,
          "games": 9145,
          "isOffmeta": true
        },
        "Draven": {
          "pr": 0.11,
          "wr": 48.33,
          "games": 6576,
          "isOffmeta": true
        },
        "Diana": {
          "pr": 0.21,
          "wr": 50.13,
          "games": 12089,
          "isOffmeta": true
        },
        "Karma": {
          "pr": 0.22,
          "wr": 49.11,
          "games": 12618,
          "isOffmeta": true
        },
        "Vayne": {
          "pr": 1.27,
          "wr": 50.33,
          "games": 73402,
          "isOffmeta": false
        },
        "Rumble": {
          "pr": 1.57,
          "wr": 48.59,
          "games": 90975,
          "isOffmeta": false
        },
        "Skarner": {
          "pr": 0.16,
          "wr": 49.37,
          "games": 9227,
          "isOffmeta": true
        },
        "Sejuani": {
          "pr": 0.26,
          "wr": 51.3,
          "games": 15161,
          "isOffmeta": true
        },
        "Corki": {
          "pr": 0.42,
          "wr": 47.01,
          "games": 23979,
          "isOffmeta": true
        },
        "Udyr": {
          "pr": 0.55,
          "wr": 49.57,
          "games": 31756,
          "isOffmeta": false
        },
        "Kayn": {
          "pr": 0.31,
          "wr": 48.41,
          "games": 17717,
          "isOffmeta": true
        },
        "Ivern": {
          "pr": 0.11,
          "wr": 48.79,
          "games": 6153,
          "isOffmeta": true
        },
        "Rammus": {
          "pr": 0.07,
          "wr": 48.48,
          "games": 4319,
          "isOffmeta": true
        },
        "Shyvana": {
          "pr": 0.22,
          "wr": 48.01,
          "games": 12861,
          "isOffmeta": true
        },
        "Varus": {
          "pr": 0.69,
          "wr": 49.11,
          "games": 39993,
          "isOffmeta": false
        },
        "Smolder": {
          "pr": 0.28,
          "wr": 46.16,
          "games": 16142,
          "isOffmeta": true
        }
      }
    },
    "JG": {
      "standard": [
        "LeeSin",
        "Viego",
        "Graves",
        "JarvanIV",
        "Kayn",
        "Qiyana",
        "MonkeyKing",
        "Khazix",
        "Sylas",
        "MasterYi",
        "Chogath",
        "Talon",
        "Hecarim",
        "Lillia",
        "Ekko",
        "Vi",
        "Shaco",
        "Briar",
        "Nocturne",
        "Shyvana",
        "Rengar",
        "Diana",
        "Elise",
        "Warwick",
        "Naafiri",
        "XinZhao",
        "Evelynn",
        "Nidalee",
        "Zed",
        "Zac",
        "Kindred",
        "Belveth",
        "Sejuani",
        "Nunu",
        "Jayce",
        "Fiddlesticks",
        "Amumu",
        "Rammus",
        "Udyr",
        "Taliyah",
        "Zyra",
        "RekSai",
        "Karthus",
        "Quinn",
        "Ivern",
        "Darius",
        "Volibear",
        "Skarner",
        "Pantheon",
        "Gwen",
        "Aatrox",
        "Jax",
        "Malphite",
        "Locke",
        "Gragas",
        "Trundle",
        "Ambessa",
        "Fizz",
        "Teemo",
        "Maokai"
      ],
      "offmeta": [
        "Zaahen",
        "Sion",
        "DrMundo",
        "Shen",
        "Poppy",
        "Olaf",
        "Mordekaiser",
        "Morgana",
        "Tryndamere",
        "Brand",
        "Twitch",
        "Nasus",
        "Riven",
        "Rumble",
        "AurelionSol",
        "Neeko",
        "Singed",
        "Taric"
      ],
      "details": {
        "Chogath": {
          "pr": 5.8,
          "wr": 53.65,
          "games": 335362,
          "isOffmeta": false
        },
        "MonkeyKing": {
          "pr": 6.94,
          "wr": 53.74,
          "games": 400792,
          "isOffmeta": false
        },
        "MasterYi": {
          "pr": 6.14,
          "wr": 52.7,
          "games": 354637,
          "isOffmeta": false
        },
        "Ekko": {
          "pr": 4.72,
          "wr": 52.28,
          "games": 272939,
          "isOffmeta": false
        },
        "Lillia": {
          "pr": 5.12,
          "wr": 53.55,
          "games": 296013,
          "isOffmeta": false
        },
        "Shyvana": {
          "pr": 3.97,
          "wr": 53.49,
          "games": 229258,
          "isOffmeta": false
        },
        "Zac": {
          "pr": 2.65,
          "wr": 53.1,
          "games": 153317,
          "isOffmeta": false
        },
        "Taliyah": {
          "pr": 1.76,
          "wr": 52.42,
          "games": 101596,
          "isOffmeta": false
        },
        "Shaco": {
          "pr": 4.32,
          "wr": 52.62,
          "games": 249334,
          "isOffmeta": false
        },
        "Talon": {
          "pr": 5.43,
          "wr": 51.8,
          "games": 313692,
          "isOffmeta": false
        },
        "Graves": {
          "pr": 7.79,
          "wr": 51.07,
          "games": 450326,
          "isOffmeta": false
        },
        "Briar": {
          "pr": 4.3,
          "wr": 53.61,
          "games": 248155,
          "isOffmeta": false
        },
        "Viego": {
          "pr": 8.23,
          "wr": 51.43,
          "games": 475354,
          "isOffmeta": false
        },
        "Khazix": {
          "pr": 6.69,
          "wr": 51.24,
          "games": 386543,
          "isOffmeta": false
        },
        "Kayn": {
          "pr": 7.47,
          "wr": 52.05,
          "games": 431338,
          "isOffmeta": false
        },
        "Zyra": {
          "pr": 1.72,
          "wr": 53.69,
          "games": 99580,
          "isOffmeta": false
        },
        "Belveth": {
          "pr": 2.57,
          "wr": 53.35,
          "games": 148654,
          "isOffmeta": false
        },
        "RekSai": {
          "pr": 1.37,
          "wr": 53.14,
          "games": 78952,
          "isOffmeta": false
        },
        "Zaahen": {
          "pr": 0.48,
          "wr": 53.44,
          "games": 27776,
          "isOffmeta": true
        },
        "Fiddlesticks": {
          "pr": 1.99,
          "wr": 52.86,
          "games": 115170,
          "isOffmeta": false
        },
        "Sion": {
          "pr": 0.47,
          "wr": 54.01,
          "games": 27376,
          "isOffmeta": true
        },
        "Hecarim": {
          "pr": 5.27,
          "wr": 50.96,
          "games": 304363,
          "isOffmeta": false
        },
        "Darius": {
          "pr": 1.06,
          "wr": 53.34,
          "games": 61526,
          "isOffmeta": false
        },
        "Kindred": {
          "pr": 2.64,
          "wr": 52.22,
          "games": 152379,
          "isOffmeta": false
        },
        "Sylas": {
          "pr": 6.33,
          "wr": 51.32,
          "games": 365757,
          "isOffmeta": false
        },
        "Gwen": {
          "pr": 0.92,
          "wr": 52.59,
          "games": 52873,
          "isOffmeta": false
        },
        "XinZhao": {
          "pr": 2.92,
          "wr": 51.94,
          "games": 168762,
          "isOffmeta": false
        },
        "Warwick": {
          "pr": 3,
          "wr": 53.89,
          "games": 173040,
          "isOffmeta": false
        },
        "Nunu": {
          "pr": 2.03,
          "wr": 52.6,
          "games": 117133,
          "isOffmeta": false
        },
        "Evelynn": {
          "pr": 2.83,
          "wr": 52.71,
          "games": 163380,
          "isOffmeta": false
        },
        "Karthus": {
          "pr": 1.37,
          "wr": 50.81,
          "games": 78988,
          "isOffmeta": false
        },
        "JarvanIV": {
          "pr": 7.5,
          "wr": 51.18,
          "games": 433150,
          "isOffmeta": false
        },
        "Elise": {
          "pr": 3.18,
          "wr": 52.42,
          "games": 183646,
          "isOffmeta": false
        },
        "Gragas": {
          "pr": 0.81,
          "wr": 52.6,
          "games": 46652,
          "isOffmeta": false
        },
        "Olaf": {
          "pr": 0.36,
          "wr": 52.06,
          "games": 20835,
          "isOffmeta": true
        },
        "Amumu": {
          "pr": 1.95,
          "wr": 53.04,
          "games": 112833,
          "isOffmeta": false
        },
        "Rammus": {
          "pr": 1.84,
          "wr": 54.6,
          "games": 106085,
          "isOffmeta": false
        },
        "LeeSin": {
          "pr": 12.67,
          "wr": 49.98,
          "games": 732255,
          "isOffmeta": false
        },
        "Skarner": {
          "pr": 0.99,
          "wr": 52.69,
          "games": 57144,
          "isOffmeta": false
        },
        "Nidalee": {
          "pr": 2.7,
          "wr": 52.03,
          "games": 155746,
          "isOffmeta": false
        },
        "Udyr": {
          "pr": 1.84,
          "wr": 53.01,
          "games": 106439,
          "isOffmeta": false
        },
        "Diana": {
          "pr": 3.5,
          "wr": 51.86,
          "games": 202184,
          "isOffmeta": false
        },
        "Ivern": {
          "pr": 1.07,
          "wr": 53.31,
          "games": 62000,
          "isOffmeta": false
        },
        "Tryndamere": {
          "pr": 0.24,
          "wr": 52.25,
          "games": 13654,
          "isOffmeta": true
        },
        "Jax": {
          "pr": 0.86,
          "wr": 51.35,
          "games": 49892,
          "isOffmeta": false
        },
        "Maokai": {
          "pr": 0.55,
          "wr": 52.45,
          "games": 31756,
          "isOffmeta": false
        },
        "Mordekaiser": {
          "pr": 0.33,
          "wr": 53.06,
          "games": 19338,
          "isOffmeta": true
        },
        "Sejuani": {
          "pr": 2.27,
          "wr": 53.54,
          "games": 130876,
          "isOffmeta": false
        },
        "Qiyana": {
          "pr": 7.11,
          "wr": 48.39,
          "games": 410894,
          "isOffmeta": false
        },
        "Aatrox": {
          "pr": 0.88,
          "wr": 51.84,
          "games": 51010,
          "isOffmeta": false
        },
        "Naafiri": {
          "pr": 2.95,
          "wr": 51.72,
          "games": 170468,
          "isOffmeta": false
        },
        "DrMundo": {
          "pr": 0.42,
          "wr": 52.17,
          "games": 24213,
          "isOffmeta": true
        },
        "Shen": {
          "pr": 0.37,
          "wr": 51.83,
          "games": 21301,
          "isOffmeta": true
        },
        "Fizz": {
          "pr": 0.63,
          "wr": 51.99,
          "games": 36233,
          "isOffmeta": false
        },
        "Volibear": {
          "pr": 1.04,
          "wr": 52.05,
          "games": 60244,
          "isOffmeta": false
        },
        "Rengar": {
          "pr": 3.92,
          "wr": 49.88,
          "games": 226583,
          "isOffmeta": false
        },
        "Quinn": {
          "pr": 1.15,
          "wr": 51.74,
          "games": 66636,
          "isOffmeta": false
        },
        "Vi": {
          "pr": 4.51,
          "wr": 50.85,
          "games": 260408,
          "isOffmeta": false
        },
        "Morgana": {
          "pr": 0.28,
          "wr": 52.24,
          "games": 16440,
          "isOffmeta": true
        },
        "Trundle": {
          "pr": 0.77,
          "wr": 52.57,
          "games": 44696,
          "isOffmeta": false
        },
        "Poppy": {
          "pr": 0.37,
          "wr": 51.24,
          "games": 21549,
          "isOffmeta": true
        },
        "Riven": {
          "pr": 0.13,
          "wr": 48.88,
          "games": 7232,
          "isOffmeta": true
        },
        "Jayce": {
          "pr": 2.02,
          "wr": 48.33,
          "games": 116903,
          "isOffmeta": false
        },
        "Zed": {
          "pr": 2.69,
          "wr": 49.27,
          "games": 155153,
          "isOffmeta": false
        },
        "Rumble": {
          "pr": 0.11,
          "wr": 48.64,
          "games": 6522,
          "isOffmeta": true
        },
        "Pantheon": {
          "pr": 0.96,
          "wr": 49.35,
          "games": 55193,
          "isOffmeta": false
        },
        "Neeko": {
          "pr": 0.08,
          "wr": 50.43,
          "games": 4533,
          "isOffmeta": true
        },
        "Ambessa": {
          "pr": 0.68,
          "wr": 48.58,
          "games": 39385,
          "isOffmeta": false
        },
        "Locke": {
          "pr": 0.82,
          "wr": 48.24,
          "games": 47662,
          "isOffmeta": false
        },
        "Teemo": {
          "pr": 0.56,
          "wr": 51.75,
          "games": 32453,
          "isOffmeta": false
        },
        "Nocturne": {
          "pr": 4.05,
          "wr": 50.97,
          "games": 233901,
          "isOffmeta": false
        },
        "AurelionSol": {
          "pr": 0.09,
          "wr": 48.7,
          "games": 5441,
          "isOffmeta": true
        },
        "Singed": {
          "pr": 0.05,
          "wr": 46.78,
          "games": 3125,
          "isOffmeta": true
        },
        "Twitch": {
          "pr": 0.14,
          "wr": 44.34,
          "games": 8281,
          "isOffmeta": true
        },
        "Malphite": {
          "pr": 0.84,
          "wr": 50.8,
          "games": 48431,
          "isOffmeta": false
        },
        "Taric": {
          "pr": 0.03,
          "wr": 48.03,
          "games": 1674,
          "isOffmeta": true
        },
        "Brand": {
          "pr": 0.24,
          "wr": 49.15,
          "games": 14084,
          "isOffmeta": true
        },
        "Nasus": {
          "pr": 0.14,
          "wr": 48.4,
          "games": 7843,
          "isOffmeta": true
        }
      }
    },
    "MID": {
      "standard": [
        "Ahri",
        "Yasuo",
        "Syndra",
        "Zed",
        "Yone",
        "Viktor",
        "Akali",
        "Locke",
        "Sylas",
        "Katarina",
        "Leblanc",
        "Lissandra",
        "Malzahar",
        "Ekko",
        "Fizz",
        "TwistedFate",
        "Vladimir",
        "Galio",
        "Xerath",
        "Lux",
        "Orianna",
        "Hwei",
        "Diana",
        "Veigar",
        "Vex",
        "Kassadin",
        "Zoe",
        "Irelia",
        "Aurora",
        "Qiyana",
        "Anivia",
        "Akshan",
        "Ryze",
        "Taliyah",
        "Mel",
        "Annie",
        "Azir",
        "AurelionSol",
        "Talon",
        "Cassiopeia",
        "Velkoz",
        "Pantheon",
        "Swain",
        "Malphite",
        "Naafiri",
        "KogMaw",
        "Jayce",
        "Tristana",
        "Nasus",
        "Ziggs",
        "Brand",
        "Sion",
        "Kayle",
        "Smolder",
        "Gragas",
        "Chogath",
        "Gwen",
        "Lucian",
        "Garen"
      ],
      "offmeta": [
        "Riven",
        "Gangplank",
        "Ezreal",
        "Kennen",
        "Morgana",
        "Tryndamere",
        "Nunu",
        "Corki",
        "Neeko",
        "Renekton",
        "Volibear",
        "Heimerdinger",
        "Zilean",
        "Ambessa",
        "Singed",
        "Quinn",
        "Varus",
        "Briar",
        "Sett",
        "Karma",
        "Twitch",
        "Mordekaiser",
        "Karthus",
        "Zac",
        "Teemo",
        "XinZhao",
        "Rumble",
        "Zyra",
        "Yorick",
        "Kled",
        "Kalista",
        "KSante",
        "Vayne",
        "Fiddlesticks",
        "DrMundo",
        "Illaoi"
      ],
      "details": {
        "Katarina": {
          "pr": 6.57,
          "wr": 52.57,
          "games": 379744,
          "isOffmeta": false
        },
        "Ekko": {
          "pr": 5.12,
          "wr": 53.42,
          "games": 295631,
          "isOffmeta": false
        },
        "TwistedFate": {
          "pr": 5,
          "wr": 52.7,
          "games": 288918,
          "isOffmeta": false
        },
        "Ahri": {
          "pr": 10.12,
          "wr": 53.14,
          "games": 584822,
          "isOffmeta": false
        },
        "Yone": {
          "pr": 8.19,
          "wr": 51.98,
          "games": 472885,
          "isOffmeta": false
        },
        "Hwei": {
          "pr": 3.64,
          "wr": 52.58,
          "games": 210142,
          "isOffmeta": false
        },
        "Leblanc": {
          "pr": 5.51,
          "wr": 52.32,
          "games": 318318,
          "isOffmeta": false
        },
        "Talon": {
          "pr": 1.64,
          "wr": 52.28,
          "games": 94518,
          "isOffmeta": false
        },
        "Lissandra": {
          "pr": 5.49,
          "wr": 52.65,
          "games": 317245,
          "isOffmeta": false
        },
        "Gwen": {
          "pr": 0.52,
          "wr": 54.95,
          "games": 30201,
          "isOffmeta": false
        },
        "Kennen": {
          "pr": 0.37,
          "wr": 54.47,
          "games": 21301,
          "isOffmeta": true
        },
        "Yasuo": {
          "pr": 9.08,
          "wr": 51.91,
          "games": 524626,
          "isOffmeta": false
        },
        "Velkoz": {
          "pr": 1.08,
          "wr": 53.43,
          "games": 62227,
          "isOffmeta": false
        },
        "Zed": {
          "pr": 8.24,
          "wr": 51.47,
          "games": 475830,
          "isOffmeta": false
        },
        "Vex": {
          "pr": 3.12,
          "wr": 53.95,
          "games": 180352,
          "isOffmeta": false
        },
        "Aurora": {
          "pr": 2.59,
          "wr": 52.37,
          "games": 149677,
          "isOffmeta": false
        },
        "Vladimir": {
          "pr": 4.25,
          "wr": 53.13,
          "games": 245411,
          "isOffmeta": false
        },
        "Gragas": {
          "pr": 0.54,
          "wr": 53.45,
          "games": 31077,
          "isOffmeta": false
        },
        "Xerath": {
          "pr": 4.19,
          "wr": 53.12,
          "games": 242138,
          "isOffmeta": false
        },
        "Fizz": {
          "pr": 5.07,
          "wr": 53.42,
          "games": 293025,
          "isOffmeta": false
        },
        "Syndra": {
          "pr": 8.42,
          "wr": 51.43,
          "games": 486296,
          "isOffmeta": false
        },
        "Taliyah": {
          "pr": 1.94,
          "wr": 51.39,
          "games": 111875,
          "isOffmeta": false
        },
        "Qiyana": {
          "pr": 2.53,
          "wr": 50.71,
          "games": 146094,
          "isOffmeta": false
        },
        "Tryndamere": {
          "pr": 0.34,
          "wr": 53.96,
          "games": 19750,
          "isOffmeta": true
        },
        "Kassadin": {
          "pr": 2.97,
          "wr": 52.29,
          "games": 171781,
          "isOffmeta": false
        },
        "Swain": {
          "pr": 0.85,
          "wr": 52.85,
          "games": 49223,
          "isOffmeta": false
        },
        "Riven": {
          "pr": 0.49,
          "wr": 52.33,
          "games": 28054,
          "isOffmeta": true
        },
        "Lux": {
          "pr": 4.02,
          "wr": 52.75,
          "games": 232286,
          "isOffmeta": false
        },
        "Viktor": {
          "pr": 7.58,
          "wr": 50.84,
          "games": 437766,
          "isOffmeta": false
        },
        "Diana": {
          "pr": 3.49,
          "wr": 52.79,
          "games": 201541,
          "isOffmeta": false
        },
        "Zoe": {
          "pr": 2.83,
          "wr": 52.17,
          "games": 163478,
          "isOffmeta": false
        },
        "Locke": {
          "pr": 6.95,
          "wr": 51.22,
          "games": 401251,
          "isOffmeta": false
        },
        "Galio": {
          "pr": 4.2,
          "wr": 50.61,
          "games": 242571,
          "isOffmeta": false
        },
        "Fiddlesticks": {
          "pr": 0.09,
          "wr": 53.18,
          "games": 5079,
          "isOffmeta": true
        },
        "Sion": {
          "pr": 0.59,
          "wr": 52.81,
          "games": 34358,
          "isOffmeta": false
        },
        "Zilean": {
          "pr": 0.26,
          "wr": 54.54,
          "games": 14758,
          "isOffmeta": true
        },
        "Karthus": {
          "pr": 0.15,
          "wr": 51.64,
          "games": 8784,
          "isOffmeta": true
        },
        "Pantheon": {
          "pr": 0.94,
          "wr": 52.79,
          "games": 54520,
          "isOffmeta": false
        },
        "AurelionSol": {
          "pr": 1.72,
          "wr": 52.24,
          "games": 99251,
          "isOffmeta": false
        },
        "Akshan": {
          "pr": 2.22,
          "wr": 51.49,
          "games": 128177,
          "isOffmeta": false
        },
        "Kalista": {
          "pr": 0.1,
          "wr": 51.76,
          "games": 5912,
          "isOffmeta": true
        },
        "Annie": {
          "pr": 1.88,
          "wr": 52.7,
          "games": 108797,
          "isOffmeta": false
        },
        "Singed": {
          "pr": 0.24,
          "wr": 54.7,
          "games": 13922,
          "isOffmeta": true
        },
        "Anivia": {
          "pr": 2.32,
          "wr": 51.85,
          "games": 134139,
          "isOffmeta": false
        },
        "Irelia": {
          "pr": 2.83,
          "wr": 50.47,
          "games": 163305,
          "isOffmeta": false
        },
        "Veigar": {
          "pr": 3.26,
          "wr": 52.62,
          "games": 188391,
          "isOffmeta": false
        },
        "Akali": {
          "pr": 7.07,
          "wr": 50.63,
          "games": 408342,
          "isOffmeta": false
        },
        "Malzahar": {
          "pr": 5.14,
          "wr": 52.06,
          "games": 296961,
          "isOffmeta": false
        },
        "Quinn": {
          "pr": 0.24,
          "wr": 53.39,
          "games": 14093,
          "isOffmeta": true
        },
        "Zac": {
          "pr": 0.14,
          "wr": 52.2,
          "games": 8180,
          "isOffmeta": true
        },
        "Kled": {
          "pr": 0.11,
          "wr": 53.3,
          "games": 6357,
          "isOffmeta": true
        },
        "Sylas": {
          "pr": 6.83,
          "wr": 50.16,
          "games": 394365,
          "isOffmeta": false
        },
        "Sett": {
          "pr": 0.18,
          "wr": 52.56,
          "games": 10303,
          "isOffmeta": true
        },
        "Kayle": {
          "pr": 0.55,
          "wr": 52.23,
          "games": 31923,
          "isOffmeta": false
        },
        "Chogath": {
          "pr": 0.54,
          "wr": 51.27,
          "games": 31483,
          "isOffmeta": false
        },
        "Orianna": {
          "pr": 4.01,
          "wr": 48.68,
          "games": 231955,
          "isOffmeta": false
        },
        "Heimerdinger": {
          "pr": 0.27,
          "wr": 54.31,
          "games": 15573,
          "isOffmeta": true
        },
        "Mordekaiser": {
          "pr": 0.16,
          "wr": 52.75,
          "games": 9085,
          "isOffmeta": true
        },
        "KogMaw": {
          "pr": 0.74,
          "wr": 52.02,
          "games": 42759,
          "isOffmeta": false
        },
        "Ziggs": {
          "pr": 0.65,
          "wr": 52.42,
          "games": 37398,
          "isOffmeta": false
        },
        "Zyra": {
          "pr": 0.12,
          "wr": 52.02,
          "games": 6968,
          "isOffmeta": true
        },
        "Neeko": {
          "pr": 0.31,
          "wr": 53.16,
          "games": 17957,
          "isOffmeta": true
        },
        "XinZhao": {
          "pr": 0.13,
          "wr": 50.36,
          "games": 7530,
          "isOffmeta": true
        },
        "Gangplank": {
          "pr": 0.41,
          "wr": 50.76,
          "games": 23942,
          "isOffmeta": true
        },
        "Malphite": {
          "pr": 0.78,
          "wr": 52.49,
          "games": 45267,
          "isOffmeta": false
        },
        "Renekton": {
          "pr": 0.28,
          "wr": 51.5,
          "games": 16422,
          "isOffmeta": true
        },
        "Nasus": {
          "pr": 0.68,
          "wr": 51.82,
          "games": 39383,
          "isOffmeta": false
        },
        "Garen": {
          "pr": 0.5,
          "wr": 52.4,
          "games": 29064,
          "isOffmeta": false
        },
        "Jayce": {
          "pr": 0.73,
          "wr": 49.2,
          "games": 42289,
          "isOffmeta": false
        },
        "Ambessa": {
          "pr": 0.26,
          "wr": 50.37,
          "games": 15234,
          "isOffmeta": true
        },
        "Naafiri": {
          "pr": 0.76,
          "wr": 51.43,
          "games": 43963,
          "isOffmeta": false
        },
        "Tristana": {
          "pr": 0.7,
          "wr": 48.66,
          "games": 40361,
          "isOffmeta": false
        },
        "Nunu": {
          "pr": 0.32,
          "wr": 51.25,
          "games": 18226,
          "isOffmeta": true
        },
        "Morgana": {
          "pr": 0.36,
          "wr": 52.02,
          "games": 20878,
          "isOffmeta": true
        },
        "Brand": {
          "pr": 0.62,
          "wr": 52.11,
          "games": 35712,
          "isOffmeta": false
        },
        "Rumble": {
          "pr": 0.13,
          "wr": 50.31,
          "games": 7366,
          "isOffmeta": true
        },
        "Cassiopeia": {
          "pr": 1.25,
          "wr": 49.2,
          "games": 72234,
          "isOffmeta": false
        },
        "KSante": {
          "pr": 0.1,
          "wr": 47.56,
          "games": 6033,
          "isOffmeta": true
        },
        "Ryze": {
          "pr": 2.08,
          "wr": 48.14,
          "games": 120257,
          "isOffmeta": false
        },
        "Twitch": {
          "pr": 0.17,
          "wr": 49.48,
          "games": 9852,
          "isOffmeta": true
        },
        "Karma": {
          "pr": 0.18,
          "wr": 48.36,
          "games": 10578,
          "isOffmeta": true
        },
        "Ezreal": {
          "pr": 0.38,
          "wr": 44.61,
          "games": 21962,
          "isOffmeta": true
        },
        "Briar": {
          "pr": 0.2,
          "wr": 51.01,
          "games": 11621,
          "isOffmeta": true
        },
        "Illaoi": {
          "pr": 0.07,
          "wr": 52.15,
          "games": 4031,
          "isOffmeta": true
        },
        "Teemo": {
          "pr": 0.14,
          "wr": 50.68,
          "games": 8102,
          "isOffmeta": true
        },
        "Corki": {
          "pr": 0.32,
          "wr": 46.39,
          "games": 18372,
          "isOffmeta": true
        },
        "Vayne": {
          "pr": 0.1,
          "wr": 48.77,
          "games": 5905,
          "isOffmeta": true
        },
        "Azir": {
          "pr": 1.87,
          "wr": 48.94,
          "games": 108106,
          "isOffmeta": false
        },
        "DrMundo": {
          "pr": 0.09,
          "wr": 47.67,
          "games": 5188,
          "isOffmeta": true
        },
        "Volibear": {
          "pr": 0.28,
          "wr": 47.56,
          "games": 16302,
          "isOffmeta": true
        },
        "Varus": {
          "pr": 0.22,
          "wr": 47.69,
          "games": 12993,
          "isOffmeta": true
        },
        "Lucian": {
          "pr": 0.51,
          "wr": 44.67,
          "games": 29428,
          "isOffmeta": false
        },
        "Yorick": {
          "pr": 0.12,
          "wr": 48.4,
          "games": 6816,
          "isOffmeta": true
        },
        "Mel": {
          "pr": 1.93,
          "wr": 48.04,
          "games": 111424,
          "isOffmeta": false
        },
        "Smolder": {
          "pr": 0.55,
          "wr": 46.45,
          "games": 31556,
          "isOffmeta": false
        }
      }
    },
    "ADC": {
      "standard": [
        "Kaisa",
        "Jhin",
        "Jinx",
        "Caitlyn",
        "Ezreal",
        "Yunara",
        "Lucian",
        "Tristana",
        "MissFortune",
        "Xayah",
        "Aphelios",
        "Ashe",
        "Twitch",
        "Zeri",
        "Sivir",
        "Smolder",
        "Kalista",
        "Draven",
        "Samira",
        "Vayne",
        "Varus",
        "KogMaw",
        "Yasuo",
        "Corki",
        "Viktor",
        "Ziggs",
        "Nilah",
        "Veigar",
        "Swain",
        "Hwei",
        "Katarina",
        "Syndra",
        "Lux",
        "Velkoz",
        "Xerath",
        "AurelionSol",
        "Mel",
        "Karthus",
        "Seraphine"
      ],
      "offmeta": [
        "Brand",
        "Vladimir",
        "Senna",
        "Cassiopeia",
        "Malzahar",
        "TwistedFate",
        "TahmKench",
        "Taliyah",
        "Zyra",
        "Heimerdinger",
        "Akshan",
        "Anivia",
        "Aurora"
      ],
      "details": {
        "Jinx": {
          "pr": 14.23,
          "wr": 53.53,
          "games": 822142,
          "isOffmeta": false
        },
        "Karthus": {
          "pr": 0.6,
          "wr": 55.13,
          "games": 34942,
          "isOffmeta": false
        },
        "Kaisa": {
          "pr": 21.42,
          "wr": 51.62,
          "games": 1237408,
          "isOffmeta": false
        },
        "Katarina": {
          "pr": 0.94,
          "wr": 53.25,
          "games": 54085,
          "isOffmeta": false
        },
        "Yasuo": {
          "pr": 2.32,
          "wr": 53.77,
          "games": 133748,
          "isOffmeta": false
        },
        "Tristana": {
          "pr": 8.53,
          "wr": 52.32,
          "games": 492818,
          "isOffmeta": false
        },
        "Xayah": {
          "pr": 7.36,
          "wr": 53.44,
          "games": 425059,
          "isOffmeta": false
        },
        "Hwei": {
          "pr": 0.97,
          "wr": 54.26,
          "games": 55972,
          "isOffmeta": false
        },
        "KogMaw": {
          "pr": 2.38,
          "wr": 54.01,
          "games": 137747,
          "isOffmeta": false
        },
        "Velkoz": {
          "pr": 0.71,
          "wr": 55.09,
          "games": 41287,
          "isOffmeta": false
        },
        "Jhin": {
          "pr": 18.93,
          "wr": 51.54,
          "games": 1093362,
          "isOffmeta": false
        },
        "Zeri": {
          "pr": 4.59,
          "wr": 52.61,
          "games": 265012,
          "isOffmeta": false
        },
        "Nilah": {
          "pr": 1.09,
          "wr": 54.18,
          "games": 62918,
          "isOffmeta": false
        },
        "Swain": {
          "pr": 1.02,
          "wr": 54.34,
          "games": 58924,
          "isOffmeta": false
        },
        "Viktor": {
          "pr": 1.98,
          "wr": 52.6,
          "games": 114158,
          "isOffmeta": false
        },
        "Taliyah": {
          "pr": 0.16,
          "wr": 52.09,
          "games": 9401,
          "isOffmeta": true
        },
        "Yunara": {
          "pr": 9.78,
          "wr": 51.15,
          "games": 565212,
          "isOffmeta": false
        },
        "MissFortune": {
          "pr": 7.66,
          "wr": 52.63,
          "games": 442660,
          "isOffmeta": false
        },
        "Draven": {
          "pr": 4.27,
          "wr": 51.62,
          "games": 246942,
          "isOffmeta": false
        },
        "Syndra": {
          "pr": 0.9,
          "wr": 52.56,
          "games": 51856,
          "isOffmeta": false
        },
        "AurelionSol": {
          "pr": 0.67,
          "wr": 54.07,
          "games": 38454,
          "isOffmeta": false
        },
        "Smolder": {
          "pr": 4.51,
          "wr": 52.19,
          "games": 260765,
          "isOffmeta": false
        },
        "Sivir": {
          "pr": 4.53,
          "wr": 52.7,
          "games": 261900,
          "isOffmeta": false
        },
        "Twitch": {
          "pr": 5.49,
          "wr": 53.12,
          "games": 317393,
          "isOffmeta": false
        },
        "Veigar": {
          "pr": 1.08,
          "wr": 54.52,
          "games": 62652,
          "isOffmeta": false
        },
        "Lux": {
          "pr": 0.8,
          "wr": 53.54,
          "games": 46291,
          "isOffmeta": false
        },
        "Xerath": {
          "pr": 0.7,
          "wr": 53.18,
          "games": 40628,
          "isOffmeta": false
        },
        "Kalista": {
          "pr": 4.42,
          "wr": 50.61,
          "games": 255271,
          "isOffmeta": false
        },
        "Aphelios": {
          "pr": 7.33,
          "wr": 51.29,
          "games": 423261,
          "isOffmeta": false
        },
        "Vladimir": {
          "pr": 0.45,
          "wr": 53.1,
          "games": 25944,
          "isOffmeta": true
        },
        "Ziggs": {
          "pr": 1.61,
          "wr": 52.77,
          "games": 93262,
          "isOffmeta": false
        },
        "Zyra": {
          "pr": 0.13,
          "wr": 52.91,
          "games": 7449,
          "isOffmeta": true
        },
        "Lucian": {
          "pr": 8.72,
          "wr": 50.79,
          "games": 503621,
          "isOffmeta": false
        },
        "Samira": {
          "pr": 3.74,
          "wr": 51.98,
          "games": 216186,
          "isOffmeta": false
        },
        "Caitlyn": {
          "pr": 13.84,
          "wr": 50.7,
          "games": 799368,
          "isOffmeta": false
        },
        "Akshan": {
          "pr": 0.12,
          "wr": 51.21,
          "games": 6764,
          "isOffmeta": true
        },
        "TahmKench": {
          "pr": 0.17,
          "wr": 55.34,
          "games": 9904,
          "isOffmeta": true
        },
        "Senna": {
          "pr": 0.41,
          "wr": 51.95,
          "games": 23411,
          "isOffmeta": true
        },
        "Aurora": {
          "pr": 0.07,
          "wr": 51.78,
          "games": 4301,
          "isOffmeta": true
        },
        "Ashe": {
          "pr": 5.9,
          "wr": 51.7,
          "games": 341063,
          "isOffmeta": false
        },
        "Brand": {
          "pr": 0.49,
          "wr": 53.97,
          "games": 28448,
          "isOffmeta": true
        },
        "Vayne": {
          "pr": 3.58,
          "wr": 51.26,
          "games": 207060,
          "isOffmeta": false
        },
        "Heimerdinger": {
          "pr": 0.13,
          "wr": 53.56,
          "games": 7317,
          "isOffmeta": true
        },
        "Anivia": {
          "pr": 0.08,
          "wr": 51.47,
          "games": 4846,
          "isOffmeta": true
        },
        "Cassiopeia": {
          "pr": 0.27,
          "wr": 50.82,
          "games": 15352,
          "isOffmeta": true
        },
        "Malzahar": {
          "pr": 0.19,
          "wr": 51.96,
          "games": 11030,
          "isOffmeta": true
        },
        "Corki": {
          "pr": 2.31,
          "wr": 50.71,
          "games": 133312,
          "isOffmeta": false
        },
        "Varus": {
          "pr": 3.49,
          "wr": 50.73,
          "games": 201503,
          "isOffmeta": false
        },
        "Ezreal": {
          "pr": 12.56,
          "wr": 47.86,
          "games": 725779,
          "isOffmeta": false
        },
        "Seraphine": {
          "pr": 0.52,
          "wr": 51.13,
          "games": 30260,
          "isOffmeta": false
        },
        "TwistedFate": {
          "pr": 0.18,
          "wr": 49.36,
          "games": 10249,
          "isOffmeta": true
        },
        "Mel": {
          "pr": 0.64,
          "wr": 49.29,
          "games": 36791,
          "isOffmeta": false
        }
      }
    },
    "SUP": {
      "standard": [
        "Thresh",
        "Lulu",
        "Nautilus",
        "Nami",
        "Leona",
        "Blitzcrank",
        "Karma",
        "Milio",
        "Seraphine",
        "Lux",
        "Alistar",
        "Pyke",
        "Senna",
        "Yuumi",
        "Braum",
        "Janna",
        "Soraka",
        "Rakan",
        "Morgana",
        "Bard",
        "Rell",
        "Pantheon",
        "Velkoz",
        "Zilean",
        "Xerath",
        "Swain",
        "Sona",
        "Zyra",
        "Brand",
        "TahmKench",
        "Renata",
        "Neeko",
        "Poppy",
        "Maokai",
        "Taric",
        "Camille",
        "Sylas",
        "Shaco",
        "Zoe",
        "Galio",
        "Leblanc",
        "Elise",
        "Ashe",
        "Shen",
        "Amumu",
        "Hwei",
        "Mel"
      ],
      "offmeta": [
        "Teemo",
        "Fiddlesticks",
        "Anivia",
        "JarvanIV",
        "Veigar",
        "Twitch",
        "Malphite",
        "Zac",
        "MissFortune",
        "Annie",
        "TwistedFate",
        "Sion",
        "Gragas",
        "Nidalee",
        "Lissandra",
        "Syndra",
        "Sett",
        "Skarner",
        "Taliyah",
        "Heimerdinger",
        "Ivern",
        "Nunu",
        "Vi",
        "Rengar",
        "Trundle",
        "Rammus",
        "Ziggs",
        "Kennen",
        "Singed",
        "Sejuani",
        "Vex",
        "Quinn",
        "AurelionSol"
      ],
      "details": {
        "Alistar": {
          "pr": 6.02,
          "wr": 52.84,
          "games": 348080,
          "isOffmeta": false
        },
        "Thresh": {
          "pr": 14.83,
          "wr": 53.36,
          "games": 856853,
          "isOffmeta": false
        },
        "Sona": {
          "pr": 2.68,
          "wr": 52.99,
          "games": 154706,
          "isOffmeta": false
        },
        "Blitzcrank": {
          "pr": 7.49,
          "wr": 53.1,
          "games": 432603,
          "isOffmeta": false
        },
        "Rell": {
          "pr": 3.89,
          "wr": 53.18,
          "games": 224869,
          "isOffmeta": false
        },
        "Leona": {
          "pr": 8.15,
          "wr": 53.74,
          "games": 470860,
          "isOffmeta": false
        },
        "Senna": {
          "pr": 5.55,
          "wr": 53.11,
          "games": 320567,
          "isOffmeta": false
        },
        "Nami": {
          "pr": 8.98,
          "wr": 52.36,
          "games": 518975,
          "isOffmeta": false
        },
        "Galio": {
          "pr": 0.8,
          "wr": 52.25,
          "games": 46480,
          "isOffmeta": false
        },
        "Janna": {
          "pr": 5.11,
          "wr": 52.83,
          "games": 295280,
          "isOffmeta": false
        },
        "Lulu": {
          "pr": 12.33,
          "wr": 51.34,
          "games": 712357,
          "isOffmeta": false
        },
        "Braum": {
          "pr": 5.36,
          "wr": 53.49,
          "games": 309384,
          "isOffmeta": false
        },
        "Rakan": {
          "pr": 4.32,
          "wr": 52.56,
          "games": 249738,
          "isOffmeta": false
        },
        "Zilean": {
          "pr": 2.88,
          "wr": 53.26,
          "games": 166581,
          "isOffmeta": false
        },
        "Lux": {
          "pr": 6.41,
          "wr": 51.59,
          "games": 370094,
          "isOffmeta": false
        },
        "Seraphine": {
          "pr": 6.48,
          "wr": 52.65,
          "games": 374643,
          "isOffmeta": false
        },
        "Velkoz": {
          "pr": 3.07,
          "wr": 52.77,
          "games": 177312,
          "isOffmeta": false
        },
        "Taliyah": {
          "pr": 0.17,
          "wr": 50.96,
          "games": 9685,
          "isOffmeta": true
        },
        "Pyke": {
          "pr": 5.77,
          "wr": 51.05,
          "games": 333486,
          "isOffmeta": false
        },
        "Hwei": {
          "pr": 0.63,
          "wr": 52.08,
          "games": 36350,
          "isOffmeta": false
        },
        "Soraka": {
          "pr": 4.72,
          "wr": 52.44,
          "games": 272443,
          "isOffmeta": false
        },
        "Taric": {
          "pr": 1.24,
          "wr": 53.76,
          "games": 71402,
          "isOffmeta": false
        },
        "Poppy": {
          "pr": 1.66,
          "wr": 52.69,
          "games": 95653,
          "isOffmeta": false
        },
        "Nautilus": {
          "pr": 10.47,
          "wr": 51.08,
          "games": 604756,
          "isOffmeta": false
        },
        "Syndra": {
          "pr": 0.2,
          "wr": 50.8,
          "games": 11310,
          "isOffmeta": true
        },
        "Zyra": {
          "pr": 2.58,
          "wr": 52.28,
          "games": 148942,
          "isOffmeta": false
        },
        "Milio": {
          "pr": 6.56,
          "wr": 52,
          "games": 378806,
          "isOffmeta": false
        },
        "TwistedFate": {
          "pr": 0.24,
          "wr": 50.66,
          "games": 13613,
          "isOffmeta": true
        },
        "Leblanc": {
          "pr": 0.79,
          "wr": 50.7,
          "games": 45748,
          "isOffmeta": false
        },
        "Fiddlesticks": {
          "pr": 0.46,
          "wr": 51.39,
          "games": 26497,
          "isOffmeta": true
        },
        "Amumu": {
          "pr": 0.67,
          "wr": 53.45,
          "games": 38935,
          "isOffmeta": false
        },
        "Swain": {
          "pr": 2.79,
          "wr": 50.59,
          "games": 161421,
          "isOffmeta": false
        },
        "Maokai": {
          "pr": 1.64,
          "wr": 52.58,
          "games": 94501,
          "isOffmeta": false
        },
        "Elise": {
          "pr": 0.76,
          "wr": 51.76,
          "games": 44092,
          "isOffmeta": false
        },
        "Gragas": {
          "pr": 0.22,
          "wr": 50.59,
          "games": 12961,
          "isOffmeta": true
        },
        "Annie": {
          "pr": 0.28,
          "wr": 51.91,
          "games": 16043,
          "isOffmeta": true
        },
        "Morgana": {
          "pr": 4.21,
          "wr": 52.05,
          "games": 243249,
          "isOffmeta": false
        },
        "Anivia": {
          "pr": 0.46,
          "wr": 50.52,
          "games": 26623,
          "isOffmeta": true
        },
        "JarvanIV": {
          "pr": 0.41,
          "wr": 49.87,
          "games": 23516,
          "isOffmeta": true
        },
        "Brand": {
          "pr": 2.32,
          "wr": 51.68,
          "games": 134086,
          "isOffmeta": false
        },
        "Xerath": {
          "pr": 2.8,
          "wr": 50.98,
          "games": 161629,
          "isOffmeta": false
        },
        "TahmKench": {
          "pr": 2.26,
          "wr": 51.63,
          "games": 130683,
          "isOffmeta": false
        },
        "Bard": {
          "pr": 4.2,
          "wr": 50.19,
          "games": 242866,
          "isOffmeta": false
        },
        "Neeko": {
          "pr": 1.69,
          "wr": 50.54,
          "games": 97363,
          "isOffmeta": false
        },
        "Karma": {
          "pr": 7.47,
          "wr": 50.07,
          "games": 431306,
          "isOffmeta": false
        },
        "Nidalee": {
          "pr": 0.21,
          "wr": 49.58,
          "games": 12144,
          "isOffmeta": true
        },
        "Shen": {
          "pr": 0.74,
          "wr": 50.19,
          "games": 42590,
          "isOffmeta": false
        },
        "Lissandra": {
          "pr": 0.21,
          "wr": 49.91,
          "games": 12340,
          "isOffmeta": true
        },
        "Zac": {
          "pr": 0.3,
          "wr": 49.91,
          "games": 17106,
          "isOffmeta": true
        },
        "Ivern": {
          "pr": 0.15,
          "wr": 50.86,
          "games": 8746,
          "isOffmeta": true
        },
        "Sylas": {
          "pr": 1.2,
          "wr": 49.07,
          "games": 69204,
          "isOffmeta": false
        },
        "Renata": {
          "pr": 2.13,
          "wr": 51.39,
          "games": 123253,
          "isOffmeta": false
        },
        "Sion": {
          "pr": 0.24,
          "wr": 49.77,
          "games": 13776,
          "isOffmeta": true
        },
        "Teemo": {
          "pr": 0.48,
          "wr": 51.05,
          "games": 27919,
          "isOffmeta": true
        },
        "Shaco": {
          "pr": 1.15,
          "wr": 49.85,
          "games": 66255,
          "isOffmeta": false
        },
        "Pantheon": {
          "pr": 3.27,
          "wr": 49.9,
          "games": 189187,
          "isOffmeta": false
        },
        "Kennen": {
          "pr": 0.08,
          "wr": 48.49,
          "games": 4869,
          "isOffmeta": true
        },
        "Rengar": {
          "pr": 0.1,
          "wr": 47.53,
          "games": 5691,
          "isOffmeta": true
        },
        "Quinn": {
          "pr": 0.06,
          "wr": 50.34,
          "games": 3216,
          "isOffmeta": true
        },
        "Zoe": {
          "pr": 0.84,
          "wr": 49.3,
          "games": 48488,
          "isOffmeta": false
        },
        "Rammus": {
          "pr": 0.09,
          "wr": 50.86,
          "games": 5028,
          "isOffmeta": true
        },
        "Skarner": {
          "pr": 0.19,
          "wr": 48.71,
          "games": 10693,
          "isOffmeta": true
        },
        "Heimerdinger": {
          "pr": 0.17,
          "wr": 49.63,
          "games": 9821,
          "isOffmeta": true
        },
        "AurelionSol": {
          "pr": 0.06,
          "wr": 48.78,
          "games": 3592,
          "isOffmeta": true
        },
        "Camille": {
          "pr": 1.21,
          "wr": 47.8,
          "games": 69953,
          "isOffmeta": false
        },
        "Yuumi": {
          "pr": 5.51,
          "wr": 49.57,
          "games": 318485,
          "isOffmeta": false
        },
        "Nunu": {
          "pr": 0.12,
          "wr": 47.15,
          "games": 7064,
          "isOffmeta": true
        },
        "Singed": {
          "pr": 0.08,
          "wr": 46.58,
          "games": 4674,
          "isOffmeta": true
        },
        "Trundle": {
          "pr": 0.1,
          "wr": 48.63,
          "games": 5643,
          "isOffmeta": true
        },
        "Sejuani": {
          "pr": 0.07,
          "wr": 48.97,
          "games": 3962,
          "isOffmeta": true
        },
        "Vex": {
          "pr": 0.07,
          "wr": 48.18,
          "games": 4278,
          "isOffmeta": true
        },
        "Twitch": {
          "pr": 0.31,
          "wr": 44.2,
          "games": 18019,
          "isOffmeta": true
        },
        "Veigar": {
          "pr": 0.41,
          "wr": 47.83,
          "games": 23428,
          "isOffmeta": true
        },
        "Sett": {
          "pr": 0.2,
          "wr": 47.1,
          "games": 11619,
          "isOffmeta": true
        },
        "Malphite": {
          "pr": 0.31,
          "wr": 47.89,
          "games": 17708,
          "isOffmeta": true
        },
        "Ziggs": {
          "pr": 0.09,
          "wr": 46.11,
          "games": 5368,
          "isOffmeta": true
        },
        "Vi": {
          "pr": 0.11,
          "wr": 45.35,
          "games": 6500,
          "isOffmeta": true
        },
        "MissFortune": {
          "pr": 0.3,
          "wr": 43.19,
          "games": 17165,
          "isOffmeta": true
        },
        "Ashe": {
          "pr": 0.76,
          "wr": 46.79,
          "games": 43825,
          "isOffmeta": false
        },
        "Mel": {
          "pr": 0.59,
          "wr": 44.95,
          "games": 33868,
          "isOffmeta": false
        }
      }
    }
  }
};
