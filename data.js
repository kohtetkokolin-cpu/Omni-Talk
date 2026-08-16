/* ==========================================================
   OmniTalk PRO v10.0 — data.js
   Languages, phrasebooks, offline dictionaries, vocabulary.
========================================================== */

const LANGUAGES = [
  { code: 'my', name: 'Myanmar (Burmese)', flag: '🇲🇲', ttsLocale: 'my-MM', offline: true },
  { code: 'en', name: 'English', flag: '🇺🇸', ttsLocale: 'en-US', offline: true },
  { code: 'zh', name: 'Chinese (Mandarin)', flag: '🇨🇳', ttsLocale: 'zh-CN', offline: true },
  { code: 'th', name: 'Thai', flag: '🇹🇭', ttsLocale: 'th-TH', offline: true },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵', ttsLocale: 'ja-JP', offline: false },
  { code: 'ko', name: 'Korean', flag: '🇰🇷', ttsLocale: 'ko-KR', offline: false },
  { code: 'vi', name: 'Vietnamese', flag: '🇻🇳', ttsLocale: 'vi-VN', offline: false },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳', ttsLocale: 'hi-IN', offline: false },
  { code: 'id', name: 'Indonesian', flag: '🇮🇩', ttsLocale: 'id-ID', offline: false },
  { code: 'ms', name: 'Malay', flag: '🇲🇾', ttsLocale: 'ms-MY', offline: false },
  { code: 'fil', name: 'Filipino (Tagalog)', flag: '🇵🇭', ttsLocale: 'fil-PH', offline: false },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦', ttsLocale: 'ar-SA', offline: false },
  { code: 'fr', name: 'French', flag: '🇫🇷', ttsLocale: 'fr-FR', offline: true },
  { code: 'es', name: 'Spanish', flag: '🇪🇸', ttsLocale: 'es-ES', offline: true },
];

function langByCode(code){
  if(!code) return LANGUAGES[0];
  const c = code.toLowerCase().trim();
  return LANGUAGES.find(l => l.code === c || l.ttsLocale.toLowerCase().startsWith(c)) || LANGUAGES[0];
}

function langOptionLabel(l){
  return `${l.flag} ${l.name}`;
}

