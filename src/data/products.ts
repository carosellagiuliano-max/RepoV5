// Import product images
import hydratingShampoo from '@/assets/products/hydrating-shampoo.jpg';
import volumeShampoo from '@/assets/products/volume-shampoo.jpg';
import colorProtectShampoo from '@/assets/products/color-protect-shampoo.jpg';
import repairConditioner from '@/assets/products/repair-conditioner.jpg';
import moisturizingConditioner from '@/assets/products/moisturizing-conditioner.jpg';
import heatProtectionSpray from '@/assets/products/heat-protection-spray.jpg';
import texturizingSpray from '@/assets/products/texturizing-spray.jpg';
import hairOil from '@/assets/products/hair-oil.jpg';

// Voucher images
import voucherWomen from '@/assets/voucher-women.jpg';
import voucherMen from '@/assets/voucher-men.jpg';

// Accessory images
import hairDryer from '@/assets/accessories/hair-dryer.jpg';
import electricRazor from '@/assets/accessories/electric-razor.jpg';
import traditionalRazor from '@/assets/accessories/traditional-razor.jpg';

// TAILOR's product images (using uploaded images)
const tailorsClayImg = '/lovable-uploads/42070e4c-5169-49b9-9c0b-f49470a8a11f.png';
const tailorsCreamImg = '/lovable-uploads/37f2682a-5140-4c84-9c39-622ba6610500.png';
const tailorsGelImg = '/lovable-uploads/139cd999-5d11-4213-b197-68656293fb61.png';
const tailorsPomadeImg = '/lovable-uploads/84750b8d-5a51-49a8-a7af-7086c97f27fb.png';
const tailorsSaltSprayImg = '/lovable-uploads/d05cfe2e-fc33-4e09-baa7-937af2a344d5.png';
const tailorsWaxImg = '/lovable-uploads/56f51a2f-c9cf-4fbc-86ce-71758f61ed28.png';

export interface Product {
  id: string;
  name: string;
  description: string;
  detailedDescription: string;
  usage: string;
  price: string;
  image: string;
}

export interface ProductCategory {
  category: string;
  items: Product[];
}

