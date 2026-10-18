export type TipCard = {
  title: string
  body: string
  items?: string[]
}

export const FOOD_TIPS: TipCard[] = [
  {
    title: "Protein dalam sukatan",
    body: "Dialisis membuang sebahagian protein. Pilih protein yang mudah diawasi, dan ikut sukatan yang centre berikan.",
    items: [
      "Telur, ayam tanpa kulit, ikan putih seperti siakap, selar, atau kembung",
      "Tauhu dan tempe dalam sukatan kecil, bukan sebagai lauk besar setiap hari",
      "Elak daging organ, daging proses, dan sosej sebagai protein harian",
    ],
  },
  {
    title: "Nasi dan makanan ruji",
    body: "Nasi putih dalam pinggan yang diukur biasanya lebih mudah dikawal daripada nasi perang, kerana nasi perang mengandungi lebih banyak kalium dan fosfat.",
    items: [
      "Ukur nasi, bihun, dan mee, bukan tambah sesuka hati",
      "Roti putih biasa lebih mudah diurus daripada roti penuh bijirin",
      "Kuih yang masin, bergaram, atau bersantan pekat sebaiknya jarang",
    ],
  },
  {
    title: "Buah dan sayur yang lebih mudah",
    body: "Rebus sayur dan buang air rebusan pertama. Ini mengurangkan kalium berbanding sayur goreng dengan kicap atau dimakan mentah dalam jumlah besar.",
    items: [
      "Epal, pir, anggur beberapa biji, limau, dan betik dalam hirisan kecil",
      "Timun, kubis, bendi, labu, dan taugeh",
      "Kentang: potong, rendam, kemudian rebus dan buang airnya",
    ],
  },
  {
    title: "Hadkan kalium",
    body: "Kalium tinggi boleh menjejaskan denyutan jantung. Jangan ganti nasihat makmal centre dengan senarai ini.",
    items: [
      "Pisang, durian, nangka, kiwi, dan oren dalam jumlah besar",
      "Bayam, pucuk ubi, dan sayur hijau yang dimasak banyak",
      "Santan pekat, air kelapa, dan jus buah",
    ],
  },
  {
    title: "Hadkan fosfat",
    body: "Fosfat yang tersembunyi sering datang dari makanan proses, bukan hanya dari susu.",
    items: [
      "Susu, keju, yogurt, dan minuman malt",
      "Kacang, biji, dan daging organ",
      "Minuman kola, makanan segera, dan produk dengan bahan tambahan fosfat",
      "Makan ubat pengikat fosfat bersama makanan jika doktor menetapkannya",
    ],
  },
  {
    title: "Garam dan cecair",
    body: "Garis panduan cecair berbeza jika pesakit masih ada air kencing. Ikut had yang ditulis centre, bukan anggaran sendiri.",
    items: [
      "Kurangkan kicap, sos tiram, belacan, kiub perasa, dan mee segera",
      "Ikan masin, telur masin, dan keropok menambah garam dengan cepat",
      "Guna bawang putih, halia, serai, dan limau untuk rasa",
      "Kira air minum, ais, sup, kuah, dan bubur sebagai cecair",
    ],
  },
  {
    title: "Belimbing tidak selamat",
    body: "Belimbing boleh menyebabkan kekeliruan, sawan, dan kecemasan pada pesakit buah pinggang, termasuk pesakit dialisis. Elak belimbing dan jus belimbing sepenuhnya.",
  },
]

export const CARE_TIPS: Record<"fistula" | "graft" | "kateter" | "kecemasan", TipCard[]> = {
  fistula: [
    {
      title: "Periksa getaran setiap hari",
      body: "Letak dua jari di atas fistula. Getaran halus, atau thrill, patut ada. Jika getaran hilang atau berubah mendadak, hubungi centre hari yang sama.",
    },
    {
      title: "Lindungi lengan fistula",
      body: "Lengan ini ialah laluan darah untuk dialisis. Elak kecederaan dan tekanan.",
      items: [
        "Jangan ambil tekanan darah, cucuk darah, atau pasang drip pada lengan itu",
        "Jangan pakai baju ketat, jam, atau gelang",
        "Jangan tidur menindih lengan fistula",
        "Jangan angkat barang berat selepas cucukan",
      ],
    },
    {
      title: "Kebersihan dan tapak cucuk",
      body: "Basuh lengan dengan sabun sebelum sesi. Jururawat akan putar tapak cucuk. Jangan cucuk sendiri atau buka kudis di rumah.",
      items: [
        "Tekan tapak selepas jarum dicabut mengikut cara yang diajar",
        "Jangan intip berkali-kali semasa menekan, kerana bekuan mudah tertanggal",
        "Kekalkan kulit bersih dan kering",
      ],
    },
  ],
  graft: [
    {
      title: "Graft perlukan jagaan yang sama, dengan lebih waspada pada jangkitan",
      body: "Graft ialah salur sintetik di bawah kulit. Getaran tetap perlu diperiksa setiap hari.",
      items: [
        "Jangan ambil darah atau tekanan darah pada lengan graft",
        "Perhatikan merah, bengkak, panas, atau nanah di sepanjang graft",
        "Demam selepas dialisis perlu dimaklumkan kepada centre",
        "Elak tekanan dan pakaian ketat pada anggota yang ada graft",
      ],
    },
  ],
  kateter: [
    {
      title: "Balutan kekal kering",
      body: "Kateter terowong masuk terus ke salur darah. Jangkitan di sini boleh menjadi kecemasan.",
      items: [
        "Jangan basahkan balutan. Mandi dengan lap, atau tutup kedap jika centre membenarkan",
        "Jangan tarik, pusing, atau buka penutup kateter",
        "Jangan gunakan gunting dekat tiub",
        "Minta centre menukar balutan jika ia basah, longgar, atau kotor",
      ],
    },
    {
      title: "Perhatikan tanda jangkitan",
      body: "Hubungi centre dengan segera, atau pergi ke kecemasan, jika ada demam, menggigil, merah di sekitar kateter, atau nanah.",
    },
  ],
  kecemasan: [
    {
      title: "Pergi ke kecemasan",
      body: "Jangan tunggu sesi dialisis seterusnya jika tanda ini muncul.",
      items: [
        "Pendarahan tapak fistula yang tidak berhenti walaupun ditekan dengan kuat",
        "Fistula atau graft tiada getaran",
        "Sesak nafas, dada sakit, atau bengkak paru-paru yang mendadak",
        "Kalium tinggi yang disertai lemah otot, denyutan tidak teratur, atau centre mengarahkan rawatan segera",
        "Demam dan menggigil, terutamanya jika ada kateter",
        "Pengsan, kekeliruan, atau sawan",
      ],
    },
  ],
}