const PHRASEBOOK = [
  // 1. Emergency
  { cat: 'emergency', en: 'Help me please!', my: 'ကျေးဇူးပြု၍ ကူညီပါ!', zh: '请帮帮我！', th: 'ช่วยด้วยครับ/ค่ะ!' },
  { cat: 'emergency', en: 'Call the police immediately!', my: 'ရဲ အမြန်ခေါ်ပေးပါ!', zh: '快叫警察！', th: 'เรียกตำรวจด่วน!' },
  { cat: 'emergency', en: 'Call an ambulance!', my: 'လူနာတင်ယာဉ် ခေါ်ပေးပါ!', zh: '快叫救护车！', th: 'เรียกรถพยาบาล!' },
  { cat: 'emergency', en: 'There is a fire!', my: 'မီးလောင်နေတယ်!', zh: '着火了！', th: 'ไฟไหม้!' },
  { cat: 'emergency', en: 'I had an accident.', my: 'ကျွန်တော်/မ မတော်တဆမှု ဖြစ်ခဲ့ပါတယ်။', zh: '我发生了意外。', th: 'ฉันประสบอุบัติเหตุ' },
  { cat: 'emergency', en: 'I am lost, please help me.', my: 'လမ်းပျောက်နေလို့ ကူညီပေးပါခင်ဗျာ။', zh: '我迷路了，请帮帮我。', th: 'ฉันหลงทาง ช่วยหน่อยครับ/ค่ะ' },
  { cat: 'emergency', en: 'Where is the emergency exit?', my: 'အရေးပေါ် ထွက်ပေါက် ဘယ်မှာလဲ?', zh: '紧急出口在哪里？', th: 'ทางออกฉุกเฉินอยู่ที่ไหน?' },

  // 2. Workplace & Factory
  { cat: 'workplace', en: 'What is today’s task?', my: 'ဒီနေ့ လုပ်ရမယ့် အလုပ်က ဘာလဲခင်ဗျာ?', zh: '今天的任务是什么？', th: 'งานวันนี้คืออะไรครับ/ค่ะ?' },
  { cat: 'workplace', en: 'This machine is broken / not working.', my: 'ဒီစက် ပျက်နေပါတယ်/အလုပ်မလုပ်တော့ပါ။', zh: '这台机器坏了/不运转。', th: 'เครื่องนี้เสีย/ไม่ทำงานครับ' },
  { cat: 'workplace', en: 'Please check the defect rate.', my: 'ချို့ယွင်းချက် ရာခိုင်နှုန်းကို စစ်ဆေးပေးပါ။', zh: '请检查不良率。', th: 'กรุณาตรวจสอบอัตราของเสีย' },
  { cat: 'workplace', en: 'We need more raw materials.', my: 'ကုန်ကြမ်းပစ္စည်းတွေ ထပ်လိုပါတယ်။', zh: '我们需要更多原材料。', th: 'เราต้องการวัตถุดิบเพิ่ม' },
  { cat: 'workplace', en: 'Please wear safety helmet and gloves.', my: 'ဘေးကင်းလုံခြုံရေး ဦးထုပ်နှင့် လက်အိတ် ဝတ်ဆင်ပါ။', zh: '请戴好安全帽和手套。', th: 'กรุณาสวมหมวกนิรภัยและถุงมือ' },
  { cat: 'workplace', en: 'The production line is stopped.', my: 'ထုတ်လုပ်မှုလိုင်း ရပ်တန့်နေပါတယ်။', zh: '生产线暂停了。', th: 'สายการผลิตหยุดทำงาน' },
  { cat: 'workplace', en: 'I finished my assigned work.', my: 'ကျွန်တော် တာဝန်ကျအလုပ် ပြီးပါပြီ။', zh: '我完成了分配的工作。', th: 'ฉันทำงานที่ได้รับมอบหมายเสร็จแล้ว' },
  { cat: 'workplace', en: 'When does the shift end?', my: 'ဒီဂျူတီ ဘယ်အချိန် ပြီးမလဲခင်ဗျာ?', zh: '什么时候下班/换班？', th: 'กะนี้เลิกงานกี่โมงครับ?' },
  { cat: 'workplace', en: 'Be careful! Watch your hands.', my: 'သတိထားပါ! လက်ကို ဂရုစိုက်ပါ။', zh: '小心！注意手部安全。', th: 'ระวัง! ระวังมือด้วย' },
  { cat: 'workplace', en: 'Please explain how to operate this.', my: 'ဒါကို ဘယ်လိုမောင်းရမလဲ ရှင်းပြပေးပါ။', zh: '请解释一下如何操作。', th: 'ช่วยอธิบายวิธีใช้งานหน่อยครับ' },

  // 3. Medical & Health
  { cat: 'medical', en: 'I feel very sick.', my: 'ကျွန်တော်/မ နေမကောင်းဖြစ်နေပါတယ်။', zh: '我感觉很不舒服。', th: 'ฉันรู้สึกไม่สบายมาก' },
  { cat: 'medical', en: 'Where is the nearest hospital or clinic?', my: 'အနီးဆုံး ဆေးရုံ (သို့) ဆေးခန်း ဘယ်မှာလဲ?', zh: '最近的医院或诊所在哪里？', th: 'โรงพยาบาลหรือคลินิกที่ใกล้ที่สุดอยู่ที่ไหน?' },
  { cat: 'medical', en: 'I have severe abdominal pain.', my: 'ဗိုက် အရမ်းအောင့်/နာနေပါတယ်။', zh: '我肚子非常疼。', th: 'ฉันปวดท้องมาก' },
  { cat: 'medical', en: 'I have a high fever and headache.', my: 'အဖျားကြီးပြီး ခေါင်းကိုက်နေပါတယ်။', zh: '我发高烧且头痛。', th: 'ฉันมีไข้สูงและปวดหัว' },
  { cat: 'medical', en: 'I got injured at work.', my: 'အလုပ်မှာ ထိခိုက်ဒဏ်ရာ ရသွားပါတယ်။', zh: '我在工作中受伤了。', th: 'ฉันได้รับบาดเจ็บจากการทำงาน' },
  { cat: 'medical', en: 'I need pain relief medicine.', my: 'အကိုက်အခဲပျောက်ဆေး လိုအပ်ပါတယ်။', zh: '我需要止痛药。', th: 'ฉันต้องการยาแก้ปวด' },
  { cat: 'medical', en: 'I am allergic to this medicine.', my: 'ဒီဆေးနဲ့ ဓာတ်မတည့်ပါဘူး။', zh: '我对这种药过敏。', th: 'ฉันแพ้ยานี้' },
  { cat: 'medical', en: 'Can I take sick leave today?', my: 'ဒီနေ့ ဆေးခွင့် ယူလို့ရမလားခင်ဗျာ?', zh: '我今天可以请病假吗？', th: 'วันนี้ฉันขอลาป่วยได้ไหมครับ?' },

  // 4. Housing & Accommodation
  { cat: 'housing', en: 'Where is my dorm room?', my: 'ကျွန်တော့် အဆောင်အခန်း ဘယ်မှာလဲခင်ဗျာ?', zh: '我的宿舍房间在哪里？', th: 'ห้องพักหอพักของฉันอยู่ที่ไหน?' },
  { cat: 'housing', en: 'The water and electricity are cut off.', my: 'ရေ/မီး ပြတ်နေပါတယ်။', zh: '停水停电了。', th: 'น้ำและไฟดับครับ' },
  { cat: 'housing', en: 'The air conditioner is broken.', my: 'လေအေးပေးစက် (Aircon) ပျက်နေပါတယ်။', zh: '空调坏了。', th: 'เครื่องปรับอากาศเสีย' },
  { cat: 'housing', en: 'How much is the monthly room rent?', my: 'တစ်လ အခန်းခ ဘယ်လောက်လဲခင်ဗျာ?', zh: '每月房租是多少？', th: 'ค่าเช่าห้องเดือนละเท่าไหร่ครับ?' },
  { cat: 'housing', en: 'Where can I do laundry?', my: 'အဝတ် ဘယ်နားမှာ လျှော်လို့ရမလဲ?', zh: '在哪里可以洗衣服？', th: 'ซักผ้าได้ที่ไหนครับ?' },

  // 5. Wages & Overtime
  { cat: 'wages', en: 'When will the salary be paid?', my: 'လစာ ဘယ်နေ့ ထုတ်ပေးမှာလဲခင်ဗျာ?', zh: '什么时候发工资？', th: 'เงินเดือนจะออกวันไหนครับ?' },
  { cat: 'wages', en: 'Is overtime (OT) pay calculated correctly?', my: 'အချိန်ပိုကြေး (OT) တွက်ချက်မှု မှန်ကန်ရဲ့လားခင်ဗျာ?', zh: '加班费算得对吗？', th: 'คิดค่าล่วงเวลา (OT) ถูกต้องไหมครับ?' },
  { cat: 'wages', en: 'Can I work overtime today?', my: 'ဒီနေ့ OT ဆင်းလို့ရမလားခင်ဗျာ?', zh: '我今天可以加班吗？', th: 'วันนี้ฉันขอทำโอทีได้ไหมครับ?' },
  { cat: 'wages', en: 'Where is the nearest ATM?', my: 'အနီးဆုံး ATM ဘဏ်စက် ဘယ်မှာလဲ?', zh: '最近的ATM提款机在哪里？', th: 'ตู้ ATM ที่ใกล้ที่สุดอยู่ที่ไหน?' },
  { cat: 'wages', en: 'I want to transfer money home.', my: 'အိမ်ကို ငွေလွှဲချင်လို့ပါ။', zh: '我想往家里汇款。', th: 'ฉันต้องการโอนเงินกลับบ้าน' },

  // 6. Immigration & Visa
  { cat: 'immigration', en: 'Here is my passport and work permit.', my: 'ဒါ ကျွန်တော့် ပတ်စ်ပို့နဲ့ အလုပ်လုပ်ခွင့် ကတ်ပြားပါ။', zh: '这是我的护照和工作许可证。', th: 'นี่คือหนังสือเดินทางและใบอนุญาตทำงานของฉัน' },
  { cat: 'immigration', en: 'I need to renew my visa / contract.', my: 'ဗီဇာ (သို့) စာချုပ် သက်တမ်းတိုးဖို့ လိုအပ်ပါတယ်။', zh: '我需要续签签证/合同。', th: 'ฉันจำเป็นต้องต่ออายุวีซ่า/สัญญาจ้าง' },
  { cat: 'immigration', en: 'Where is the immigration office?', my: 'လဝက (Immigration) ရုံး ဘယ်မှာလဲခင်ဗျာ?', zh: '移民局在哪里？', th: 'สำนักงานตรวจคนเข้าเมืองอยู่ที่ไหน?' },
  { cat: 'immigration', en: 'Is this document legal and certified?', my: 'ဒီစာရွက်စာတမ်း တရားဝင် ခိုင်လုံရဲ့လားခင်ဗျာ?', zh: '这份文件合法且经过认证吗？', th: 'เอกสารนี้ถูกต้องตามกฎหมายหรือไม่?' },

  // 7. Daily Essentials & Conversational Idioms
  { cat: 'basics', en: 'Have you eaten rice / meal yet?', my: 'ထမင်းစားပြီးပြီလား?', zh: '你吃饭了吗？', th: 'กินข้าวหรือยังครับ/ค่ะ?' },
  { cat: 'basics', en: 'Hello / Greetings', my: 'မင်္ဂလာပါ', zh: '你好', th: 'สวัสดี' },
  { cat: 'basics', en: 'Thank you very much!', my: 'အများကြီး ကျေးဇူးတင်ပါတယ်!', zh: '非常感谢！', th: 'ขอบคุณมากครับ/ค่ะ!' },
  { cat: 'basics', en: 'I am sorry / Excuse me', my: 'တောင်းပန်ပါတယ် / ခွင့်လွှတ်ပါ', zh: '对不起 / 抱歉', th: 'ขอโทษครับ/ค่ะ' },
  { cat: 'basics', en: 'I understand clearly.', my: 'သေချာ နားလည်ပါပြီ။', zh: '我清楚明白了。', th: 'เข้าใจชัดเจนแล้วครับ' },
  { cat: 'basics', en: 'I do not understand, please repeat slowly.', my: 'နားမလည်ပါဘူး၊ ဖြည်းဖြည်းလေး ထပ်ပြောပေးပါ။', zh: '我不明白，请慢慢重复一遍。', th: 'ไม่เข้าใจครับ กรุณာพูดช้าๆ อีกครั้ง' },
  { cat: 'basics', en: 'Where is the restroom / toilet?', my: 'အိမ်သာ ဘယ်နားမှာလဲခင်ဗျာ?', zh: '洗手间/厕所在哪里？', th: 'ห้องน้ำอยู่ที่ไหนครับ?' },
  { cat: 'basics', en: 'How much is this?', my: 'ဒါ ဘယ်လောက်ကျပါသလဲခင်ဗျာ?', zh: '这个多少钱？', th: 'อันนี้ราคาเท่าไหร่ครับ?' },
  { cat: 'basics', en: 'Goodbye / See you later', my: 'သွားပါဦးမယ် / နောက်မှ တွေ့ကြမယ်', zh: '再见 / 回头见', th: 'ลาก่อน / ไว้เจอกันใหม่' },
  { cat: 'basics', en: 'What are you doing?', my: 'ဘာလုပ်နေတာလဲ?', zh: '你在做什么？', th: 'กำลังทำอะไรอยู่ครับ?' },
  { cat: 'basics', en: 'Where are you going?', my: 'ဘယ်သွားမလို့လဲ?', zh: '你要去哪里？', th: 'จะไปไหนครับ?' }
];