// Create categorized products for better organization
export const productCategories = {
  'Gutscheine & Geschenkboxen': [
    {
      id: 'voucher-women-20',
      name: 'Gutschein Frauen CHF 20',
      description: 'Geschenkgutschein für Damen im Wert von CHF 20',
      detailedDescription: 'Perfekt für kleinere Behandlungen oder als Ergänzung zu einem größeren Geschenk. Einlösbar für alle Dienstleistungen und Produkte.',
      usage: 'Im Salon einlösbar. Gültigkeitsdauer: 12 Monate ab Kaufdatum.',
      price: 'CHF 20',
      image: voucherWomen
    },
    {
      id: 'voucher-women-50',
      name: 'Gutschein Frauen CHF 50',
      description: 'Geschenkgutschein für Damen im Wert von CHF 50',
      detailedDescription: 'Ideal für Haarschnitte oder kleinere Colorationen. Einlösbar für alle Dienstleistungen und Produkte.',
      usage: 'Im Salon einlösbar. Gültigkeitsdauer: 12 Monate ab Kaufdatum.',
      price: 'CHF 50',
      image: voucherWomen
    },
    {
      id: 'voucher-women-100',
      name: 'Gutschein Frauen CHF 100',
      description: 'Geschenkgutschein für Damen im Wert von CHF 100',
      detailedDescription: 'Perfect für umfangreichere Behandlungen wie Colorationen oder Komplettbehandlungen. Einlösbar für alle Dienstleistungen und Produkte.',
      usage: 'Im Salon einlösbar. Gültigkeitsdauer: 12 Monate ab Kaufdatum.',
      price: 'CHF 100',
      image: voucherWomen
    },
    {
      id: 'voucher-women-200',
      name: 'Gutschein Frauen CHF 200',
      description: 'Geschenkgutschein für Damen im Wert von CHF 200',
      detailedDescription: 'Für ausgiebige Verwöhnprogramme und komplette Makeovers. Einlösbar für alle Dienstleistungen und Produkte.',
      usage: 'Im Salon einlösbar. Gültigkeitsdauer: 12 Monate ab Kaufdatum.',
      price: 'CHF 200',
      image: voucherWomen
    },
    {
      id: 'voucher-men-20',
      name: 'Gutschein Männer CHF 20',
      description: 'Geschenkgutschein für Herren im Wert von CHF 20',
      detailedDescription: 'Perfekt für kleinere Behandlungen oder als Ergänzung zu einem größeren Geschenk. Einlösbar für alle Dienstleistungen und Produkte.',
      usage: 'Im Salon einlösbar. Gültigkeitsdauer: 12 Monate ab Kaufdatum.',
      price: 'CHF 20',
      image: voucherMen
    },
    {
      id: 'voucher-men-50',
      name: 'Gutschein Männer CHF 50',
      description: 'Geschenkgutschein für Herren im Wert von CHF 50',
      detailedDescription: 'Ideal für Haarschnitte oder kleinere Behandlungen. Einlösbar für alle Dienstleistungen und Produkte.',
      usage: 'Im Salon einlösbar. Gültigkeitsdauer: 12 Monate ab Kaufdatum.',
      price: 'CHF 50',
      image: voucherMen
    },
    {
      id: 'voucher-men-100',
      name: 'Gutschein Männer CHF 100',
      description: 'Geschenkgutschein für Herren im Wert von CHF 100',
      detailedDescription: 'Perfect für umfangreichere Behandlungen und Pflege. Einlösbar für alle Dienstleistungen und Produkte.',
      usage: 'Im Salon einlösbar. Gültigkeitsdauer: 12 Monate ab Kaufdatum.',
      price: 'CHF 100',
      image: voucherMen
    },
    {
      id: 'voucher-men-200',
      name: 'Gutschein Männer CHF 200',
      description: 'Geschenkgutschein für Herren im Wert von CHF 200',
      detailedDescription: 'Für ausgiebige Verwöhnprogramme und komplette Makeovers. Einlösbar für alle Dienstleistungen und Produkte.',
      usage: 'Im Salon einlösbar. Gültigkeitsdauer: 12 Monate ab Kaufdatum.',
      price: 'CHF 200',
      image: voucherMen
    },
    {
      id: 'voucher-custom',
      name: 'Gutschein Wunschbetrag',
      description: 'Geschenkgutschein mit beliebigem Betrag',
      detailedDescription: 'Wählen Sie selbst den Betrag für Ihren Geschenkgutschein. Einlösbar für alle Dienstleistungen und Produkte.',
      usage: 'Im Salon einlösbar. Gültigkeitsdauer: 12 Monate ab Kaufdatum.',
      price: 'Nach Wahl',
      image: voucherWomen
    },
    {
      id: 'gift-box',
      name: 'Geschenkbox (leer)',
      description: 'Elegante Geschenkbox zum Befüllen mit Produkten',
      detailedDescription: 'Hochwertige Geschenkbox, die Sie mit Ihren Lieblingsprodukten befüllen können. Perfekt für individuelle Geschenke.',
      usage: 'Wählen Sie zusätzlich Ihre gewünschten Produkte aus.',
      price: 'CHF 5',
      image: moisturizingConditioner
    }
  ],
  'Frauen Produkte': [
    // Trinity Curl Products
    {
      id: 'trinity-curl-shampoo',
      name: 'Trinity Curl Shampoo',
      description: 'Speziell für lockiges Haar entwickelt',
      detailedDescription: 'Reinigt sanft und definiert Locken. Mit Gletscherwasser formuliert für optimale Lockenpflege und natürliche Sprungkraft.',
      usage: 'Auf das nasse Haar auftragen, sanft einmassieren und gründlich ausspülen.',
      price: 'CHF 32',
      image: hydratingShampoo
    },
    {
      id: 'trinity-curl-conditioner',
      name: 'Trinity Curl Conditioner',
      description: 'Feuchtigkeitsspendender Conditioner für Locken',
      detailedDescription: 'Versorgt lockiges Haar intensiv mit Feuchtigkeit und definiert die Lockenstruktur für geschmeidige, glänzende Locken.',
      usage: 'Nach dem Shampoo auf das handtuchtrockene Haar auftragen, 2-3 Minuten einwirken lassen und ausspülen.',
      price: 'CHF 35',
      image: repairConditioner
    },
    // Trinity Colour Products
    {
      id: 'trinity-colour-shampoo',
      name: 'Trinity Colour Shampoo',
      description: 'Farbschutz Shampoo für coloriertes Haar',
      detailedDescription: 'Diese TRINITY haircare essentials Linie macht gefärbte Haare geschmeidig und lebhaft. Gletscherwasser, Granatapfel-Öl und Hagebutten-Extrakt schützen und stabilisieren die Haarfarbe.',
      usage: 'Auf das nasse Haar auftragen, sanft einmassieren und gründlich ausspülen.',
      price: 'CHF 34',
      image: colorProtectShampoo
    },
    {
      id: 'trinity-colour-conditioner',
      name: 'Trinity Colour Conditioner',
      description: 'Farbschützender Conditioner',
      detailedDescription: 'Schützt und stabilisiert die Haarfarbe mit Granatapfel-Öl und Hagebutten-Extrakt. Macht gefärbte Haare geschmeidig und lebhaft.',
      usage: 'Nach dem Shampoo auf das handtuchtrockene Haar auftragen, 2-3 Minuten einwirken lassen und ausspülen.',
      price: 'CHF 37',
      image: moisturizingConditioner
    },
    // Trinity Blonde Products
    {
      id: 'trinity-blonde-shampoo',
      name: 'Trinity Blonde Shampoo (Silbershampoo)',
      description: 'Spezielles Shampoo für blondes Haar',
      detailedDescription: 'Reinigt sanft, repariert und schützt blondes Haar. Gletscherwasser, Platin und Lavendel-Öl neutralisieren Gelbstich, betonen blonde Nuancen und verleihen neue Vitalität.',
      usage: 'Auf das nasse Haar auftragen, sanft einmassieren und gründlich ausspülen.',
      price: 'CHF 35',
      image: colorProtectShampoo
    },
    {
      id: 'trinity-blonde-conditioner',
      name: 'Trinity Blonde Conditioner',
      description: 'Pflegender Conditioner für blondes Haar',
      detailedDescription: 'Repariert und schützt blondes Haar mit Platin und Lavendel-Öl. Neutralisiert Gelbstich und intensiviert Kontraste.',
      usage: 'Nach dem Shampoo auf das handtuchtrockene Haar auftragen, 2-3 Minuten einwirken lassen und ausspülen.',
      price: 'CHF 38',
      image: moisturizingConditioner
    },
    // Trinity Moisture Products
    {
      id: 'trinity-moisture-shampoo',
      name: 'Trinity Moisture Shampoo',
      description: 'Feuchtigkeitsspendendes Shampoo für den täglichen Gebrauch',
      detailedDescription: 'Für den täglichen Gebrauch entwickelt. Gletscherwasser, Aloe Vera und Pro-Vitamin B5 versorgen das Haar intensiv mit Feuchtigkeit und geben ihm neuen Glanz und ein gesundes Aussehen.',
      usage: 'Auf das nasse Haar auftragen, sanft einmassieren und gründlich ausspülen.',
      price: 'CHF 30',
      image: hydratingShampoo
    },
    {
      id: 'trinity-moisture-conditioner',
      name: 'Trinity Moisture Conditioner',
      description: 'Feuchtigkeitsspendender Conditioner',
      detailedDescription: 'Versorgt das Haar intensiv mit Feuchtigkeit. Mit Aloe Vera und Pro-Vitamin B5 für neuen Glanz und gesundes Aussehen.',
      usage: 'Nach dem Shampoo auf das handtuchtrockene Haar auftragen, 2-3 Minuten einwirken lassen und ausspülen.',
      price: 'CHF 33',
      image: moisturizingConditioner
    },
    // Trinity Volume Products
    {
      id: 'trinity-volume-shampoo',
      name: 'Trinity Volume Shampoo',
      description: 'Volumen Shampoo für feines Haar',
      detailedDescription: 'Gibt feinem Haar neue Fülle und mehr Stabilität. Gletscherwasser, Bambus und Salbei-Extrakt regulieren den Feuchtigkeitshaushalt und stärken das Haar. Verhindert statische Aufladung.',
      usage: 'Auf das nasse Haar auftragen, sanft einmassieren und gründlich ausspülen.',
      price: 'CHF 31',
      image: volumeShampoo
    },
    {
      id: 'trinity-volume-conditioner',
      name: 'Trinity Volume Conditioner',
      description: 'Volumen Conditioner ohne Beschwerung',
      detailedDescription: 'Verleiht feinem Haar Fülle und Stabilität ohne zu beschweren. Mit Bambus und Salbei-Extrakt für verbesserte Kämmbarkeit.',
      usage: 'Nach dem Shampoo auf das handtuchtrockene Haar auftragen, 2-3 Minuten einwirken lassen und ausspülen.',
      price: 'CHF 34',
      image: repairConditioner
    }
  ],
  'Männer Produkte': [
    // TAILOR's Styling Products
    {
      id: 'tailors-clay',
      name: 'Clay',
      description: 'Mattierende Styling-Creme mit festem Halt',
      detailedDescription: 'TAILOR\'s Clay mit Bambus-Extrakt verleiht mattierende Textur und festen Halt. Perfekt für strukturierte, natürliche Looks ohne glänzendes Finish.',
      usage: 'Kleine Menge in den Handflächen verreiben und ins trockene oder leicht feuchte Haar einarbeiten. Nach Wunsch stylen.',
      price: 'CHF 32',
      image: tailorsClayImg
    },
    {
      id: 'tailors-cream',
      name: 'Cream',
      description: 'Styling-Creme für natürlichen Glanz',
      detailedDescription: 'TAILOR\'s Cream mit Bambus-Extrakt bietet mittleren Halt mit natürlichem Glanz. Ideal für klassische und moderne Styles.',
      usage: 'Ins handtuchtrockene oder trockene Haar einarbeiten und stylen.',
      price: 'CHF 30',
      image: tailorsCreamImg
    },
    {
      id: 'tailors-wax',
      name: 'Wax',
      description: 'Flexibles Styling-Wachs mit starkem Halt',
      detailedDescription: 'TAILOR\'s Wax mit Bambus-Extrakt sorgt für flexiblen, starken Halt. Ermöglicht Restyling während des Tages.',
      usage: 'Zwischen den Handflächen erwärmen und gleichmäßig ins Haar einarbeiten.',
      price: 'CHF 34',
      image: tailorsWaxImg
    },
    {
      id: 'tailors-gel',
      name: 'Gel',
      description: 'Styling-Gel für starken Halt und Glanz',
      detailedDescription: 'TAILOR\'s Gel mit Bambus-Extrakt bietet starken Halt und glänzendes Finish. Ideal für sleeke, definierte Styles.',
      usage: 'Ins feuchte Haar einarbeiten und in die gewünschte Form bringen.',
      price: 'CHF 26',
      image: tailorsGelImg
    },
    {
      id: 'tailors-pomade',
      name: 'Pomade',
      description: 'Klassische Pomade für elegante Styles',
      detailedDescription: 'TAILOR\'s Pomade mit Bambus-Extrakt für klassisch elegante Herrenfrisuren. Hoher Glanz und starker Halt.',
      usage: 'Ins handtuchtrockene Haar einarbeiten und mit dem Kamm stylen.',
      price: 'CHF 32',
      image: tailorsPomadeImg
    },
    {
      id: 'tailors-salt-spray',
      name: 'Salt Spray',
      description: 'Salzspray für Beach-Wave Textur',
      detailedDescription: 'TAILOR\'s Salt Spray mit Bambus-Extrakt kreiert natürliche Beach-Wave Texturen. Verleiht Griff und Definition.',
      usage: 'Auf feuchtes oder trockenes Haar sprühen und mit den Händen kneten.',
      price: 'CHF 28',
      image: tailorsSaltSprayImg
    },
    // TAILOR's Care Products
    {
      id: 'tailors-daily-shampoo',
      name: 'Daily Shampoo',
      description: 'Tägliche Reinigung für alle Haartypen',
      detailedDescription: 'Das Daily Shampoo von TAILOR\'s reinigt das Haar sanft und gründlich. Die ausgewogene Formel eignet sich für die tägliche Anwendung und alle Haartypen.',
      usage: 'Ins nasse Haar einmassieren, aufschäumen und gründlich ausspülen.',
      price: 'CHF 26',
      image: hydratingShampoo
    },
    {
      id: 'tailors-conditioner',
      name: 'Daily Conditioner',
      description: 'Tägliche Pflege und Geschmeidigkeit',
      detailedDescription: 'Der Daily Conditioner spendet dem Haar Feuchtigkeit und macht es kämmbar. Perfekt für die tägliche Pflege-Routine.',
      usage: 'Nach dem Shampoo in die Längen einarbeiten, kurz einwirken lassen und ausspülen.',
      price: 'CHF 24',
      image: moisturizingConditioner
    },
    // TAILOR's Shaving Products
    {
      id: 'tailors-shaving-cream',
      name: 'Shaving Cream',
      description: 'Reichhaltige Rasiercreme für die perfekte Rasur',
      detailedDescription: 'Die Shaving Cream sorgt für eine sanfte und gründliche Rasur. Die reichhaltige Formel schützt die Haut vor Irritationen.',
      usage: 'Mit einem Rasierpinsel oder den Händen aufschäumen und auf die angefeuchtete Haut auftragen.',
      price: 'CHF 22',
      image: heatProtectionSpray
    },
    {
      id: 'tailors-aftershave',
      name: 'After Shave Balm',
      description: 'Beruhigender Balsam nach der Rasur',
      detailedDescription: 'Der After Shave Balm beruhigt die Haut nach der Rasur und spendet Feuchtigkeit. Ohne Alkohol, daher brennt er nicht.',
      usage: 'Nach der Rasur auf die gereinigte Haut auftragen und sanft einmassieren.',
      price: 'CHF 26',
      image: repairConditioner
    }
  ],
  'Beauty & Zubehör': [
    {
      id: 'heat-protection-spray',
      name: 'Heat Protection Spray',
      description: 'Schutz vor Hitze bis 230°C',
      detailedDescription: 'Das Heat Protection Spray schützt das Haar zuverlässig vor Hitzeschäden durch Föhn, Glätteisen oder Lockenstab. Es bildet eine unsichtbare Schutzschicht und bewahrt die Haargesundheit.',
      usage: 'Vor dem Styling auf das handtuchtrockene Haar sprühen und gleichmäßig verteilen. Nicht ausspülen. Anschließend wie gewohnt stylen.',
      price: 'CHF 24',
      image: heatProtectionSpray
    },
    {
      id: 'texturizing-spray',
      name: 'Texturizing Spray',
      description: 'Für natürliche Textur und Halt',
      detailedDescription: 'Das Texturizing Spray verleiht dem Haar natürliche Textur und flexiblen Halt. Perfekt für Beach-Waves oder um feinem Haar mehr Griffigkeit zu geben.',
      usage: 'Auf das trockene oder leicht feuchte Haar sprühen und mit den Fingern einkneten. Für mehr Volumen kopfüber anwenden.',
      price: 'CHF 26',
      image: texturizingSpray
    },
    {
      id: 'hair-oil',
      name: 'Hair Oil',
      description: 'Nährendes Öl für Glanz und Geschmeidigkeit',
      detailedDescription: 'Das Hair Oil ist ein luxuriöses Pflegeöl, das dem Haar intensiven Glanz und seidige Geschmeidigkeit verleiht. Die leichte Formel fettet nicht und eignet sich für alle Haartypen.',
      usage: 'Wenige Tropfen in die Handflächen verteilen und in die Längen und Spitzen einarbeiten. Kann auf trockenem oder feuchtem Haar angewendet werden.',
      price: 'CHF 35',
      image: hairOil
    },
    {
      id: 'professional-hairdryer',
      name: 'Profi Haarföhn',
      description: 'Leistungsstarker Salon-Föhn für zu Hause',
      detailedDescription: 'Professioneller Haarföhn mit 2000W Leistung und Ionentechnologie. Verkürzt die Trocknungszeit und sorgt für glänzendes, gesundes Haar.',
      usage: 'Verschiedene Temperaturstufen und Geschwindigkeiten für alle Haartypen.',
      price: 'CHF 120',
      image: hairDryer
    },
    {
      id: 'electric-razor',
      name: 'Elektrorasierer',
      description: 'Moderner Elektrorasierer für präzise Rasur',
      detailedDescription: 'Hochwertiger Elektrorasierer mit mehreren Scherköpfen für eine sanfte und gründliche Rasur. Wiederaufladbar und wasserfest.',
      usage: 'Für die perfekte Rasur im eigenen Badezimmer.',
      price: 'CHF 89',
      image: electricRazor
    },
    {
      id: 'traditional-razor',
      name: 'Klassischer Rasierer',
      description: 'Traditioneller Rasierer für die klassische Rasur',
      detailedDescription: 'Professioneller traditioneller Rasierer mit austauschbaren Klingen für eine sanfte und präzise Rasur.',
      usage: 'Für die klassische Rasur mit Rasierschaum oder -seife.',
      price: 'CHF 45',
      image: traditionalRazor
    }
  ]
};

