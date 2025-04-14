exports.validateTCKimlikNo = (tcno) => {
  if (!tcno) return false;
  
  if (!/^[1-9][0-9]{10}$/.test(tcno)) return false;

  let digits = tcno.split('').map(Number);
  
  let odd = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
  let even = digits[1] + digits[3] + digits[5] + digits[7];
  let digit10 = (odd * 7 - even) % 10;
  if (digit10 !== digits[9]) return false;
  
  let sum = digits.slice(0, 10).reduce((acc, val) => acc + val, 0);
  if (sum % 10 !== digits[10]) return false;

  return true;
};

exports.validateLicensePlate = (plate) => {
  if (!plate) return false;
  
  // Türkiye plaka formatı: 
  // 11-99 AA 1111
  // 11-99 AAA 11
  // 11-99 AAA 111
  const plateRegex = /^(0[1-9]|[1-7][0-9]|8[0-1])[A-Z]{1,3}[0-9]{2,4}$/;
  
  // Boşlukları kaldır ve büyük harfe çevir
  const formattedPlate = plate.replace(/\s+/g, '').toUpperCase();
  
  return plateRegex.test(formattedPlate);
};

const VALID_SPECIALTIES = [
  // Motor ve Güç Aktarımı
  'Motor tamiri ve bakımı',
  'Şanzıman (Manuel/Otomatik)',
  'Debriyaj sistemleri',
  'Turbo sistemleri',
  'Yakıt enjeksiyon sistemleri',
  'Egzoz sistemleri',
  'Soğutma sistemleri',
  
  // Elektrik ve Elektronik
  'Araç elektrik sistemleri',
  'ECU (Motor kontrol ünitesi)',
  'Diagnostik sistemler',
  'Aydınlatma sistemleri',
  'Klima sistemleri',
  'Akü ve şarj sistemleri',
  'Start-stop sistemleri',
  
  // Süspansiyon ve Direksiyon
  'Süspansiyon sistemleri',
  'Direksiyon sistemleri',
  'Rot ve rotbaşı',
  'Amortisör değişimi',
  'Aks ve rulman',
  'Lastik ve balans',
  
  // Fren Sistemleri
  'ABS sistemleri',
  'Fren bakım ve onarımı',
  'Disk ve balatalar',
  'Hidrolik sistemler',
  
  // Kaporta ve Boya
  'Kaporta onarımı',
  'Boya ve vernik',
  'Dolu hasarı onarımı',
  'PDR (Boyasız göçük düzeltme)',
  
  // Özel Sistemler
  'Hibrit sistemler',
  'Elektrikli araç sistemleri',
  'LPG/CNG sistemleri',
  'Performans modifikasyonları',
  
  // Araç Tiplerine Göre Uzmanlık
  'Binek araçlar',
  'Ticari araçlar',
  'Ağır vasıta',
  'Lüks/Spor araçlar',
  'Klasik araçlar',
  
  // Periyodik Bakım
  'Motor yağı değişimi',
  'Filtre değişimleri',
  'Triger seti değişimi',
  'Genel kontrol ve bakım'
];

exports.validateSpecialty = (specialty) => {
  return VALID_SPECIALTIES.includes(specialty);
};

exports.getValidSpecialties = () => {
  return VALID_SPECIALTIES;
};