const PHRASES = [
  { en: 'Daniel David', my: 'ဒန်နီရယ် ဒေးဗစ်', zh: '丹尼尔·大卫', th: 'แดเนียล เดวิด' },
  { en: 'David', my: 'ဒေးဗစ်', zh: '大卫', th: 'เดวิด' },
  { en: 'Daniel', my: 'ဒန်နီရယ်', zh: '丹尼尔', th: 'แดเนียล' },
  { en: 'What are you doing', my: 'ဘာလုပ်နေတာလဲ', zh: '你在做什么', th: 'กำลังทำอะไรอยู่' },
  { en: 'Have you eaten', my: 'ထမင်းစားပြီးပြီလား', zh: '你吃了吗', th: 'กินข้าวหรือยัง' },
  { en: 'Hello', my: 'မင်္ဂလာပါ', zh: '你好', th: 'สวัสดี' },
  { en: 'Thank you', my: 'ကျေးဇူးတင်ပါတယ်', zh: '谢谢', th: 'ขอบคุณ' },
  { en: 'Yes', my: 'ဟုတ်ကဲ့ / ဟုတ်ပါတယ်', zh: '是的', th: 'ใช่' },
  { en: 'No', my: 'မဟုတ်ပါ / မဟုတ်ဘူး', zh: '不是 / 不', th: 'ไม่ใช่' },
  { en: 'Please', my: 'ကျေးဇူးပြု၍', zh: '请', th: 'กรุณာ' },
  { en: 'Sorry', my: 'တောင်းပန်ပါတယ်', zh: '对不起', th: 'ขอโทษ' }
];
