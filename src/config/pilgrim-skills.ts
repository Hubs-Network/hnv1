/**
 * PilgrimPassportSBT — canonical skill IDs and their on-chain bytes32 hashes.
 *
 * Single source of truth for the skill taxonomy stored on-chain.
 * - On-chain we store ONLY the keccak256(toBytes(skillId)) hashes, never labels.
 * - Each hash is computed as keccak256(toBytes(skillId)) (ethers: keccak256(toUtf8Bytes(skillId))).
 * - Human-readable labels/categories live in the frontend, not here.
 *
 * The literal hashes below were generated with viem and verified by
 * scripts/prepare-pilgrim-passport-deploy.ts. Do not edit them by hand.
 */

export const PILGRIM_SKILL_IDS = [
  "software_development",
  "frontend_development",
  "backend_development",
  "mobile_app_development",
  "smart_contracts",
  "blockchain_infrastructure",
  "web3_integrations",
  "ai_ml",
  "data_analysis",
  "cybersecurity",
  "devops",
  "hardware_hacking",
  "electronics",
  "iot",
  "fabrication_maker_skills",
  "product_design",
  "ui_ux",
  "service_design",
  "interaction_design",
  "prototyping",
  "design_research",
  "accessibility_design",
  "no_code_low_code",
  "music",
  "sound_design",
  "audiovisual_production",
  "video_art",
  "photography",
  "digital_art",
  "installations",
  "painting_drawing",
  "sculpture",
  "performance",
  "dance",
  "theatre",
  "writing_journalism",
  "storytelling",
  "cultural_programming",
  "community_organizing",
  "coordination",
  "team_facilitation",
  "trust_building",
  "governance_facilitation",
  "dao_operations",
  "conflict_mediation",
  "public_speaking",
  "workshop_facilitation",
  "event_hosting",
  "onboarding_mentoring",
  "business_development",
  "strategy",
  "finance_accounting",
  "fundraising",
  "grant_writing",
  "tokenomics",
  "impact_measurement",
  "legal_policy",
  "partnerships",
  "communications",
  "marketing",
  "regenerative_practices",
  "permaculture",
  "circular_economy",
  "ecological_design",
  "energy_systems",
  "waste_reduction",
  "water_systems",
  "environmental_monitoring",
  "climate_adaptation",
  "low_tech_solutions",
  "traditional_agriculture",
  "urban_farming",
  "beekeeping",
  "food_preservation",
  "cooking",
  "fermentation",
  "agroecology",
  "soil_regeneration",
  "seed_saving",
  "wellness_practices",
  "massage",
  "psychotherapy",
  "coaching",
  "martial_arts",
  "self_defense",
  "bodywork",
  "meditation",
  "group_care",
  "trauma_informed_facilitation",
  "education",
  "curriculum_design",
  "research",
  "documentation",
  "knowledge_management",
  "translation",
  "scientific_communication",
  "peer_learning_facilitation",
  "field_research",
  "event_production",
  "logistics",
  "space_management",
  "residency_hosting",
  "guest_care",
  "procurement",
  "budgeting",
  "safety_coordination",
  "food_beverage_coordination",
  "travel_coordination",
] as const;

export type PilgrimSkillId = (typeof PILGRIM_SKILL_IDS)[number];

/**
 * keccak256(toBytes(skillId)) for every canonical skill ID.
 * These are the exact bytes32 values used on-chain.
 */
