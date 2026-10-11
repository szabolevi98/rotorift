// A showcase egyetlen nyilvántartása. Új modellhez saját gyártófüggvény és
// status: 'ready' szükséges. A készülő kártyák nem hoznak létre 3D geometriát.
const MODEL_CATALOG = [
  {
    id: 'rift-x5', status: 'ready', name: 'Rift X5', badge: 'X5', category: '5″ freestyle · 6S',
    create: createRiftX5, filename: 'rotorift-rift-x5.glb',
    title: 'Rift', suffix: 'X5.', eyebrow: 'SAJÁT TERVEZÉS · 5″ FREESTYLE',
    tagline: 'Kicsi részletek. Nagy szabadság.', heading: 'Freestyle-ra született.',
    description: 'Karbonváz, háromágú propellerek és minden apró részlet, amit egy FPV gépen keresel.',
    edition: '001 / FREESTYLE', mark: 'R / X5', cameraScale: 1,
    specs: [
      { label: 'Propeller', value: '5″', detail: '/ 3 ág' },
      { label: 'Akkumulátor', value: '6S', detail: '/ 1 300 mAh' },
      { label: 'Motortáv, átló', value: '230', detail: 'mm' },
      { label: 'Karvastagság', value: '5', detail: 'mm' },
    ],
  },
  {
    id:'rift-65', status:'ready', name:'Rift 65', badge:'65', category:'Tinywhoop · 1S',
    create:createRift65, filename:'rotorift-rift-65.glb',
    title:'Rift', suffix:'65.', eyebrow:'SAJÁT TERVEZÉS · 65 MM TINYWHOOP',
    tagline:'Apró gép. Tele részletekkel.', heading:'Könnyűre tervezve.',
    description:'Narancssárga, nyitott váz, áttetsző kameratartó és négy apró motor. Egy tenyérnyi FPV világ.',
    edition:'002 / TINYWHOOP', mark:'R / 65', cameraScale:.29, colorLabel:'Műanyag váz',
    specs:[
      {label:'Propeller',value:'31',detail:'mm / 3 ág'},
      {label:'Akkumulátor',value:'1S',detail:'/ 300 mAh'},
      {label:'Motortáv, átló',value:'65',detail:'mm'},
      {label:'Motor',value:'0702',detail:'/ brushless'},
    ],
  },
  {
    id:'rift-c3',status:'ready',name:'Rift C3',badge:'C3',category:'3″ cinewhoop · 4S',
    create:createRiftC3,filename:'rotorift-rift-c3.glb',
    title:'Rift',suffix:'C3.',eyebrow:'SAJÁT MODELL · 3″ CINEWHOOP',
    tagline:'Közel a témához. Szabadon a levegőben.',heading:'Filmezésre hangolva.',
    description:'Karbonváz, összekötött propellervédők és alul forgó propellerek. Felül egy könnyített akciókamera és a 4S akku.',
    edition:'003 / CINEWHOOP',mark:'R / C3',cameraScale:.65,colorLabel:'Védőkeret és tartók',
    specs:[
      {label:'Propeller',value:'3″',detail:'/ 76 mm · 3 ág'},
      {label:'Akkumulátor',value:'4S',detail:'/ 720 mAh'},
      {label:'Motortáv, átló',value:'128',detail:'mm'},
      {label:'Motor',value:'1404',detail:'/ fordított beépítés'},
    ],
  },
];
