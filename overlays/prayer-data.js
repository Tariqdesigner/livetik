// بيانات وقت الصلاة: الدول والمدن (إحداثيات + المنطقة الزمنية) وطرق الحساب الرسمية لكل دولة.
// يُستخدم في صفحة الأوفرلاي (OBS) وفي التطبيق (المعاينة) وفي main (التحقق من الإعدادات).
// المدينة: [معرّف, اسم عربي, اسم إنجليزي, خط العرض, خط الطول, منطقة زمنية (اختياري: لو تختلف عن الدولة)]
(function (root) {
  // طرق الحساب: زاوية الفجر والعشاء (أو العشاء بدقائق بعد المغرب) + تعديلات بالدقائق تعتمدها الجهة الرسمية
  const METHODS = {
    // أم القرى (مدينة الملك عبدالعزيز): التقريب دائماً للاحتياط — الأذان للأعلى، والشروق للأسفل
    umm_alqura: { ar: 'تقويم أم القرى', fajr: 18.5, ishaMin: 90, ramadanIshaMin: 120, declAt: { fajr: 'noon' }, round: { fajr: 'up', sunrise: 'down', dhuhr: 'up', asr: 'up', maghrib: 'up', isha: 'up' } },
    egypt: { ar: 'الهيئة المصرية العامة للمساحة', fajr: 19.5, isha: 17.5 },
    mwl: { ar: 'رابطة العالم الإسلامي', fajr: 18, isha: 17 },
    karachi: { ar: 'جامعة العلوم الإسلامية بكراتشي', fajr: 18, isha: 18 },
    isna: { ar: 'الجمعية الإسلامية لأمريكا الشمالية', fajr: 15, isha: 15 },
    kuwait: { ar: 'وزارة الأوقاف الكويتية', fajr: 18, isha: 17.5 },
    qatar: { ar: 'وزارة الأوقاف القطرية', fajr: 18, ishaMin: 90 },
    dubai: { ar: 'الهيئة العامة للشؤون الإسلامية (الإمارات)', fajr: 18.2, isha: 18.2, adj: { dhuhr: 3, maghrib: 3 } },
    turkey: { ar: 'رئاسة الشؤون الدينية التركية', fajr: 18, isha: 17, adj: { sunrise: -7, dhuhr: 5, asr: 4, maghrib: 7 } },
    morocco: { ar: 'وزارة الأوقاف المغربية', fajr: 19, isha: 17, adj: { dhuhr: 5, maghrib: 5 } },
    algeria: { ar: 'وزارة الشؤون الدينية الجزائرية', fajr: 18, isha: 17 },
    tunisia: { ar: 'وزارة الشؤون الدينية التونسية', fajr: 18, isha: 18 },
    jordan: { ar: 'وزارة الأوقاف الأردنية', fajr: 18, isha: 18, adj: { maghrib: 5 } },
    gulf: { ar: 'تقويم الخليج', fajr: 19.5, ishaMin: 90 },
    singapore: { ar: 'مجلس الشؤون الإسلامية (سنغافورة/إندونيسيا)', fajr: 20, isha: 18 },
    // ماليزيا: JAKIM تستخدم 18° للفجر والعشاء + دقيقتين احتياط (معايَر على جدول JAKIM الرسمي لسنة كاملة)
    jakim: { ar: 'إدارة التنمية الإسلامية الماليزية (JAKIM)', fajr: 18, isha: 18, adj: { fajr: 2, sunrise: -1, dhuhr: 2, asr: 2, maghrib: 2, isha: 2 } },
  };

  const COUNTRIES = [
    { id: 'SA', ar: 'السعودية', en: 'Saudi Arabia', tz: 'Asia/Riyadh', method: 'umm_alqura', cities: [
      ['riyadh', 'الرياض', 'Riyadh', 24.7136, 46.6753], ['jeddah', 'جدة', 'Jeddah', 21.4858, 39.1925], ['makkah', 'مكة المكرمة', 'Makkah', 21.3891, 39.8579],
      ['madinah', 'المدينة المنورة', 'Madinah', 24.5247, 39.5692], ['dammam', 'الدمام', 'Dammam', 26.4207, 50.0888], ['khobar', 'الخبر', 'Khobar', 26.2172, 50.1971],
      ['dhahran', 'الظهران', 'Dhahran', 26.2361, 50.0393], ['hofuf', 'الأحساء', 'Al Ahsa', 25.3833, 49.5864], ['jubail', 'الجبيل', 'Jubail', 27.0174, 49.6225],
      ['qatif', 'القطيف', 'Qatif', 26.5196, 50.0115], ['taif', 'الطائف', 'Taif', 21.2703, 40.4158], ['tabuk', 'تبوك', 'Tabuk', 28.3835, 36.5662],
      ['abha', 'أبها', 'Abha', 18.2164, 42.5053], ['khamis', 'خميس مشيط', 'Khamis Mushait', 18.3, 42.7333], ['buraidah', 'بريدة', 'Buraidah', 26.326, 43.975],
      ['unaizah', 'عنيزة', 'Unaizah', 26.084, 43.9937], ['rass', 'الرس', 'Ar Rass', 25.8694, 43.4973], ['hail', 'حائل', 'Hail', 27.5114, 41.7208],
      ['jazan', 'جازان', 'Jazan', 16.8892, 42.5511], ['najran', 'نجران', 'Najran', 17.4924, 44.1277], ['baha', 'الباحة', 'Al Baha', 20.0129, 41.4677],
      ['arar', 'عرعر', 'Arar', 30.9753, 41.0381], ['sakaka', 'سكاكا', 'Sakaka', 29.9697, 40.2064], ['yanbu', 'ينبع', 'Yanbu', 24.0895, 38.0618],
      ['hafar', 'حفر الباطن', 'Hafar Al-Batin', 28.4328, 45.9708], ['kharj', 'الخرج', 'Al Kharj', 24.1556, 47.3122], ['qurayyat', 'القريات', 'Al Qurayyat', 31.3317, 37.3428],
      ['qunfudhah', 'القنفذة', 'Al Qunfudhah', 19.1264, 41.0789], ['bisha', 'بيشة', 'Bisha', 20.0005, 42.6052], ['rabigh', 'رابغ', 'Rabigh', 22.7986, 39.0349],
      ['majmaah', 'المجمعة', 'Al Majmaah', 25.9039, 45.3456], ['zulfi', 'الزلفي', 'Az Zulfi', 26.2995, 44.815], ['dawadmi', 'الدوادمي', 'Ad Dawadmi', 24.5077, 44.3924],
      ['dawasir', 'وادي الدواسر', 'Wadi ad-Dawasir', 20.4609, 44.7921], ['sharurah', 'شرورة', 'Sharurah', 17.4667, 47.1167], ['ula', 'العلا', 'AlUla', 26.6085, 37.9232],
    ] },
    { id: 'AE', ar: 'الإمارات', en: 'UAE', tz: 'Asia/Dubai', method: 'dubai', cities: [
      ['abudhabi', 'أبوظبي', 'Abu Dhabi', 24.4539, 54.3773], ['dubai', 'دبي', 'Dubai', 25.2048, 55.2708], ['sharjah', 'الشارقة', 'Sharjah', 25.3463, 55.4209],
      ['ajman', 'عجمان', 'Ajman', 25.4052, 55.5136], ['rak', 'رأس الخيمة', 'Ras Al Khaimah', 25.8007, 55.9762], ['fujairah', 'الفجيرة', 'Fujairah', 25.1288, 56.3265],
      ['uaq', 'أم القيوين', 'Umm Al Quwain', 25.5647, 55.5552], ['alain', 'العين', 'Al Ain', 24.2075, 55.7447],
    ] },
    { id: 'KW', ar: 'الكويت', en: 'Kuwait', tz: 'Asia/Kuwait', method: 'kuwait', cities: [
      ['kuwait', 'مدينة الكويت', 'Kuwait City', 29.3759, 47.9774], ['jahra', 'الجهراء', 'Jahra', 29.3375, 47.6581], ['ahmadi', 'الأحمدي', 'Ahmadi', 29.0769, 48.0838],
      ['hawalli', 'حولي', 'Hawalli', 29.3328, 48.0286], ['farwaniya', 'الفروانية', 'Farwaniya', 29.2775, 47.9586],
    ] },
    { id: 'QA', ar: 'قطر', en: 'Qatar', tz: 'Asia/Qatar', method: 'qatar', cities: [
      ['doha', 'الدوحة', 'Doha', 25.2854, 51.531], ['rayyan', 'الريان', 'Al Rayyan', 25.2919, 51.4244], ['wakrah', 'الوكرة', 'Al Wakrah', 25.1659, 51.5976], ['khor', 'الخور', 'Al Khor', 25.6839, 51.5058],
    ] },
    { id: 'BH', ar: 'البحرين', en: 'Bahrain', tz: 'Asia/Bahrain', method: 'gulf', cities: [
      ['manama', 'المنامة', 'Manama', 26.2285, 50.586], ['muharraq', 'المحرق', 'Muharraq', 26.2572, 50.6119], ['riffa', 'الرفاع', 'Riffa', 26.13, 50.555],
    ] },
    { id: 'OM', ar: 'عُمان', en: 'Oman', tz: 'Asia/Muscat', method: 'mwl', cities: [
      ['muscat', 'مسقط', 'Muscat', 23.588, 58.3829], ['salalah', 'صلالة', 'Salalah', 17.0151, 54.0924], ['sohar', 'صحار', 'Sohar', 24.347, 56.709],
      ['nizwa', 'نزوى', 'Nizwa', 22.9333, 57.5333], ['sur', 'صور', 'Sur', 22.5667, 59.5289],
    ] },
    { id: 'YE', ar: 'اليمن', en: 'Yemen', tz: 'Asia/Aden', method: 'mwl', cities: [
      ['sanaa', 'صنعاء', "Sana'a", 15.3694, 44.191], ['aden', 'عدن', 'Aden', 12.7855, 45.0187], ['taiz', 'تعز', 'Taiz', 13.5795, 44.0209],
      ['hodeidah', 'الحديدة', 'Hodeidah', 14.7978, 42.9545], ['mukalla', 'المكلا', 'Mukalla', 14.5425, 49.1242],
    ] },
    { id: 'IQ', ar: 'العراق', en: 'Iraq', tz: 'Asia/Baghdad', method: 'mwl', cities: [
      ['baghdad', 'بغداد', 'Baghdad', 33.3152, 44.3661], ['basra', 'البصرة', 'Basra', 30.5085, 47.7804], ['mosul', 'الموصل', 'Mosul', 36.335, 43.1189],
      ['erbil', 'أربيل', 'Erbil', 36.1911, 44.0092], ['najaf', 'النجف', 'Najaf', 32.0259, 44.3462], ['karbala', 'كربلاء', 'Karbala', 32.616, 44.0249],
      ['kirkuk', 'كركوك', 'Kirkuk', 35.4681, 44.3922], ['sulaymaniyah', 'السليمانية', 'Sulaymaniyah', 35.5613, 45.4302],
    ] },
    { id: 'JO', ar: 'الأردن', en: 'Jordan', tz: 'Asia/Amman', method: 'jordan', cities: [
      ['amman', 'عمّان', 'Amman', 31.9454, 35.9284], ['zarqa', 'الزرقاء', 'Zarqa', 32.0728, 36.088], ['irbid', 'إربد', 'Irbid', 32.5568, 35.8469], ['aqaba', 'العقبة', 'Aqaba', 29.5321, 35.0063],
    ] },
    { id: 'PS', ar: 'فلسطين', en: 'Palestine', tz: 'Asia/Hebron', method: 'egypt', cities: [
      ['quds', 'القدس', 'Jerusalem', 31.7683, 35.2137], ['gaza', 'غزة', 'Gaza', 31.5017, 34.4668, 'Asia/Gaza'], ['ramallah', 'رام الله', 'Ramallah', 31.9038, 35.2034],
      ['nablus', 'نابلس', 'Nablus', 32.2211, 35.2544], ['hebron', 'الخليل', 'Hebron', 31.5326, 35.0998],
    ] },
    { id: 'LB', ar: 'لبنان', en: 'Lebanon', tz: 'Asia/Beirut', method: 'egypt', cities: [
      ['beirut', 'بيروت', 'Beirut', 33.8938, 35.5018], ['tripoli', 'طرابلس', 'Tripoli', 34.4367, 35.8497], ['saida', 'صيدا', 'Sidon', 33.5571, 35.3729],
    ] },
    { id: 'SY', ar: 'سوريا', en: 'Syria', tz: 'Asia/Damascus', method: 'egypt', cities: [
      ['damascus', 'دمشق', 'Damascus', 33.5138, 36.2765], ['aleppo', 'حلب', 'Aleppo', 36.2021, 37.1343], ['homs', 'حمص', 'Homs', 34.7324, 36.7137],
      ['latakia', 'اللاذقية', 'Latakia', 35.5317, 35.7901], ['hama', 'حماة', 'Hama', 35.1318, 36.7578],
    ] },
    { id: 'EG', ar: 'مصر', en: 'Egypt', tz: 'Africa/Cairo', method: 'egypt', cities: [
      ['cairo', 'القاهرة', 'Cairo', 30.0444, 31.2357], ['alexandria', 'الإسكندرية', 'Alexandria', 31.2001, 29.9187], ['giza', 'الجيزة', 'Giza', 30.0131, 31.2089],
      ['mansoura', 'المنصورة', 'Mansoura', 31.0409, 31.3785], ['tanta', 'طنطا', 'Tanta', 30.7865, 31.0004], ['portsaid', 'بورسعيد', 'Port Said', 31.2653, 32.3019],
      ['suez', 'السويس', 'Suez', 29.9668, 32.5498], ['asyut', 'أسيوط', 'Asyut', 27.1809, 31.1837], ['luxor', 'الأقصر', 'Luxor', 25.6872, 32.6396],
      ['aswan', 'أسوان', 'Aswan', 24.0889, 32.8998], ['hurghada', 'الغردقة', 'Hurghada', 27.2579, 33.8116], ['sharm', 'شرم الشيخ', 'Sharm El Sheikh', 27.9158, 34.3299],
    ] },
    { id: 'SD', ar: 'السودان', en: 'Sudan', tz: 'Africa/Khartoum', method: 'egypt', cities: [
      ['khartoum', 'الخرطوم', 'Khartoum', 15.5007, 32.5599], ['omdurman', 'أم درمان', 'Omdurman', 15.6445, 32.4777], ['portsudan', 'بورتسودان', 'Port Sudan', 19.6158, 37.2164],
    ] },
    { id: 'LY', ar: 'ليبيا', en: 'Libya', tz: 'Africa/Tripoli', method: 'egypt', cities: [
      ['tripoli', 'طرابلس', 'Tripoli', 32.8872, 13.1913], ['benghazi', 'بنغازي', 'Benghazi', 32.1167, 20.0667], ['misrata', 'مصراتة', 'Misrata', 32.3754, 15.0925],
    ] },
    { id: 'TN', ar: 'تونس', en: 'Tunisia', tz: 'Africa/Tunis', method: 'tunisia', cities: [
      ['tunis', 'تونس', 'Tunis', 36.8065, 10.1815], ['sfax', 'صفاقس', 'Sfax', 34.7406, 10.7603], ['sousse', 'سوسة', 'Sousse', 35.8256, 10.6084],
    ] },
    { id: 'DZ', ar: 'الجزائر', en: 'Algeria', tz: 'Africa/Algiers', method: 'algeria', cities: [
      ['algiers', 'الجزائر', 'Algiers', 36.7538, 3.0588], ['oran', 'وهران', 'Oran', 35.6971, -0.6308], ['constantine', 'قسنطينة', 'Constantine', 36.365, 6.6147], ['annaba', 'عنابة', 'Annaba', 36.9, 7.7667],
    ] },
    { id: 'MA', ar: 'المغرب', en: 'Morocco', tz: 'Africa/Casablanca', method: 'morocco', cities: [
      ['rabat', 'الرباط', 'Rabat', 34.0209, -6.8416], ['casablanca', 'الدار البيضاء', 'Casablanca', 33.5731, -7.5898], ['marrakech', 'مراكش', 'Marrakech', 31.6295, -7.9811],
      ['fes', 'فاس', 'Fes', 34.0181, -5.0078], ['tangier', 'طنجة', 'Tangier', 35.7595, -5.834], ['agadir', 'أكادير', 'Agadir', 30.4278, -9.5981],
    ] },
    { id: 'MR', ar: 'موريتانيا', en: 'Mauritania', tz: 'Africa/Nouakchott', method: 'mwl', cities: [['nouakchott', 'نواكشوط', 'Nouakchott', 18.0735, -15.9582]] },
    { id: 'SO', ar: 'الصومال', en: 'Somalia', tz: 'Africa/Mogadishu', method: 'mwl', cities: [['mogadishu', 'مقديشو', 'Mogadishu', 2.0469, 45.3182]] },
    { id: 'DJ', ar: 'جيبوتي', en: 'Djibouti', tz: 'Africa/Djibouti', method: 'mwl', cities: [['djibouti', 'جيبوتي', 'Djibouti', 11.5721, 43.1456]] },
    { id: 'TR', ar: 'تركيا', en: 'Turkey', tz: 'Europe/Istanbul', method: 'turkey', cities: [
      ['istanbul', 'إسطنبول', 'Istanbul', 41.0082, 28.9784], ['ankara', 'أنقرة', 'Ankara', 39.9334, 32.8597], ['izmir', 'إزمير', 'Izmir', 38.4237, 27.1428],
      ['bursa', 'بورصة', 'Bursa', 40.1885, 29.061], ['antalya', 'أنطاليا', 'Antalya', 36.8969, 30.7133], ['trabzon', 'طرابزون', 'Trabzon', 41.0015, 39.7178],
    ] },
    { id: 'PK', ar: 'باكستان', en: 'Pakistan', tz: 'Asia/Karachi', method: 'karachi', asr: 'hanafi', cities: [
      ['karachi', 'كراتشي', 'Karachi', 24.8607, 67.0011], ['lahore', 'لاهور', 'Lahore', 31.5204, 74.3587], ['islamabad', 'إسلام آباد', 'Islamabad', 33.6844, 73.0479],
    ] },
    { id: 'IN', ar: 'الهند', en: 'India', tz: 'Asia/Kolkata', method: 'karachi', asr: 'hanafi', cities: [
      ['delhi', 'دلهي', 'Delhi', 28.6139, 77.209], ['mumbai', 'مومباي', 'Mumbai', 19.076, 72.8777], ['hyderabad', 'حيدر آباد', 'Hyderabad', 17.385, 78.4867],
    ] },
    { id: 'ID', ar: 'إندونيسيا', en: 'Indonesia', tz: 'Asia/Jakarta', method: 'singapore', cities: [
      ['jakarta', 'جاكرتا', 'Jakarta', -6.2088, 106.8456], ['surabaya', 'سورابايا', 'Surabaya', -7.2575, 112.7521],
    ] },
    { id: 'MY', ar: 'ماليزيا', en: 'Malaysia', tz: 'Asia/Kuala_Lumpur', method: 'jakim', cities: [['kualalumpur', 'كوالالمبور', 'Kuala Lumpur', 3.139, 101.6869]] },
    { id: 'GB', ar: 'بريطانيا', en: 'United Kingdom', tz: 'Europe/London', method: 'mwl', cities: [
      ['london', 'لندن', 'London', 51.5072, -0.1276], ['manchester', 'مانشستر', 'Manchester', 53.4808, -2.2426], ['birmingham', 'برمنغهام', 'Birmingham', 52.4862, -1.8904],
    ] },
    { id: 'DE', ar: 'ألمانيا', en: 'Germany', tz: 'Europe/Berlin', method: 'mwl', cities: [
      ['berlin', 'برلين', 'Berlin', 52.52, 13.405], ['munich', 'ميونخ', 'Munich', 48.1351, 11.582], ['frankfurt', 'فرانكفورت', 'Frankfurt', 50.1109, 8.6821],
    ] },
    { id: 'FR', ar: 'فرنسا', en: 'France', tz: 'Europe/Paris', method: 'mwl', cities: [
      ['paris', 'باريس', 'Paris', 48.8566, 2.3522], ['lyon', 'ليون', 'Lyon', 45.764, 4.8357], ['marseille', 'مرسيليا', 'Marseille', 43.2965, 5.3698],
    ] },
    { id: 'US', ar: 'أمريكا', en: 'United States', tz: 'America/New_York', method: 'isna', cities: [
      ['newyork', 'نيويورك', 'New York', 40.7128, -74.006], ['washington', 'واشنطن', 'Washington', 38.9072, -77.0369], ['detroit', 'ديترويت', 'Detroit', 42.3314, -83.0458, 'America/Detroit'],
      ['chicago', 'شيكاغو', 'Chicago', 41.8781, -87.6298, 'America/Chicago'], ['houston', 'هيوستن', 'Houston', 29.7604, -95.3698, 'America/Chicago'],
      ['losangeles', 'لوس أنجلوس', 'Los Angeles', 34.0522, -118.2437, 'America/Los_Angeles'],
    ] },
    { id: 'CA', ar: 'كندا', en: 'Canada', tz: 'America/Toronto', method: 'isna', cities: [
      ['toronto', 'تورونتو', 'Toronto', 43.6532, -79.3832], ['montreal', 'مونتريال', 'Montreal', 45.5019, -73.5674],
      ['calgary', 'كالغاري', 'Calgary', 51.0447, -114.0719, 'America/Edmonton'], ['vancouver', 'فانكوفر', 'Vancouver', 49.2827, -123.1207, 'America/Vancouver'],
    ] },
    { id: 'AU', ar: 'أستراليا', en: 'Australia', tz: 'Australia/Sydney', method: 'mwl', cities: [
      ['sydney', 'سيدني', 'Sydney', -33.8688, 151.2093], ['melbourne', 'ملبورن', 'Melbourne', -37.8136, 144.9631, 'Australia/Melbourne'],
    ] },
  ];

  function find(countryId, cityId) {
    const country = COUNTRIES.find((c) => c.id === countryId) || COUNTRIES[0];
    const row = country.cities.find((c) => c[0] === cityId) || country.cities[0];
    return {
      country,
      city: { id: row[0], ar: row[1], en: row[2], lat: row[3], lng: row[4], tz: row[5] || country.tz },
      method: METHODS[country.method] || METHODS.mwl,
      methodId: country.method,
      asr: country.asr || 'shafi',
    };
  }

  const api = { METHODS, COUNTRIES, find };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PrayerData = api;
})(typeof window !== 'undefined' ? window : globalThis);
