const CONTACT_STATES = [
  {
    name: "Arunachal Pradesh",
    districts: "Anjaw|Bichom|Changlang|Dibang Valley|East Kameng|East Siang|Itanagar Capital Region|Kamle|Keyi Panyor|Kra Daadi|Kurung Kumey|Lepa Rada|Lohit|Longding|Lower Dibang Valley|Lower Siang|Lower Subansiri|Namsai|Pakke Kessang|Papum Pare|Shi Yomi|Siang|Tawang|Tirap|Upper Siang|Upper Subansiri|West Kameng|West Siang"
  },
  {
    name: "Assam",
    districts: "Bajali|Baksa|Barpeta|Biswanath|Bongaigaon|Cachar|Charaideo|Chirang|Darrang|Dhemaji|Dhubri|Dibrugarh|Dima Hasao|Goalpara|Golaghat|Hailakandi|Hojai|Jorhat|Kamrup|Kamrup Metropolitan|Karbi Anglong|Kokrajhar|Lakhimpur|Majuli|Morigaon|Nagaon|Nalbari|Sivasagar|Sonitpur|South Salmara-Mankachar|Sribhumi|Tamulpur|Tinsukia|Udalguri|West Karbi Anglong"
  },
  {
    name: "Manipur",
    districts: "Bishnupur|Chandel|Churachandpur|Imphal East|Imphal West|Jiribam|Kakching|Kamjong|Kangpokpi|Noney|Pherzawl|Senapati|Tamenglong|Tengnoupal|Thoubal|Ukhrul"
  },
  {
    name: "Meghalaya",
    districts: "East Garo Hills|East Jaintia Hills|East Khasi Hills|Eastern West Khasi Hills|North Garo Hills|Ri-Bhoi|South Garo Hills|South West Garo Hills|South West Khasi Hills|West Garo Hills|West Jaintia Hills|West Khasi Hills"
  },
  {
    name: "Mizoram",
    districts: "Aizawl|Champhai|Hnahthial|Khawzawl|Kolasib|Lawngtlai|Lunglei|Mamit|Saiha|Saitual|Serchhip"
  },
  {
    name: "Nagaland",
    districts: "Chumoukedima|Dimapur|Kiphire|Kohima|Longleng|Meluri|Mokokchung|Mon|Niuland|Noklak|Peren|Phek|Shamator|Tseminyu|Tuensang|Wokha|Zunheboto"
  },
  {
    name: "Sikkim",
    districts: "Gangtok|Gyalshing|Mangan|Namchi|Pakyong|Soreng"
  },
  {
    name: "Tripura",
    districts: "Dhalai|Gomati|Khowai|North Tripura|Sepahijala|South Tripura|Unakoti|West Tripura"
  }
];