export const products: ProductCategory[] = [
  {
    category: 'Gutscheine',
    items: [
      {
        id: 'voucher-20',
        name: 'Gutschein CHF 20',
        description: 'Geschenkgutschein im Wert von CHF 20',
        detailedDescription: 'Perfekt für kleinere Behandlungen oder als Ergänzung zu einem größeren Geschenk. Einlösbar für alle Dienstleistungen und Produkte.',
        usage: 'Im Salon einlösbar. Gültigkeitsdauer: 12 Monate ab Kaufdatum.',
        price: 'CHF 20',
        image: hydratingShampoo
      },
      {
        id: 'voucher-50',
        name: 'Gutschein CHF 50',
        description: 'Geschenkgutschein im Wert von CHF 50',
        detailedDescription: 'Ideal für Haarschnitte oder kleinere Colorationen. Einlösbar für alle Dienstleistungen und Produkte.',
        usage: 'Im Salon einlösbar. Gültigkeitsdauer: 12 Monate ab Kaufdatum.',
        price: 'CHF 50',
        image: volumeShampoo
      },
      {
        id: 'voucher-100',
        name: 'Gutschein CHF 100',
        description: 'Geschenkgutschein im Wert von CHF 100',
        detailedDescription: 'Perfect für umfangreichere Behandlungen wie Colorationen oder Komplettbehandlungen. Einlösbar für alle Dienstleistungen und Produkte.',
        usage: 'Im Salon einlösbar. Gültigkeitsdauer: 12 Monate ab Kaufdatum.',
        price: 'CHF 100',
        image: colorProtectShampoo
      },
      {
        id: 'voucher-200',
        name: 'Gutschein CHF 200',
        description: 'Geschenkgutschein im Wert von CHF 200',
        detailedDescription: 'Für ausgiebige Verwöhnprogramme und komplette Makeovers. Einlösbar für alle Dienstleistungen und Produkte.',
        usage: 'Im Salon einlösbar. Gültigkeitsdauer: 12 Monate ab Kaufdatum.',
        price: 'CHF 200',
        image: repairConditioner
      },
      {
        id: 'voucher-custom',
        name: 'Gutschein Wunschbetrag',
        description: 'Geschenkgutschein mit beliebigem Betrag',
        detailedDescription: 'Wählen Sie selbst den Betrag für Ihren Geschenkgutschein. Einlösbar für alle Dienstleistungen und Produkte.',
        usage: 'Im Salon einlösbar. Gültigkeitsdauer: 12 Monate ab Kaufdatum.',
        price: 'Nach Wahl',
        image: hairOil
      }
    ]
  },
  {
    category: 'Geschenkbox',
    items: [
      {
        id: 'gift-box',
        name: 'Geschenkbox (leer)',
        description: 'Elegante Geschenkbox zum Befüllen mit Produkten',
        detailedDescription: 'Hochwertige Geschenkbox, die Sie mit Ihren Lieblingsprodukten befüllen können. Perfekt für individuelle Geschenke.',
        usage: 'Wählen Sie zusätzlich Ihre gewünschten Produkte aus.',
        price: 'CHF 5',
        image: moisturizingConditioner
      }
    ]
  },
  {
    category: 'Trinity Haircare Essentials - Curl',
    items: [
      {
        id: 'trinity-curl-shampoo',
        name: 'Trinity Curl Shampoo',
        description: 'Speziell für lockiges Haar entwickelt',
        detailedDescription: 'Reinigt sanft und definiert Locken. Mit Gletscherwasser formuliert für optimale Lockenpflege und natürliche Sprungkraft.',
        usage: 'Auf das nasse Haar auftragen, sanft einmassieren und gründlich ausspülen.',
        price: 'CHF 32',
        image: hydratingShampoo
      },
      {
        id: 'trinity-curl-conditioner',
        name: 'Trinity Curl Conditioner',
        description: 'Feuchtigkeitsspendender Conditioner für Locken',
        detailedDescription: 'Versorgt lockiges Haar intensiv mit Feuchtigkeit und definiert die Lockenstruktur für geschmeidige, glänzende Locken.',
        usage: 'Nach dem Shampoo auf das handtuchtrockene Haar auftragen, 2-3 Minuten einwirken lassen und ausspülen.',
        price: 'CHF 35',
        image: repairConditioner
      }
    ]
  },
  {
    category: 'Trinity Haircare Essentials - Colour',
    items: [
      {
        id: 'trinity-colour-shampoo',
        name: 'Trinity Colour Shampoo',
        description: 'Farbschutz Shampoo für coloriertes Haar',
        detailedDescription: 'Diese TRINITY haircare essentials Linie macht gefärbte Haare geschmeidig und lebhaft. Gletscherwasser, Granatapfel-Öl und Hagebutten-Extrakt schützen und stabilisieren die Haarfarbe.',
        usage: 'Auf das nasse Haar auftragen, sanft einmassieren und gründlich ausspülen.',
        price: 'CHF 34',
        image: colorProtectShampoo
      },
      {
        id: 'trinity-colour-conditioner',
        name: 'Trinity Colour Conditioner',
        description: 'Farbschützender Conditioner',
        detailedDescription: 'Schützt und stabilisiert die Haarfarbe mit Granatapfel-Öl und Hagebutten-Extrakt. Macht gefärbte Haare geschmeidig und lebhaft.',
        usage: 'Nach dem Shampoo auf das handtuchtrockene Haar auftragen, 2-3 Minuten einwirken lassen und ausspülen.',
        price: 'CHF 37',
        image: moisturizingConditioner
      }
    ]
  },
  {
    category: 'Trinity Haircare Essentials - Moisture',
    items: [
      {
        id: 'trinity-moisture-shampoo',
        name: 'Trinity Moisture Shampoo',
        description: 'Feuchtigkeitsspendendes Shampoo für den täglichen Gebrauch',
        detailedDescription: 'Für den täglichen Gebrauch entwickelt. Gletscherwasser, Aloe Vera und Pro-Vitamin B5 versorgen das Haar intensiv mit Feuchtigkeit und geben ihm neuen Glanz und ein gesundes Aussehen.',
        usage: 'Auf das nasse Haar auftragen, sanft einmassieren und gründlich ausspülen.',
        price: 'CHF 30',
        image: hydratingShampoo
      },
      {
        id: 'trinity-moisture-conditioner',
        name: 'Trinity Moisture Conditioner',
        description: 'Feuchtigkeitsspendender Conditioner',
        detailedDescription: 'Versorgt das Haar intensiv mit Feuchtigkeit. Mit Aloe Vera und Pro-Vitamin B5 für neuen Glanz und gesundes Aussehen.',
        usage: 'Nach dem Shampoo auf das handtuchtrockene Haar auftragen, 2-3 Minuten einwirken lassen und ausspülen.',
        price: 'CHF 33',
        image: moisturizingConditioner
      }
    ]
  },
  {
    category: 'Trinity Haircare Essentials - Volume',
    items: [
      {
        id: 'trinity-volume-shampoo',
        name: 'Trinity Volume Shampoo',
        description: 'Volumen Shampoo für feines Haar',
        detailedDescription: 'Gibt feinem Haar neue Fülle und mehr Stabilität. Gletscherwasser, Bambus und Salbei-Extrakt regulieren den Feuchtigkeitshaushalt und stärken das Haar. Verhindert statische Aufladung.',
        usage: 'Auf das nasse Haar auftragen, sanft einmassieren und gründlich ausspülen.',
        price: 'CHF 31',
        image: volumeShampoo
      },
      {
        id: 'trinity-volume-conditioner',
        name: 'Trinity Volume Conditioner',
        description: 'Volumen Conditioner ohne Beschwerung',
        detailedDescription: 'Verleiht feinem Haar Fülle und Stabilität ohne zu beschweren. Mit Bambus und Salbei-Extrakt für verbesserte Kämmbarkeit.',
        usage: 'Nach dem Shampoo auf das handtuchtrockene Haar auftragen, 2-3 Minuten einwirken lassen und ausspülen.',
        price: 'CHF 34',
        image: repairConditioner
      }
    ]
  },
  {
    category: 'Trinity Haircare Essentials - Blonde',
    items: [
      {
        id: 'trinity-blonde-shampoo',
        name: 'Trinity Blonde Shampoo',
        description: 'Spezielles Shampoo für blondes Haar',
        detailedDescription: 'Reinigt sanft, repariert und schützt blondes Haar. Gletscherwasser, Platin und Lavendel-Öl neutralisieren Gelbstich, betonen blonde Nuancen und verleihen neue Vitalität.',
        usage: 'Auf das nasse Haar auftragen, sanft einmassieren und gründlich ausspülen.',
        price: 'CHF 35',
        image: colorProtectShampoo
      },
      {
        id: 'trinity-blonde-conditioner',
        name: 'Trinity Blonde Conditioner',
        description: 'Pflegender Conditioner für blondes Haar',
        detailedDescription: 'Repariert und schützt blondes Haar mit Platin und Lavendel-Öl. Neutralisiert Gelbstich und intensiviert Kontraste.',
        usage: 'Nach dem Shampoo auf das handtuchtrockene Haar auftragen, 2-3 Minuten einwirken lassen und ausspülen.',
        price: 'CHF 38',
        image: moisturizingConditioner
      }
    ]
  },
  {
    category: 'Trinity Haircare Essentials - Summer',
    items: [
      {
        id: 'trinity-summer-shampoo',
        name: 'Trinity Summer Shampoo',
        description: 'Sonnenschutz Shampoo für den Sommer',
        detailedDescription: 'Schützt das Haar vor UV-Strahlen und Hitze. Gletscherwasser, Mandelöl und Braunalgen-Extrakt versorgen sonnenstrapaziertes Haar intensiv mit Feuchtigkeit.',
        usage: 'Auf das nasse Haar auftragen, sanft einmassieren und gründlich ausspülen.',
        price: 'CHF 33',
        image: heatProtectionSpray
      },
      {
        id: 'trinity-summer-conditioner',
        name: 'Trinity Summer Conditioner',
        description: 'Regenerierender Conditioner für sonnenstrapaziertes Haar',
        detailedDescription: 'Versorgt trockenes und sonnenstrapaziertes Haar intensiv mit Feuchtigkeit. Mit Mandelöl und Braunalgen-Extrakt für Geschmeidigkeit und Glanz.',
        usage: 'Nach dem Shampoo auf das handtuchtrockene Haar auftragen, 2-3 Minuten einwirken lassen und ausspülen.',
        price: 'CHF 36',
        image: moisturizingConditioner
      }
    ]
  },
  {
    category: 'Trinity Haircare Essentials - Winter',
    items: [
      {
        id: 'trinity-winter-shampoo',
        name: 'Trinity Winter Shampoo',
        description: 'Schutz Shampoo für die kalte Jahreszeit',
        detailedDescription: 'Schützt das Haar vor Kälte und trockener Heizungsluft. Gletscherwasser, Aloe Vera und Pro-Vitamin B5 regulieren den Feuchtigkeitshaushalt.',
        usage: 'Auf das nasse Haar auftragen, sanft einmassieren und gründlich ausspülen.',
        price: 'CHF 31',
        image: hydratingShampoo
      },
      {
        id: 'trinity-winter-conditioner',
        name: 'Trinity Winter Conditioner',
        description: 'Feuchtigkeitsregulierender Conditioner',
        detailedDescription: 'Reguliert den Feuchtigkeitshaushalt von Haut und Haaren während der kalten Jahreszeit. Mit Aloe Vera und Pro-Vitamin B5.',
        usage: 'Nach dem Shampoo auf das handtuchtrockene Haar auftragen, 2-3 Minuten einwirken lassen und ausspülen.',
        price: 'CHF 34',
        image: repairConditioner
      }
    ]
  },
  {
    category: 'Trinity Haircare Therapies - Caffein',
    items: [
      {
        id: 'trinity-caffein-shampoo',
        name: 'Trinity Caffein Shampoo',
        description: 'Stimulierendes Shampoo gegen Haarausfall',
        detailedDescription: 'Stimuliert und belebt die Haarwurzeln und beugt Haarausfall vor. Gletscherwasser, Koffein und Pro-Vitamin B5 verbessern die Bedingungen zum Haarwachstum.',
        usage: 'Auf das nasse Haar auftragen, sanft in die Kopfhaut einmassieren und gründlich ausspülen.',
        price: 'CHF 37',
        image: volumeShampoo
      },
      {
        id: 'trinity-caffein-conditioner',
        name: 'Trinity Caffein Conditioner',
        description: 'Belebender Conditioner für die Kopfhaut',
        detailedDescription: 'Reguliert den Feuchtigkeitshaushalt von Kopfhaut und Haaren. Mit Koffein und Pro-Vitamin B5 für optimale Haarwachstumsbedingungen.',
        usage: 'Nach dem Shampoo auf das handtuchtrockene Haar auftragen, 2-3 Minuten einwirken lassen und ausspülen.',
        price: 'CHF 40',
        image: repairConditioner
      }
    ]
  },
  {
    category: 'Trinity Haircare Therapies - Argan',
    items: [
      {
        id: 'trinity-argan-shampoo',
        name: 'Trinity Argan Shampoo',
        description: 'Restrukturierendes Shampoo mit Arganöl',
        detailedDescription: 'Reinigt sanft und stellt die Feuchtigkeitsbalance wieder her. Gletscherwasser, Argan Öl und Leinsamen-Extrakt restrukturieren die Haare tiefenwirksam.',
        usage: 'Auf das nasse Haar auftragen, sanft einmassieren und gründlich ausspülen.',
        price: 'CHF 39',
        image: hairOil
      },
      {
        id: 'trinity-argan-conditioner',
        name: 'Trinity Argan Conditioner',
        description: 'Tiefenwirksamer Conditioner mit Arganöl',
        detailedDescription: 'Sorgt für Geschmeidigkeit, Glanz und neue Elastizität. Mit Argan Öl und Leinsamen-Extrakt für tiefenwirksame Restrukturierung.',
        usage: 'Nach dem Shampoo auf das handtuchtrockene Haar auftragen, 2-3 Minuten einwirken lassen und ausspülen.',
        price: 'CHF 42',
        image: moisturizingConditioner
      }
    ]
  },
  {
    category: 'Trinity Haircare Therapies - Sensitive',
    items: [
      {
        id: 'trinity-sensitive-shampoo',
        name: 'Trinity Sensitive Shampoo',
        description: 'Sanftes Shampoo für empfindliche Kopfhaut',
        detailedDescription: 'Entfernt Schuppen, wirkt gegen Juckreiz und beseitigt Irritationen. Gletscherwasser, Rosmarin, Sonnenblumen-Extrakt & Climbazol. Parfümfrei zum Schutz vor allergischen Reaktionen.',
        usage: 'Auf das nasse Haar auftragen, sanft einmassieren und gründlich ausspülen.',
        price: 'CHF 36',
        image: hydratingShampoo
      },
      {
        id: 'trinity-sensitive-conditioner',
        name: 'Trinity Sensitive Conditioner',
        description: 'Beruhigender Conditioner für empfindliche Kopfhaut',
        detailedDescription: 'Reguliert den Feuchtigkeitshaushalt und verleiht Glanz. Mit Rosmarin und Sonnenblumen-Extrakt, parfümfrei für empfindliche Kopfhaut.',
        usage: 'Nach dem Shampoo auf das handtuchtrockene Haar auftragen, 2-3 Minuten einwirken lassen und ausspülen.',
        price: 'CHF 39',
        image: repairConditioner
      }
    ]
  },
  {
    category: 'Styling Produkte',
    items: [
      {
        id: 'heat-protection-spray',
        name: 'Heat Protection Spray',
        description: 'Schutz vor Hitze bis 230°C',
        detailedDescription: 'Das Heat Protection Spray schützt das Haar zuverlässig vor Hitzeschäden durch Föhn, Glätteisen oder Lockenstab. Es bildet eine unsichtbare Schutzschicht und bewahrt die Haargesundheit.',
        usage: 'Vor dem Styling auf das handtuchtrockene Haar sprühen und gleichmäßig verteilen. Nicht ausspülen. Anschließend wie gewohnt stylen.',
        price: 'CHF 24',
        image: heatProtectionSpray
      },
      {
        id: 'texturizing-spray',
        name: 'Texturizing Spray',
        description: 'Für natürliche Textur und Halt',
        detailedDescription: 'Das Texturizing Spray verleiht dem Haar natürliche Textur und flexiblen Halt. Perfekt für Beach-Waves oder um feinem Haar mehr Griffigkeit zu geben.',
        usage: 'Auf das trockene oder leicht feuchte Haar sprühen und mit den Fingern einkneten. Für mehr Volumen kopfüber anwenden.',
        price: 'CHF 26',
        image: texturizingSpray
      },
      {
        id: 'hair-oil',
        name: 'Hair Oil',
        description: 'Nährendes Öl für Glanz und Geschmeidigkeit',
        detailedDescription: 'Das Hair Oil ist ein luxuriöses Pflegeöl, das dem Haar intensiven Glanz und seidige Geschmeidigkeit verleiht. Die leichte Formel fettet nicht und eignet sich für alle Haartypen.',
        usage: 'Wenige Tropfen in die Handflächen verteilen und in die Längen und Spitzen einarbeiten. Kann auf trockenem oder feuchtem Haar angewendet werden.',
        price: 'CHF 35',
        image: hairOil
      }
    ]
  },
  {
    category: 'TAILOR\'s Care Serie',
    items: [
      {
        id: 'tailors-daily-shampoo',
        name: 'Daily Shampoo',
        description: 'Tägliche Reinigung für alle Haartypen',
        detailedDescription: 'Das Daily Shampoo von TAILOR\'s reinigt das Haar sanft und gründlich. Die ausgewogene Formel eignet sich für die tägliche Anwendung und alle Haartypen.',
        usage: 'Ins nasse Haar einmassieren, aufschäumen und gründlich ausspülen.',
        price: 'CHF 26',
        image: hydratingShampoo
      },
      {
        id: 'tailors-conditioner',
        name: 'Daily Conditioner',
        description: 'Tägliche Pflege und Geschmeidigkeit',
        detailedDescription: 'Der Daily Conditioner spendet dem Haar Feuchtigkeit und macht es kämmbar. Perfekt für die tägliche Pflege-Routine.',
        usage: 'Nach dem Shampoo in die Längen einarbeiten, kurz einwirken lassen und ausspülen.',
        price: 'CHF 24',
        image: moisturizingConditioner
      }
    ]
  },
  {
    category: 'TAILOR\'s Styling Serie',
    items: [
      {
        id: 'tailors-clay',
        name: 'Clay',
        description: 'Mattierende Styling-Creme mit festem Halt',
        detailedDescription: 'TAILOR\'s Clay mit Bambus-Extrakt verleiht mattierende Textur und festen Halt. Perfekt für strukturierte, natürliche Looks ohne glänzendes Finish.',
        usage: 'Kleine Menge in den Handflächen verreiben und ins trockene oder leicht feuchte Haar einarbeiten. Nach Wunsch stylen.',
        price: 'CHF 32',
        image: tailorsClayImg
      },
      {
        id: 'tailors-cream',
        name: 'Cream',
        description: 'Styling-Creme für natürlichen Glanz',
        detailedDescription: 'TAILOR\'s Cream mit Bambus-Extrakt bietet mittleren Halt mit natürlichem Glanz. Ideal für klassische und moderne Styles.',
        usage: 'Ins handtuchtrockene oder trockene Haar einarbeiten und stylen.',
        price: 'CHF 30',
        image: tailorsCreamImg
      },
      {
        id: 'tailors-wax',
        name: 'Wax',
        description: 'Flexibles Styling-Wachs mit starkem Halt',
        detailedDescription: 'TAILOR\'s Wax mit Bambus-Extrakt sorgt für flexiblen, starken Halt. Ermöglicht Restyling während des Tages.',
        usage: 'Zwischen den Handflächen erwärmen und gleichmäßig ins Haar einarbeiten.',
        price: 'CHF 34',
        image: tailorsWaxImg
      },
      {
        id: 'tailors-gel',
        name: 'Gel',
        description: 'Styling-Gel für starken Halt und Glanz',
        detailedDescription: 'TAILOR\'s Gel mit Bambus-Extrakt bietet starken Halt und glänzendes Finish. Ideal für sleeke, definierte Styles.',
        usage: 'Ins feuchte Haar einarbeiten und in die gewünschte Form bringen.',
        price: 'CHF 26',
        image: tailorsGelImg
      },
      {
        id: 'tailors-pomade',
        name: 'Pomade',
        description: 'Klassische Pomade für elegante Styles',
        detailedDescription: 'TAILOR\'s Pomade mit Bambus-Extrakt für klassisch elegante Herrenfrisuren. Hoher Glanz und starker Halt.',
        usage: 'Ins handtuchtrockene Haar einarbeiten und mit dem Kamm stylen.',
        price: 'CHF 32',
        image: tailorsPomadeImg
      },
      {
        id: 'tailors-salt-spray',
        name: 'Salt Spray',
        description: 'Salzspray für Beach-Wave Textur',
        detailedDescription: 'TAILOR\'s Salt Spray mit Bambus-Extrakt kreiert natürliche Beach-Wave Texturen. Verleiht Griff und Definition.',
        usage: 'Auf feuchtes oder trockenes Haar sprühen und mit den Händen kneten.',
        price: 'CHF 28',
        image: tailorsSaltSprayImg
      }
    ]
  },
  {
    category: 'TAILOR\'s Shaving Serie',
    items: [
      {
        id: 'tailors-shaving-cream',
        name: 'Shaving Cream',
        description: 'Reichhaltige Rasiercreme für die perfekte Rasur',
        detailedDescription: 'Die Shaving Cream sorgt für eine sanfte und gründliche Rasur. Die reichhaltige Formel schützt die Haut vor Irritationen.',
        usage: 'Mit einem Rasierpinsel oder den Händen aufschäumen und auf die angefeuchtete Haut auftragen.',
        price: 'CHF 22',
        image: heatProtectionSpray
      },
      {
        id: 'tailors-aftershave',
        name: 'After Shave Balm',
        description: 'Beruhigender Balsam nach der Rasur',
        detailedDescription: 'Der After Shave Balm beruhigt die Haut nach der Rasur und spendet Feuchtigkeit. Ohne Alkohol, daher brennt er nicht.',
        usage: 'Nach der Rasur auf die gereinigte Haut auftragen und sanft einmassieren.',
        price: 'CHF 26',
        image: repairConditioner
      }
    ]
  }
];