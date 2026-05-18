// Mock data — items, orders, branches
const ITEMS = [
  { code: '30161803SD06307', name: 'Slide N Store Compact Plus Shellwine Red', cat: 'Storage', cpl: 37616, stock: [{b:'KB', q:3}, {b:'B2CB', q:1}, {b:'PTA', q:0}] },
  { code: '56101515SD00699', name: 'UPMods KN Cinnamon Pullout', cat: 'Modular Kitchen', cpl: 50675, stock: [{b:'KB', q:2}, {b:'B2CB', q:0}] },
  { code: '56101515SD00823', name: 'UPMods Eudora KN Hardware Cabinet', cat: 'Modular Kitchen', cpl: 12995, stock: [{b:'KB', q:5}, {b:'B2CB', q:2}, {b:'PTA', q:1}] },
  { code: '56101508SD00387', name: 'Orthoplus Mattress 78×72×04', cat: 'Mattress', cpl: 23453, stock: [{b:'KB', q:0}, {b:'B2CB', q:0}, {b:'PTA', q:0}] },
  { code: '30161803SD01622', name: 'Sliden Store XL Tx Phirota Blue', cat: 'Storage', cpl: 54988, stock: [{b:'KB', q:1}, {b:'B2CB', q:2}] },
  { code: '56101505SD00194', name: 'Senate TV Unit Brown CR', cat: 'Living', cpl: 46490, stock: [{b:'KB', q:1}, {b:'B2CB', q:1}, {b:'PTA', q:1}] },
  { code: '56101510KR00112', name: 'Kreation 2 Door Wardrobe Walnut Mirror', cat: 'Bedroom', cpl: 96500, stock: [{b:'KB', q:2}, {b:'B2CB', q:0}] },
  { code: '56101510KR00198', name: 'Kreation 3 Door Wardrobe Walnut', cat: 'Bedroom', cpl: 66109, stock: [{b:'KB', q:0}, {b:'B2CB', q:1}, {b:'PTA', q:0}] },
];

const SAMPLE_ORDER = {
  no: '215/43527',
  won: null, // not yet assigned
  date: '09.05.26',
  customer: 'Mrs Chinmayee Sendha',
  phone: '94380 11525',
  alt: '91786 99549',
  email: '',
  billing: 'Flat 204, Khetramani Apt,\nIn front of Patia College,\nBBSR — 751024',
  delivery: 'Same — 2nd floor',
  liftAvailable: 'No',
  customerCode: '—',
  poRef: 'CS/2026/0511',
  discountCode: '11% + 10% + 5%',
  plannedDly: '14.05.26',
  installNote: 'Installation within 48h after delivery',
  paymentMode: 'IDBI QR',
  earnest: 11390,
  source: 'Walk-in',
  followUp: '12.05.26',
  salesExec: 'Swati',
  items: [
    { code: '56101515SD00699', name: 'UPMods KN Cinnamon Pullout', qty: 1, cpl: 50675, total: 45101, disc: '11%', branch: 'KB' },
    { code: '56101515SD00823', name: 'UPMods Eudora KN Hardware Cabinet', qty: 1, cpl: 12995, total: 11566, disc: '11%', branch: 'KB' },
    { code: '56101508SD00387', name: 'Orthoplus Mattress 78×72×04', qty: 1, cpl: 23453, total: 21108, disc: '10%', branch: 'KB' },
    { code: '30161803SD01622', name: 'Sliden Store XL Tx Phirota Blue', qty: 1, cpl: 54988, total: 52239, disc: '5%', branch: 'KB' },
    { code: '56101505SD00194', name: 'Senate TV Unit Brown CR', qty: 1, cpl: 46490, total: 41376, disc: '11%', branch: 'KB' },
  ],
};

const ORDERS = [
  { no: '215/43527', won: null, customer: 'Mrs Chinmayee Sendha', date: '09.05.26', amt: 171390, status: 'pending-won', salesExec: 'Swati' },
  { no: '214/43526', won: 'WON036031', customer: 'Susheem Ku Behera', date: '08.05.26', amt: 35735, status: 'billed', salesExec: 'Archita' },
  { no: '272/43576', won: 'WON036392', customer: 'Vinod Krishna', date: '07.05.26', amt: 345000, status: 'billed', salesExec: 'Jitendra' },
  { no: '213/43522', won: 'WON035998', customer: 'Rakesh Mohanty', date: '06.05.26', amt: 88450, status: 'delivered', salesExec: 'Swati' },
  { no: '212/43519', won: null, customer: 'Anjali Patnaik', date: '06.05.26', amt: 24990, status: 'draft', salesExec: 'Archita' },
  { no: '211/43511', won: 'WON035876', customer: 'Debasis Nayak', date: '05.05.26', amt: 156780, status: 'delivered', salesExec: 'Jitendra' },
];

const BRANCHES = [
  { code: 'KB', name: 'KB Godown', items: 184 },
  { code: 'B2CB', name: 'B2C Bhubaneswar', items: 92 },
  { code: 'PTA', name: 'Patia Display', items: 47 },
  { code: 'CTC', name: 'Cuttack Branch', items: 38 },
];

window.MOCK = { ITEMS, ORDERS, BRANCHES, SAMPLE_ORDER };