const FIRE_CONTACTS = {
  Assam: {
    stateControlRoom: {
      label: "Fire & Emergency Services control room",
      coverage: "State headquarters · Guwahati",
      description: "Published Assam Fire and Emergency Services headquarters control-room lines. These are state-level numbers, not district-station direct lines.",
      numbers: [
        ["101", "Fire & Emergency · 101"],
        ["0361-2737680", "0361 273 7680"],
        ["0361-2735933", "0361 273 5933"],
        ["0361-2735935", "0361 273 5935"],
        ["0361-2801900", "0361 280 1900"],
        ["0361-2734191", "0361 273 4191"]
      ],
      source: "https://fireandemergencyservices.assam.gov.in/contact-us",
      sourceLabel: "Assam Fire & Emergency Services · official contact page"
    }
  },
  Meghalaya: {
    stationContactSource: {
      source: "https://megfireservice.gov.in/keycontacts.html",
      sourceLabel: "Meghalaya Fire & Emergency Services · official fire-station contacts"
    },
    districtStations: {
      "East Khasi Hills": [
        { name: "Shillong Fire Station", numbers: [["9863324602", "Mobile · 98633 24602"], ["8575415433", "Mobile · 85754 15433"]] },
        { name: "Barabazar Fire Station", numbers: [["0364-2222000", "Office · 0364 222 2000"], ["9366268946", "Mobile · 93662 68946"], ["7085062258", "Mobile · 70850 62258"]] },
        { name: "Mawlai Fire Station", numbers: [["8787775132", "Mobile · 87877 75132"]] },
        { name: "Upper Shillong Fire Station", numbers: [["9862615157", "Mobile · 98626 15157"]] },
        { name: "Sohra Fire Station", numbers: [["9615609635", "Mobile · 96156 09635"], ["9362317100", "Mobile · 93623 17100"]] },
        { name: "Raj Bhavan Fire Station", numbers: [["0364-2500192", "Office · 0364 250 0192"], ["9402532935", "Mobile · 94025 32935"]] }
      ],
      "West Khasi Hills": [
        { name: "Nongstoin Fire Station", numbers: [["9862755909", "Mobile · 98627 55909"], ["8794321747", "Mobile · 87943 21747"]] },
        { name: "Sonapahar Fire Station", numbers: [["9362800613", "Mobile · 93628 00613"], ["8787516158", "Mobile · 87875 16158"]] }
      ],
      "Eastern West Khasi Hills": [
        { name: "Mairang Fire Station", numbers: [["6009088967", "Mobile · 60090 88967"], ["9436179565", "Mobile · 94361 79565"]] }
      ],
      "South West Khasi Hills": [
        { name: "Mawkyrwat Fire Station", numbers: [["9366648736", "Mobile · 93666 48736"]] }
      ],
      "West Jaintia Hills": [
        { name: "Jowai Fire Station", numbers: [["8709647849", "Mobile · 87096 47849"]] },
        { name: "Amlarem Fire Station", numbers: [["9366374183", "Mobile · 93663 74183"], ["8732841517", "Mobile · 87328 41517"]] },
        { name: "Dawki Fire Station", numbers: [["7642842129", "Mobile · 76428 42129"]] },
        { name: "Garampani Fire Station", numbers: [["8837422805", "Mobile · 88374 22805"], ["8414803602", "Mobile · 84148 03602"]] }
      ],
      "East Jaintia Hills": [
        { name: "Ladrymbai Fire Station", numbers: [["03655-220030", "Office · 03655 220030"], ["8840798138", "Mobile · 88407 98138"]] }
      ],
      "Ri-Bhoi": [
        { name: "Nongpoh Fire Station", numbers: [["8794737885", "Mobile · 87947 37885"]] },
        { name: "Umiam Fire Station", numbers: [["8837286445", "Mobile · 88372 86445"]] },
        { name: "Byrnihat Fire Station", numbers: [["9856621920", "Mobile · 98566 21920"]] }
      ],
      "West Garo Hills": [
        { name: "Tura Fire Station", numbers: [["7630008928", "Mobile · 76300 08928"], ["9436331366", "Mobile · 94363 31366"]] },
        { name: "Dalu Fire Station", numbers: [["8837422154", "Mobile · 88374 22154"]] },
        { name: "Dadenggre Fire Station", numbers: [["8414848755", "Mobile · 84148 48755"]] },
        { name: "Phulbari Fire Station", numbers: [["7628070744", "Mobile · 76280 70744"]] },
        { name: "Tikrikilla Fire Station", numbers: [["9366316186", "Mobile · 93663 16186"]] },
        { name: "Rongram Fire Station", numbers: [["7005163887", "Mobile · 70051 63887"]] },
        { name: "Garobadha Fire Station", numbers: [["8014980586", "Mobile · 80149 80586"]] }
      ],
      "South West Garo Hills": [
        { name: "Ampati Fire Station", numbers: [["9612361180", "Mobile · 96123 61180"]] },
        { name: "Mahendraganj Fire Station", numbers: [["7005953019", "Mobile · 70059 53019"]] }
      ],
      "North Garo Hills": [
        { name: "Mendipathar Fire Station", numbers: [["8787347259", "Mobile · 87873 47259"], ["9402501645", "Mobile · 94025 01645"]] }
      ],
      "South Garo Hills": [
        { name: "Baghmara Fire Station", numbers: [["8132917380", "Mobile · 81329 17380"]] },
        { name: "Nangalbibra Fire Station", numbers: [["8414090559", "Mobile · 84140 90559"]] }
      ],
      "East Garo Hills": [
        { name: "Williamnagar Fire Station", numbers: [["7005775794", "Mobile · 70057 75794"]] },
        { name: "Rongjeng Fire Station", numbers: [["9436718142", "Mobile · 94367 18142"], ["6009505182", "Mobile · 60095 05182"]] }
      ]
    },
    regionalControlRooms: [
      {
        districts: [
          "East Khasi Hills",
          "West Khasi Hills",
          "Eastern West Khasi Hills",
          "South West Khasi Hills",
          "West Jaintia Hills",
          "East Jaintia Hills",
          "Ri-Bhoi"
        ],
        label: "Eastern Range Fire Control Room",
        coverage: "Khasi–Jaintia Hills · control room at Shillong Fire Station",
        description: "The official service page identifies this as the 24×7 control room for the Eastern Range. It relays incidents to the nearest station; these are regional control-room lines, not unique direct numbers for each station.",
        numbers: [
          ["9436721546", "94367 21546"],
          ["8575205486", "85752 05486"],
          ["0364-2520400", "0364 252 0400"],
          ["0364-2520004", "0364 252 0004"],
          ["0364-2215777", "EPBX · 0364 221 5777"]
        ],
        source: "https://megfireservice.gov.in/firecontrolroom.html",
        sourceLabel: "Meghalaya Fire & Emergency Services · fire control room"
      }
    ],
    stateOffice: {
      label: "Fire & Emergency Services headquarters",
      coverage: "State headquarters · Shillong · office hours only",
      description: "Published headquarters office contact, not a fire dispatch or district-station line. For emergencies, call 112 or the applicable control room.",
      numbers: [["9485178896", "Office · 94851 78896"]],
      source: "https://megfireservice.gov.in/contact_us.html",
      sourceLabel: "Meghalaya Fire & Emergency Services · contact page"
    },
    stationDirectory: {
      source: "https://megfireservice.gov.in/fire_stations.html",
      sourceLabel: "Meghalaya Fire & Emergency Services · stations by district"
    }
  }
};