export const PILGRIM_SKILL_HASHES: Record<PilgrimSkillId, `0x${string}`> = {
  software_development:
    "0x0fc064857f27eb4a3ff8cfd1f3fc0d6e3914a44d1e0bca3e2133c3eca4894c32",
  frontend_development:
    "0xef15bfa738056d029f1181a2cd1bcb5e1af65d255a4d2b1017f329d608b37f12",
  backend_development:
    "0xa887deb381b8a7c2b5f8c9846df811fb3dc9b38e06ba112e571bbc72567ac6a0",
  mobile_app_development:
    "0x3fca0767ea0f28807485e2be1b92ea166faa281f7248c2b60fc7918e02dc271e",
  smart_contracts:
    "0x3e057b435e3fd937d798f00d23adf9d2de5ca852ded86efcdaca03def06ecadf",
  blockchain_infrastructure:
    "0x3463016c017ca4067247d433ea93e6234fc9947b72f5b598664ce079efb406b1",
  web3_integrations:
    "0x5e7514b3908a23853d09c3bf739d9ccbe05f755dd49343c135220828c2e9a036",
  ai_ml: "0x8ec7873f9de255c4d2275013fc85fc3c2378b1c521f0a227587ae0d033c9f4d0",
  data_analysis:
    "0xcf27f80e4e4f0c6f4a9f6a78cfee4cf2817ddea0e910219f987cdd80cd812786",
  cybersecurity:
    "0x74a3cd09ec36a36b133c2770ee67c2995d296bc7279dd17b5a85dafba97a914a",
  devops: "0x542dbd1ee0797f5d4caf8465daad1ddae85b80f7f70acb0f3c17bc6e0de6648d",
  hardware_hacking:
    "0xc58b8aa138a16568c78edcd0313ebf6bff2e8dcedb8d17bec84ec551b47c77d0",
  electronics:
    "0xec71df9a7a3797d3cccf645cac6faedb9432a98db346f8dd0d02d7bacd322d52",
  iot: "0x7fb8bbb419454d6c0c5e17e942b33b29c13f1adfc4836d269058f3f4c384df12",
  fabrication_maker_skills:
    "0xcffabd403f9ccec718a03776b56d162d04280bdbacfb59c204cf4f545f663196",
  product_design:
    "0x0750a72b87bcb99f18e4543a040ef4fbb5260b65a3effea124d72cc25bcff73b",
  ui_ux: "0x7d9b1f878a615785e5b637cf00e3b13f4bc5e58e13086351a585c5785c32f814",
  service_design:
    "0xeab7b0ef1ad12d58d2dc67f85625779c925be7031dfbdd8c686053e5eec44c80",
  interaction_design:
    "0xc6a44f368acdb0cfda9ef1b5509927ae624f16073c31f864d118f15c9bffe16b",
  prototyping:
    "0x95555ca9abde03f460aaaf57b4286ab93e2f6c360ae335ad74be500a7840728c",
  design_research:
    "0x5e013deec6de6bcfc0570b716f2d2f753c32068c0b48c9b91fe2663e9ff6dac2",
  accessibility_design:
    "0xab28ec736d6a9573d26ac54bcf4041c5d6da197ebc4843be1195822a8f460b59",
  no_code_low_code:
    "0x8de0a0fa6516411e6c330aa52b95689ba517c90f8f2660ab6c128b00e8450928",
  music: "0x24a84ec3e1702f9fb895ad84da713c835a201800011b2169605e1b4a76225ab9",
  sound_design:
    "0x87ce515327bde010cbf2622c6c48c9c82ffcfee83ce55a57d16eab5e00a39dc4",
  audiovisual_production:
    "0x4b3b454f9b60aa5f35057b96182657ee1a1eb6cf63f0a3208d3443c236812cfa",
  video_art:
    "0x6b5fa8b3a8c9214468c4da636dfeb580ff1de51df91f42b63527453cf8690fd0",
  photography:
    "0x213eb6038df47d6b4f158741452839821527d702845feebeef4e2dd724293664",
  digital_art:
    "0x0e428e6e556257a9ffc1239544d66e57878a4178541dca77e114c9c4b66b5e87",
  installations:
    "0xe60a3a49f4b1588fb9888233212b9edb67f6adc479cc7eac04a59afa8bd97210",
  painting_drawing:
    "0xa37e91ee5ab7d388a0b29f516e7a8dd2288d5e59e3caa4e7adca22d92071563e",
  sculpture:
    "0x5c518eb461c8d929a518d52b55a05198d879d59375bad96e65d0dda2e914c071",
  performance:
    "0xe63dc98f63bbf2edc84c5e4d00d9715224fade099eb1d37bef0be5478952ea35",
  dance: "0xba9cca537a043833293338a137c18618572065222ccc3d874ae0440b4021dfcb",
  theatre: "0x626a2098d80a8b94134fda2feb7ebd4b425c5342a73edbe0215d7e8ca76d9c9e",
  writing_journalism:
    "0xb137076598417b1e3c914f71a654aa8bb132013fc63a43b11d4fbd3c6a3febea",
  storytelling:
    "0xb57cecf51c8ae7316d839a29f81a3bd31eff175d721ec8f2fd2b4643e29ffe95",
  cultural_programming:
    "0x3d57b5f3e8fb5fa2eddefbae9c0125f54e9acc9cbe23e513542f0bc1d4c89ec0",
  community_organizing:
    "0x439087dee340cec0841ce0093c7f7667d9c91724c984f0c391f6ba7b59fb3608",
  coordination:
    "0x57135373cb746a08415e737e4a8e3b106be080bc0c5a8bbc778254c7212b0424",
  team_facilitation:
    "0xdaffbb67c7e40eb60d0a770c72752d6681adc9cc840b44f4895fc67dddf8b3b6",
  trust_building:
    "0xd754e23e7abb67d0ad784d8f44fd8eba613aedb5dde4aa977fa1bdbe457c3c49",
  governance_facilitation:
    "0xd8b202516afe5bd879a21977f3fa14d9910f61258a1111320d774ecfc963bc5a",
  dao_operations:
    "0x6eeeca8df2d541d4228fa17f87bc7691a925c54f25d5065f1a0bbd2d3118441f",
  conflict_mediation:
    "0xea0cb02f592c526b10b42ca67fd68b97f84d73983375caf20ecaca99ba61d3af",
  public_speaking:
    "0xe7141ad652f1423edcfc7a7b0101d93f5244509a4add3db605a37d39e175ba9b",
  workshop_facilitation:
    "0xfaa03c8b7f8996f48b75f2a47bfa869166dce8fda9fce991099757b6acaabdf6",
  event_hosting:
    "0x0c4dcf680f4ec6c3bc3b2c510a7bfbb916e7b2bd253e52cc440f5c44051b9735",
  onboarding_mentoring:
    "0x43b9e910ade246f8310f179fea8672eb45d22139c57b3c8311592f59943d245f",
  business_development:
    "0xddf367e98d831d621f8d6a99849d81f2f7b4957c1978e709b387950f4cc28da7",
  strategy: "0xe16920893711b985df3893d85b39127b3a481e91c3c57640cd8970c06e9e6007",
  finance_accounting:
    "0xb97fdc2a75fda6c9da68ecd171a4acc3155ca5dec23169f23d6af8f6bfb758b5",
  fundraising:
    "0xd6b34db9a6593742ce9879506f114120c04df3d262d4b862fd840ab4b772e17e",
  grant_writing:
    "0xdc8f1ec2b074bf8c9fa3a3c8170b79b25bfaf29a29e0ea29f464a1e206480eaa",
  tokenomics:
    "0xb383a91dd7a6057ccfe8ef47dc812f7b9010318e237905ea6da7ef0001c89510",
  impact_measurement:
    "0xf02b77919316b0cc9bdb4cbf773b336538fc6bdbe069c900f617e1d71fd36ab5",
  legal_policy:
    "0xa2997aa5af01ae0b784440845e1943a5af863afa2f81906656fc09342d23b1f7",
  partnerships:
    "0xa5005f1a2097af64be037a1b348941f78c642393a235701ed7c2906ea7669bd1",
  communications:
    "0xc61d029d37a1904103e4ea9e894d9daf044034682147594bd3cd10fe4ff599dd",
  marketing:
    "0x480d3dacbe70ae0541e56579fab062a46bee6f5728375bd8a481f9f9e71bafdb",
  regenerative_practices:
    "0xb028bed73a2ce5c327491fe67f6e28cad19466ab7c8c7790b464089f3d760f9b",
  permaculture:
    "0x1143050312200a828b82367e06ededd2f03f345cae13e10bfe9a909e5ba2efda",
  circular_economy:
    "0x1c96804ba6e96e4695bcbe37c3112054d0f984e0881e44a0472e4ceee30af5e0",
  ecological_design:
    "0x67685a6edc7affe290b47bc087f72511b931cd903df6fb0e0903ee78be69bccf",
  energy_systems:
    "0xe7577244f306fd4bd0d933477a356607d9c3e0306a2da98e2646b811e2423b96",
  waste_reduction:
    "0xeee99679ef1175534c453400c52b4a360850118831731ecd5d133eb46ac6791d",
  water_systems:
    "0x45012a46fb513ce79bcf01fb1ff3edc6485f0034c296dd90cda156ede1acaf8e",
  environmental_monitoring:
    "0x7889fc53e447785e2e366f51414c2a2a942fa64e71c7dea7af256d1731684005",
  climate_adaptation:
    "0x9b89b70148e86cddbc8a7703f4c106de8e2eddea26b043a9fd892e1843e07255",
  low_tech_solutions:
    "0x2f036d8b1cd79e8bd1b0d34e0f03e822de6052960fb80df13452af19f80b215b",
  traditional_agriculture:
    "0xdf096ead7115bbc8c5c8c5b6e3c32949f11463b1f023efa0dea5edd784616fbc",
  urban_farming:
    "0x90baaeb3917246b05553967a1313dfd5d5b37d9165f21b4c6c97e4edd0c0c559",
  beekeeping:
    "0x6197d7fe23d6cdbe7bde3ebd1943ffac4da41553f45173a27b08c8105a149e19",
  food_preservation:
    "0xde96932a0e712474e02f1211cb5f937be9ca2e0777c4a3176b26d55c6cc3f0d6",
  cooking: "0xf9bda4f786c21e0b2faa530dad78accd90df321c5af2676c34e23d7c70d65324",
  fermentation:
    "0x9e7bff2e080a017f9c77fc86c126c8e6645969afe855ec96d7dcbb6bbdfe923e",
  agroecology:
    "0x84d765eef3e21b1175186d336d0f1fd698ce6d34d77fd3b03aeebc16b8a01a28",
  soil_regeneration:
    "0x7aeeaea6d128490e029f5fc55c24325dbac48f621eac9cb4ad00e99b403c1e08",
  seed_saving:
    "0x71ac16a7a5c26aab91a93690adbecab4d89c036056e2219b2439fdc1a421e48c",
  wellness_practices:
    "0x4412b409beaa5cd36817dfbadfced9093a8fa44309dc51ec84f61b6f38f4dc46",
  massage: "0x8e41d856f158a7754407ab57c85adb6b013e97f39757d7d45dd9e4c0843dc553",
  psychotherapy:
    "0x9251a47096c31ea399d9ac0c52b59a7d360174666f3d5ecb359eb9772c863cb3",
  coaching: "0xbf8920744f6f93e38e755ae0f3d7858fdd524269d0685f893296c403dff53556",
  martial_arts:
    "0x5fd8c52bde1dda051d55f05b64416069af7fe1b0a126f68ddc8743d74517ca0a",
  self_defense:
    "0x38e50a1811f258099ecb06902d27277c6181d98c5526697e85566d466817a1d4",
  bodywork: "0xddff091b0f99e7fce7b63d701978b138717aa3593d7bd873ab6c008678b1d95c",
  meditation:
    "0x233a94361a147c23d31cf41fca577cdf97d0fc6fb4f2f6f7e52d04a318683d67",
  group_care:
    "0x2aead454325c7ca2244e690e1b9f68e32a1283f35befdd4d31da2e30a844a308",
  trauma_informed_facilitation:
    "0x2967d918c7354a7d01280dc8271ec4feb7660129ae6b1e5b5ac2c4bf990300ad",
  education: "0x033d214a7c63ad0ebd322697d0ae9662f548cb21a426f70f837bd9e1b007ef08",
  curriculum_design:
    "0x66576a783e2d84b933da73dc4f43b1cf5df2ea25a9d3b66c5a75a1f34252f7c4",
  research: "0x95f7801c97b17401c2c5a5b8fdb4f956cc377f647e35794f5b5da6aed60cd40d",
  documentation:
    "0x9ee1c1c4eeb5702dd73035f84a5356f622c79db00e6182c3e45c2c225f86b5b0",
  knowledge_management:
    "0x0c4f95f1a121cb0b671ecb6c856726861ec4d8eda72644a5e12b6474b422683e",
  translation:
    "0xd3d9c5a1a300197017336746fd151d5b12bec65c878b0b75ac745337145036bd",
  scientific_communication:
    "0x785ac277706fcd9786fddbc79d1a39ef72836cea7ba25f91176414646f7945ed",
  peer_learning_facilitation:
    "0xa393def7f7f400d26f2547b429cc354e6a14264da178e8c2888f81e6fe66b379",
  field_research:
    "0x3aa3a4e5a63b1828911b1dae035caf4094f338845871bfb860ed8ab0d3eba1c4",
  event_production:
    "0x879c32316c6fc5aec0f6e47e0184ead0b546a76f50e3ac081061fe6270e789d3",
  logistics:
    "0x245783adc81f6e95516119962ed20268fd5fb5ea2e249016df70dcce5b300693",
  space_management:
    "0xb030e6e82db27a8d55a0689ebddf52817dbf94893acf1038891478dee0e003cd",
  residency_hosting:
    "0x26dffb98b62e863b202da5d9f5b8a062bf2d09922564a7e09f9b00234443a073",
  guest_care:
    "0x238ac630f6b02d46f2d5ffce6d051cf9cf479d742c57ee7f2634fa730e92fd08",
  procurement:
    "0x67a6b2478dfda59bcf959a89e16e2af4c17b5f3c5683767d3d53dd9fc88c4890",
  budgeting: "0x6d3f4597b7baabe289f807bfc1fd5b2c2346e88d024224df92d5257eaafe7bcc",
  safety_coordination:
    "0x0c8bf9a4e271a7f5ba1d4c562da9de992b5e6d39b947099be09ad92cea9a7a21",
  food_beverage_coordination:
    "0x420a76750e54a0bad371d2ae7f34f2d973bd0184ebb81929657dbe33084c8afb",
  travel_coordination:
    "0x7679671d60c79843e6c2a82c4b17e877a0b2315762495d2d3cf1f9d795ea60c6",
};

/**
 * The initialSkills bytes32[] for the PilgrimPassportSBT constructor,
 * in the canonical PILGRIM_SKILL_IDS order.
 */
export const INITIAL_PILGRIM_SKILL_HASHES: readonly `0x${string}`[] =
  PILGRIM_SKILL_IDS.map((id) => PILGRIM_SKILL_HASHES[id]);
